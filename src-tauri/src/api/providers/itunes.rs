use crate::api::types::{ApiSearchResult, ApiMediaDetail, ApiImage};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use futures::future::join_all;

const BASE_URL: &str = "https://itunes.apple.com";
const MAX_RESULTS: usize = 5;
const MAX_IMAGES: usize = 8;

pub async fn search(
    query: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    rate_limiter.acquire("itunes").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/search", BASE_URL))
                .query(&[
                    ("term", query),
                    ("media", "music"),
                    ("entity", "album"),
                    ("limit", "5"),
                ])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("iTunes search failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let results = body
        .get("results")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();

    let mut items = Vec::new();
    for item in results.iter().take(MAX_RESULTS) {
        let id = item
            .get("trackId")
            .or_else(|| item.get("collectionId"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0)
            .to_string();
        let title = item
            .get("collectionName")
            .or_else(|| item.get("trackName"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if title.is_empty() || id.is_empty() {
            continue;
        }
        let year = item
            .get("releaseDate")
            .and_then(|v| v.as_str())
            .and_then(|s| s.get(..4))
            .map(|s| s.to_string());
        let creator = item
            .get("artistName")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let thumb_url = item
            .get("artworkUrl100")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        items.push((id, title, year, creator, thumb_url));
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
            provider: "itunes".to_string(),
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
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    rate_limiter.acquire("itunes").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/lookup", BASE_URL))
                .query(&[("id", id), ("entity", "song")])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("iTunes detail failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let results = body.get("results").and_then(|r| r.as_array());
    // First result is always the collection (album) itself; entity=song adds
    // the individual tracks after it, which is where trackTimeMillis lives.
    let item = match results.and_then(|a| a.first()) {
        Some(i) => i,
        None => return Err("iTunes: no results found".to_string()),
    };

    let title = item
        .get("collectionName")
        .or_else(|| item.get("trackName"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let release_date = item
        .get("releaseDate")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let creator = item
        .get("artistName")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let synopsis = item
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Images from artworkUrl100 and artworkUrl600 (max 8, dedup by URL)
    let mut images: Vec<ApiImage> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for key in &["artworkUrl100", "artworkUrl600"] {
        if images.len() >= MAX_IMAGES {
            break;
        }
        if let Some(url) = item.get(*key).and_then(|v| v.as_str()) {
            if seen.contains(url) {
                continue;
            }
            seen.insert(url.to_string());
            images.push(ApiImage {
                url: url.to_string(),
                thumbnail_b64: None,
            });
        }
    }

    // Sum trackTimeMillis across the song entries (skip index 0, the album
    // itself, which never carries this field).
    let duration = results
        .map(|arr| {
            arr.iter()
                .skip(1)
                .filter_map(|t| t.get("trackTimeMillis").and_then(|v| v.as_u64()))
                .sum::<u64>()
        })
        .filter(|&total_ms| total_ms > 0)
        .map(|ms| {
            let total_mins = ms / 60_000;
            let hours = total_mins / 60;
            let mins = total_mins % 60;
            if mins == 0 {
                hours as f64
            } else {
                format!("{}.{:02}", hours, mins).parse::<f64>().unwrap_or(total_mins as f64)
            }
        });
    let genres = item
        .get("primaryGenreName")
        .and_then(|v| v.as_str())
        .map(|g| vec![g.to_string()])
        .unwrap_or_default();

    Ok(ApiMediaDetail {
        provider: "itunes".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status: None,
        synopsis,
        duration,
        genres,
        credits: vec![],
        images,
    })
}