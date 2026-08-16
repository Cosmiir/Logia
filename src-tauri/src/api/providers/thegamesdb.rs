use crate::api::types::{ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use serde_json::Value;

const BASE_URL: &str = "https://api.thegamesdb.net/v1";

/// Helper to resolve developer or genre name from an ID (number/string) or direct string/object.
fn resolve_name(item_val: &Value, lookup1: Option<&Value>, lookup2: Option<&Value>) -> Option<String> {
    // 1. Direct object with "name" field
    if let Some(n) = item_val.get("name").and_then(|v| v.as_str()) {
        let trim = n.trim();
        if !trim.is_empty() {
            return Some(trim.to_string());
        }
    }

    // 2. Direct string value (non-numeric string like "Warhorse Studios" or "Role-Playing")
    if let Some(s) = item_val.as_str() {
        let trim = s.trim();
        if !trim.is_empty() && !trim.chars().all(|c| c.is_ascii_digit()) {
            return Some(trim.to_string());
        }
    }

    // 3. String or numeric ID -> look up in lookup dictionaries
    let id_str = if let Some(s) = item_val.as_str() {
        s.trim().to_string()
    } else if let Some(n) = item_val.as_i64() {
        n.to_string()
    } else if let Some(n) = item_val.as_u64() {
        n.to_string()
    } else {
        return None;
    };

    let find_in = |lookup: &Value| -> Option<String> {
        if let Some(obj) = lookup.as_object() {
            if let Some(entry) = obj.get(&id_str) {
                if let Some(n) = entry.get("name").and_then(|v| v.as_str()) {
                    let trim = n.trim();
                    if !trim.is_empty() { return Some(trim.to_string()); }
                }
                if let Some(n) = entry.as_str() {
                    let trim = n.trim();
                    if !trim.is_empty() { return Some(trim.to_string()); }
                }
            }
            for (_k, entry) in obj {
                let entry_id = entry.get("id").and_then(|i| i.as_i64()).map(|i| i.to_string())
                    .or_else(|| entry.get("id").and_then(|i| i.as_str()).map(|s| s.to_string()));
                if entry_id == Some(id_str.clone()) {
                    if let Some(n) = entry.get("name").and_then(|v| v.as_str()) {
                        let trim = n.trim();
                        if !trim.is_empty() { return Some(trim.to_string()); }
                    }
                }
            }
        } else if let Some(arr) = lookup.as_array() {
            for entry in arr {
                let entry_id = entry.get("id").and_then(|i| i.as_i64()).map(|i| i.to_string())
                    .or_else(|| entry.get("id").and_then(|i| i.as_str()).map(|s| s.to_string()));
                if entry_id == Some(id_str.clone()) {
                    if let Some(n) = entry.get("name").and_then(|v| v.as_str()) {
                        let trim = n.trim();
                        if !trim.is_empty() { return Some(trim.to_string()); }
                    }
                }
            }
        }
        None
    };

    if let Some(l1) = lookup1 {
        if let Some(res) = find_in(l1) { return Some(res); }
    }
    if let Some(l2) = lookup2 {
        if let Some(res) = find_in(l2) { return Some(res); }
    }

    None
}

/// Helper to extract image URLs for a game from TheGamesDB response.
fn extract_images(body: &Value, game_id: i64, use_thumb: bool) -> Vec<String> {
    let mut urls = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let base_key = if use_thumb { "thumb" } else { "original" };
    let fallback_base = if use_thumb {
        "https://cdn.thegamesdb.net/images/thumb/"
    } else {
        "https://cdn.thegamesdb.net/images/original/"
    };

    let base_url = body
        .pointer(&format!("/data/images/base_url/{}", base_key))
        .or_else(|| body.pointer(&format!("/data/base_url/{}", base_key)))
        .and_then(|u| u.as_str())
        .unwrap_or(fallback_base);

    let gid_str = game_id.to_string();

    let mut candidate_lists: Vec<&Vec<Value>> = Vec::new();

    if let Some(arr) = body.pointer("/data/images/games").and_then(|g| g.get(&gid_str)).and_then(|i| i.as_array()) {
        candidate_lists.push(arr);
    }
    if let Some(arr) = body.pointer("/data/images").and_then(|g| g.get(&gid_str)).and_then(|i| i.as_array()) {
        candidate_lists.push(arr);
    }
    if let Some(arr) = body.pointer("/data/images").and_then(|i| i.as_array()) {
        candidate_lists.push(arr);
    }

    let mut fronts = Vec::new();
    let mut others = Vec::new();

    for arr in candidate_lists {
        for item in arr {
            if let Some(fname) = item.get("filename").and_then(|f| f.as_str()) {
                let full_url = if fname.starts_with("http://") || fname.starts_with("https://") {
                    fname.to_string()
                } else {
                    format!("{}{}", base_url, fname)
                };
                let side = item.get("side").and_then(|s| s.as_str()).unwrap_or("");
                let img_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");

                if side == "front" || img_type == "boxart_front" || (img_type == "boxart" && side != "back") {
                    fronts.push(full_url);
                } else {
                    others.push(full_url);
                }
            }
        }
    }

    for u in fronts.into_iter().chain(others) {
        if urls.len() >= 8 { break; }
        if seen.insert(u.clone()) {
            urls.push(u);
        }
    }

    urls
}

pub async fn search(
    query: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let key = api_key.ok_or("TheGamesDB API key required")?;
    rate_limiter.acquire("thegamesdb").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/Games/ByGameName", BASE_URL))
                .query(&[
                    ("apikey", key),
                    ("name", query),
                    ("fields", "overview,developers,genres,release_date"),
                    ("include", "boxart,developer"),
                ])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("TheGamesDB search failed: {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;

    let games: Vec<Value> = if let Some(arr) = body.pointer("/data/games").and_then(|g| g.as_array()) {
        arr.clone()
    } else if let Some(obj) = body.pointer("/data/games").and_then(|g| g.as_object()) {
        obj.values().cloned().collect()
    } else {
        Vec::new()
    };

    let dev_data = body.pointer("/data/developers");
    let dev_lookup_root = body.get("developers");

    let mut out = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for game in games.iter() {
        let id = game.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        if id == 0 || !seen_ids.insert(id) {
            continue;
        }

        let title = game.get("game_title").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        if title.is_empty() {
            continue;
        }

        let year = game
            .get("release_date")
            .and_then(|v| v.as_str())
            .and_then(|s| s.get(0..4))
            .map(|s| s.to_string());

        let creator = game
            .get("developers")
            .and_then(|d| d.as_array())
            .and_then(|arr| arr.first())
            .and_then(|dev_val| resolve_name(dev_val, dev_data, dev_lookup_root));

        let game_images = extract_images(&body, id, true);
        let thumbnail_b64 = if let Some(first_url) = game_images.first() {
            fetch_image_as_b64(first_url).await
        } else {
            None
        };

        out.push(ApiSearchResult {
            provider: "thegamesdb".to_string(),
            provider_id: id.to_string(),
            title,
            year,
            creator,
            thumbnail_b64,
        });

        if out.len() >= 8 {
            break;
        }
    }
    Ok(out)
}

pub async fn get_detail(
    id: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    let key = api_key.ok_or("TheGamesDB API key required")?;
    rate_limiter.acquire("thegamesdb").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/Games/ByGameID", BASE_URL))
                .query(&[
                    ("apikey", key),
                    ("id", id),
                    ("fields", "overview,developers,publishers,genres,release_date,players,rating"),
                    ("include", "boxart,developer"),
                ])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("TheGamesDB detail failed: {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;

    let game = if let Some(arr) = body.pointer("/data/games").and_then(|g| g.as_array()) {
        arr.first().cloned()
    } else if let Some(obj) = body.pointer("/data/games").and_then(|g| g.as_object()) {
        obj.values().next().cloned()
    } else {
        None
    }.ok_or("TheGamesDB: game not found")?;

    let game_id: i64 = game
        .get("id")
        .and_then(|v| v.as_i64())
        .or_else(|| id.parse().ok())
        .unwrap_or(0);

    let title = game.get("game_title").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let release_date = game.get("release_date").and_then(|v| v.as_str()).map(|s| s.to_string());

    let dev_data = body.pointer("/data/developers");
    let dev_root = body.get("developers");
    let creator = game
        .get("developers")
        .and_then(|d| d.as_array())
        .and_then(|arr| arr.first())
        .and_then(|dev_val| resolve_name(dev_val, dev_data, dev_root));

    let media_status = game
        .get("release_date")
        .and_then(|v| v.as_str())
        .map(|s| if s.is_empty() { "UPCOMING" } else { "COMPLETED" }.to_string());
    let synopsis = game.get("overview").and_then(|v| v.as_str()).map(|s| s.to_string());

    // Extract genres
    let mut genres: Vec<String> = Vec::new();
    let genres_data = body.pointer("/data/genres");
    let genres_root = body.get("genres");

    if let Some(genre_arr) = game.get("genres").and_then(|g| g.as_array()) {
        for g_val in genre_arr {
            if let Some(name) = resolve_name(g_val, genres_data, genres_root) {
                if !genres.contains(&name) {
                    genres.push(name);
                }
            }
        }
    }

    // Extract images
    let mut image_urls = extract_images(&body, game_id, false);

    // Fallback: If no images in detail response, call /Games/Images endpoint
    if image_urls.is_empty() {
        rate_limiter.acquire("thegamesdb").await;
        if let Ok(img_resp) = retry(3, || {
            let client = &client;
            async move {
                client
                    .get(format!("{}/Games/Images", BASE_URL))
                    .query(&[("apikey", key), ("games_id", id)])
                    .send()
                    .await
            }
        })
        .await
        {
            if img_resp.status().is_success() {
                if let Ok(img_body) = img_resp.json::<Value>().await {
                    image_urls = extract_images(&img_body, game_id, false);
                }
            }
        }
    }

    let images = image_urls
        .into_iter()
        .map(|url| ApiImage { url, thumbnail_b64: None })
        .collect();

    Ok(ApiMediaDetail {
        provider: "thegamesdb".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status,
        synopsis,
        duration: None,
        genres,
        credits: Vec::new(),
        images,
    })
}
