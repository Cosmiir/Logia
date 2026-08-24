use crate::api::types::{ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use futures::future::join_all;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex as AsyncMutex;

const IGDB_GAMES_URL: &str = "https://api.igdb.com/v4/games";
const IGDB_TIME_TO_BEAT_URL: &str = "https://api.igdb.com/v4/game_time_to_beats";
const TWITCH_TOKEN_URL: &str = "https://id.twitch.tv/oauth2/token";

struct TokenCache {
    client_id: String,
    access_token: String,
    expires_at: u64,
}

// An async mutex, held across the Twitch request itself (see
// `get_access_token`) rather than just around the cache check. A plain
// `std::sync::Mutex` released between "check cache" and "store new token"
// let concurrent callers race to Twitch's OAuth endpoint independently
// whenever the cache was empty or expired; holding an async mutex for the
// whole operation means only the first caller fetches, and the rest simply
// wait for the lock and reuse what it just stored.
static TOKEN_CACHE: AsyncMutex<Option<TokenCache>> = AsyncMutex::const_new(None);

/// Helper to parse client_id and client_secret from combined api_key string "client_id:client_secret"
fn parse_credentials(api_key: &str) -> Result<(String, String), String> {
    let parts: Vec<&str> = api_key.split(':').collect();
    if parts.len() >= 2 && !parts[0].trim().is_empty() && !parts[1].trim().is_empty() {
        Ok((parts[0].trim().to_string(), parts[1].trim().to_string()))
    } else {
        Err("IGDB requires both Client ID and Client Secret (format: client_id:client_secret)".to_string())
    }
}

/// Helper to get current Unix timestamp in seconds
fn current_time_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Retrieve or refresh Twitch OAuth2 access token
async fn get_access_token(client_id: &str, client_secret: &str) -> Result<String, String> {
    let now = current_time_secs();

    // Held for the whole function, including the network call below: if two
    // searches/details fire at once with no valid token cached, the second
    // one blocks here instead of also hitting Twitch, then reuses the token
    // the first one just fetched.
    let mut guard = TOKEN_CACHE.lock().await;

    if let Some(cache) = guard.as_ref() {
        if cache.client_id == client_id && cache.expires_at > now + 60 {
            return Ok(cache.access_token.clone());
        }
    }

    // Fetch new OAuth token from Twitch
    let client = build_client();
    let resp = client
        .post(TWITCH_TOKEN_URL)
        .query(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .map_err(|e| format!("Twitch OAuth token request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Twitch OAuth authentication failed (status {})", resp.status()));
    }

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let token = body
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("No access_token in Twitch response")?
        .to_string();

    let expires_in = body
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .unwrap_or(3600);

    *guard = Some(TokenCache {
        client_id: client_id.to_string(),
        access_token: token.clone(),
        expires_at: now + expires_in,
    });

    Ok(token)
}

/// Helper to extract developer name from involved_companies array
fn extract_developer(game: &Value) -> Option<String> {
    let companies = game.get("involved_companies")?.as_array()?;

    // 1. Try to find company where developer is true
    for c in companies {
        if c.get("developer").and_then(|v| v.as_bool()).unwrap_or(false) {
            if let Some(name) = c.pointer("/company/name").and_then(|n| n.as_str()) {
                let trim = name.trim();
                if !trim.is_empty() {
                    return Some(trim.to_string());
                }
            }
        }
    }

    // 2. Fallback to any company name
    for c in companies {
        if let Some(name) = c.pointer("/company/name").and_then(|n| n.as_str()) {
            let trim = name.trim();
            if !trim.is_empty() {
                return Some(trim.to_string());
            }
        }
    }

    None
}

/// Helper to convert Unix timestamp to YYYY-MM-DD string
fn format_release_date(timestamp: i64) -> Option<String> {
    use chrono::{DateTime, Utc};
    DateTime::from_timestamp(timestamp, 0)
        .map(|dt: DateTime<Utc>| dt.format("%Y-%m-%d").to_string())
}

/// Escape query string for IGDB Apicalypse syntax
fn escape_query(query: &str) -> String {
    query.replace('\\', "\\\\").replace('"', "\\\"")
}

pub async fn search(
    query: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let key_str = api_key.ok_or("IGDB Client ID and Secret required")?;
    let (client_id, client_secret) = parse_credentials(key_str)?;
    let access_token = get_access_token(&client_id, &client_secret).await?;

    rate_limiter.acquire("igdb").await;
    let client = build_client();
    let escaped = escape_query(query);

    // Only the fields actually used to build an ApiSearchResult below —
    // summary/genres aren't part of the search result shape and were being
    // fetched (and discarded) on every search, for every one of the 8
    // candidates.
    let body_query = format!(
        "search \"{}\"; fields id, name, first_release_date, cover.image_id, involved_companies.company.name, involved_companies.developer; limit 8;",
        escaped
    );

    let resp = retry(3, || {
        let client = &client;
        let client_id = &client_id;
        let access_token = &access_token;
        let body_query = &body_query;
        async move {
            client
                .post(IGDB_GAMES_URL)
                .header("Client-ID", client_id)
                .header("Authorization", format!("Bearer {}", access_token))
                .header("Content-Type", "text/plain")
                .body(body_query.clone())
                .send()
                .await
        }
    })
    .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("IGDB search failed ({}): {}", status, err_text));
    }

    let games: Vec<Value> = resp.json().await.map_err(|e| e.to_string())?;
    let mut items = Vec::new();

    for game in games {
        let id = game.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        if id == 0 {
            continue;
        }

        let title = game.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        if title.is_empty() {
            continue;
        }

        let year = game
            .get("first_release_date")
            .and_then(|v| v.as_i64())
            .and_then(format_release_date)
            .and_then(|s| s.get(0..4).map(|y| y.to_string()));

        let creator = extract_developer(&game);

        let thumb_url = game
            .pointer("/cover/image_id")
            .and_then(|v| v.as_str())
            .map(|img_id| format!("https://images.igdb.com/igdb/image/upload/t_thumb/{}.jpg", img_id));

        items.push((id.to_string(), title, year, creator, thumb_url));
    }

    // Fetch thumbnails concurrently instead of one at a time.
    let thumbnails = join_all(items.iter().map(|(_, _, _, _, thumb_url)| async move {
        match thumb_url {
            Some(u) => fetch_image_as_b64(u).await,
            None => None,
        }
    }))
    .await;

    let out = items
        .into_iter()
        .zip(thumbnails)
        .map(|((id, title, year, creator, _), thumbnail_b64)| ApiSearchResult {
            provider: "igdb".to_string(),
            provider_id: id,
            title,
            year,
            creator,
            thumbnail_b64,
        })
        .collect();

    Ok(out)
}

pub async fn get_detail(
    id: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    let key_str = api_key.ok_or("IGDB Client ID and Secret required")?;
    let (client_id, client_secret) = parse_credentials(key_str)?;
    let access_token = get_access_token(&client_id, &client_secret).await?;

    rate_limiter.acquire("igdb").await;
    let client = build_client();

    let body_query = format!(
        "fields id, name, first_release_date, cover.image_id, summary, genres.name, themes.name, keywords.name, involved_companies.company.name, involved_companies.developer, screenshots.image_id, artworks.image_id; where id = {};",
        id
    );

    let ttb_body = format!(
        "fields game_id, normally, completely, hastily; where game_id = {};",
        id
    );

    // Launch IGDB game detail and game_time_to_beats in PARALLEL
    let (resp_res, ttb_res) = futures::join!(
        retry(3, || {
            let client = &client;
            let client_id = &client_id;
            let access_token = &access_token;
            let body_query = &body_query;
            async move {
                client
                    .post(IGDB_GAMES_URL)
                    .header("Client-ID", client_id)
                    .header("Authorization", format!("Bearer {}", access_token))
                    .header("Content-Type", "text/plain")
                    .body(body_query.clone())
                    .send()
                    .await
            }
        }),
        retry(1, || {
            let client = &client;
            let client_id = &client_id;
            let access_token = &access_token;
            let ttb_body = &ttb_body;
            async move {
                client
                    .post(IGDB_TIME_TO_BEAT_URL)
                    .header("Client-ID", client_id)
                    .header("Authorization", format!("Bearer {}", access_token))
                    .header("Content-Type", "text/plain")
                    .body(ttb_body.clone())
                    .send()
                    .await
            }
        })
    );

    let resp = resp_res?;
    if !resp.status().is_success() {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("IGDB detail failed ({}): {}", status, err_text));
    }

    let games: Vec<Value> = resp.json().await.map_err(|e| e.to_string())?;
    let game = games.first().ok_or("IGDB: game not found")?;

    let title = game.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();

    let release_date = game
        .get("first_release_date")
        .and_then(|v| v.as_i64())
        .and_then(format_release_date);

    let creator = extract_developer(game);

    let now_secs = current_time_secs() as i64;
    let is_released = game
        .get("first_release_date")
        .and_then(|v| v.as_i64())
        .map(|ts| ts <= now_secs)
        .unwrap_or(true);

    let media_status = if is_released { "COMPLETED" } else { "UPCOMING" }.to_string();
    let synopsis = game.get("summary").and_then(|v| v.as_str()).map(|s| s.to_string());

    // Extract HowLongToBeat duration from parallel ttb_res
    let mut duration: Option<f64> = None;
    if let Ok(ttb_resp) = ttb_res {
        if ttb_resp.status().is_success() {
            if let Ok(ttb_items) = ttb_resp.json::<Vec<Value>>().await {
                if let Some(first_ttb) = ttb_items.first() {
                    let parse_num = |key: &str| -> Option<f64> {
                        let val = first_ttb.get(key)?;
                        if let Some(f) = val.as_f64() {
                            if f > 0.0 { return Some(f); }
                        }
                        if let Some(n) = val.as_u64() {
                            if n > 0 { return Some(n as f64); }
                        }
                        if let Some(n) = val.as_i64() {
                            if n > 0 { return Some(n as f64); }
                        }
                        None
                    };

                    let secs = parse_num("normally")
                        .or_else(|| parse_num("completely"))
                        .or_else(|| parse_num("hastily"));

                    if let Some(s) = secs {
                        let hours = (s / 3600.0).round().max(1.0);
                        duration = Some(hours);
                    }
                }
            }
        }
    }

    // Fast fallback: if IGDB game_time_to_beats is empty, check RAWG playtime (max 600ms timeout)
    if duration.is_none() && !title.is_empty() {
        let client_clone = client.clone();
        let title_clone = title.clone();
        let rawg_task = async move {
            let resp = client_clone
                .get("https://api.rawg.io/api/games")
                .query(&[("search", title_clone.as_str()), ("page_size", "1")])
                .send()
                .await.ok()?;
            if resp.status().is_success() {
                let json: Value = resp.json().await.ok()?;
                let p = json.pointer("/results/0/playtime")?;
                let hours = p.as_f64().or_else(|| p.as_u64().map(|n| n as f64))?;
                if hours > 0.0 {
                    return Some(hours.round());
                }
            }
            None
        };

        if let Ok(Some(h)) = tokio::time::timeout(std::time::Duration::from_millis(600), rawg_task).await {
            duration = Some(h);
        }
    }

    // Extract genres, themes, and keywords
    let mut genres: Vec<String> = Vec::new();
    let genre_fields = ["genres", "themes", "keywords"];
    for field in genre_fields {
        if let Some(arr) = game.get(field).and_then(|g| g.as_array()) {
            for item in arr {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    let trim = name.trim();
                    if !trim.is_empty() && !genres.iter().any(|existing| existing.eq_ignore_ascii_case(trim)) {
                        genres.push(trim.to_string());
                    }
                }
            }
        }
    }

    // Extract images (cover_big + screenshots + artworks)
    let mut image_urls: Vec<String> = Vec::new();

    // Cover
    if let Some(img_id) = game.pointer("/cover/image_id").and_then(|v| v.as_str()) {
        image_urls.push(format!("https://images.igdb.com/igdb/image/upload/t_cover_big/{}.jpg", img_id));
    }

    // Screenshots
    if let Some(arr) = game.get("screenshots").and_then(|s| s.as_array()) {
        for ss in arr {
            if image_urls.len() >= 8 { break; }
            if let Some(img_id) = ss.get("image_id").and_then(|i| i.as_str()) {
                let url = format!("https://images.igdb.com/igdb/image/upload/t_720p/{}.jpg", img_id);
                if !image_urls.contains(&url) {
                    image_urls.push(url);
                }
            }
        }
    }

    // Artworks
    if let Some(arr) = game.get("artworks").and_then(|a| a.as_array()) {
        for art in arr {
            if image_urls.len() >= 8 { break; }
            if let Some(img_id) = art.get("image_id").and_then(|i| i.as_str()) {
                let url = format!("https://images.igdb.com/igdb/image/upload/t_720p/{}.jpg", img_id);
                if !image_urls.contains(&url) {
                    image_urls.push(url);
                }
            }
        }
    }

    let images = image_urls
        .into_iter()
        .map(|url| ApiImage { url, thumbnail_b64: None, kind: None })
        .collect();

    Ok(ApiMediaDetail {
        provider: "igdb".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status: Some(media_status),
        synopsis,
        duration,
        genres,
        credits: Vec::new(),
        images,
    })
}