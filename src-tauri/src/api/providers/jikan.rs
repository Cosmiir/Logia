//! Jikan provider — unofficial MyAnimeList REST API (no key required).
//!
//! Docs: https://docs.api.jikan.moe/
//! Base URL: https://api.jikan.moe/v4
//!
//! Exposes separate anime/manga search and detail functions. Responses are
//! parsed flexibly with `serde_json::Value` so missing fields degrade gracefully
//! instead of failing the whole request.

use crate::api::rate_limiter::RateLimiter;
use crate::api::types::{ApiImage, ApiMediaDetail, ApiSearchResult};
use futures::future::join_all;
use serde_json::Value;
use super::{build_client, fetch_image_as_b64, retry};

const MAX_RESULTS: usize = 5;
const MAX_IMAGES: usize = 8;
const BASE_URL: &str = "https://api.jikan.moe/v4";

/// Extract a 4-digit year (YYYY) from a Jikan date/datetime string.
fn year_from_date(s: &str) -> Option<String> {
    s.get(..4).map(|y| y.to_string())
}

/// Extract a `YYYY-MM-DD` date from a Jikan ISO date/datetime string
/// (e.g. `"2011-02-07T00:00:00+00:00"` -> `"2011-02-07"`).
fn date_to_ymd(s: &str) -> Option<String> {
    if s.len() >= 10 {
        Some(s[..10].to_string())
    } else {
        None
    }
}

/// Build the image list for a detail response, deduping by URL and capping at
/// `MAX_IMAGES`. The primary poster is added first, then any `pictures[]`.
fn build_images(primary: Option<&str>, extras: &[String]) -> Vec<ApiImage> {
    let mut seen = std::collections::HashSet::new();
    let mut images = Vec::new();

    if let Some(url) = primary {
        if !url.is_empty() && seen.insert(url.to_string()) {
            images.push(ApiImage {
                url: url.to_string(),
                thumbnail_b64: None,
                kind: None,
            });
        }
    }

    for url in extras {
        if images.len() >= MAX_IMAGES {
            break;
        }
        if !url.is_empty() && seen.insert(url.clone()) {
            images.push(ApiImage {
                url: url.clone(),
                thumbnail_b64: None,
                kind: None,
            });
        }
    }

    images
}

/// Extract a large image URL from a Jikan `pictures[]` entry, tolerating a few
/// possible shapes of the payload.
fn picture_url(item: &Value) -> Option<String> {
    item.get("images")
        .and_then(|i| i.get("jpg"))
        .and_then(|j| j.get("large_image_url"))
        .and_then(|u| u.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            item.get("images")
                .and_then(|i| i.get("jpg"))
                .and_then(|j| j.get("image_url"))
                .and_then(|u| u.as_str())
                .map(|s| s.to_string())
        })
}

/// Map a Jikan anime `status` string to a Logia media status.
fn anime_status(s: &str) -> Option<String> {
    match s {
        "Finished Airing" => Some("COMPLETED".to_string()),
        "Currently Airing" => Some("ONGOING".to_string()),
        _ => None,
    }
}

/// Map a Jikan manga `status` string to a Logia media status.
fn manga_status(s: &str) -> Option<String> {
    match s {
        "Finished" => Some("COMPLETED".to_string()),
        "Publishing" => Some("ONGOING".to_string()),
        _ => None,
    }
}

/// Search MyAnimeList for anime via the Jikan v4 API.
pub async fn search_anime(
    query: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let client = build_client();
    let url = format!("{}/anime", BASE_URL);

    rate_limiter.acquire("jikan_anime").await;
    let resp = retry(3, || async {
        client
            .get(url.as_str())
            .query(&[("q", query), ("limit", "5"), ("sfw", "true")])
            .send()
            .await
    })
    .await?;

    if !resp.status().is_success() {
        return Err(format!("Jikan anime search failed: HTTP {}", resp.status()));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Jikan response: {}", e))?;

    let data = match body.get("data").and_then(|d| d.as_array()) {
        Some(arr) => arr.clone(),
        None => return Ok(vec![]),
    };

    let mut items = Vec::new();
    for item in data.iter().take(MAX_RESULTS) {
        let provider_id = item
            .get("mal_id")
            .and_then(|v| v.as_i64())
            .map(|i| i.to_string())
            .unwrap_or_default();
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let year = item
            .get("aired")
            .and_then(|a| a.get("from"))
            .and_then(|f| f.as_str())
            .and_then(year_from_date);
        let creator = item
            .get("studios")
            .and_then(|s| s.as_array())
            .and_then(|arr| arr.first())
            .and_then(|st| st.get("name"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string());
        let thumb_url = item
            .get("images")
            .and_then(|i| i.get("jpg"))
            .and_then(|j| j.get("medium_image_url"))
            .and_then(|u| u.as_str())
            .map(|s| s.to_string());

        items.push((provider_id, title, year, creator, thumb_url));
    }

    // Fetch all thumbnails concurrently rather than awaiting them one at a
    // time — with up to MAX_RESULTS items this used to serialize several
    // separate HTTP round-trips onto the search latency.
    let thumbnails = join_all(items.iter().map(|(_, _, _, _, thumb_url)| async move {
        match thumb_url {
            Some(u) => fetch_image_as_b64(u).await,
            None => None,
        }
    }))
    .await;

    let results = items
        .into_iter()
        .zip(thumbnails)
        .map(|((provider_id, title, year, creator, _), thumbnail_b64)| ApiSearchResult {
            provider: "jikan_anime".to_string(),
            provider_id,
            title,
            year,
            creator,
            thumbnail_b64,
        })
        .collect();

    Ok(results)
}

/// Search MyAnimeList for manga via the Jikan v4 API.
pub async fn search_manga(
    query: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let client = build_client();
    let url = format!("{}/manga", BASE_URL);

    rate_limiter.acquire("jikan_manga").await;
    let resp = retry(3, || async {
        client
            .get(url.as_str())
            .query(&[("q", query), ("limit", "5"), ("sfw", "true")])
            .send()
            .await
    })
    .await?;

    if !resp.status().is_success() {
        return Err(format!("Jikan manga search failed: HTTP {}", resp.status()));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Jikan response: {}", e))?;

    let data = match body.get("data").and_then(|d| d.as_array()) {
        Some(arr) => arr.clone(),
        None => return Ok(vec![]),
    };

    let mut items = Vec::new();
    for item in data.iter().take(MAX_RESULTS) {
        let provider_id = item
            .get("mal_id")
            .and_then(|v| v.as_i64())
            .map(|i| i.to_string())
            .unwrap_or_default();
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let year = item
            .get("published")
            .and_then(|p| p.get("from"))
            .and_then(|f| f.as_str())
            .and_then(year_from_date);
        let creator = item
            .get("authors")
            .and_then(|a| a.as_array())
            .and_then(|arr| arr.first())
            .and_then(|au| au.get("name"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string());
        let thumb_url = item
            .get("images")
            .and_then(|i| i.get("jpg"))
            .and_then(|j| j.get("medium_image_url"))
            .and_then(|u| u.as_str())
            .map(|s| s.to_string());

        items.push((provider_id, title, year, creator, thumb_url));
    }

    let thumbnails = join_all(items.iter().map(|(_, _, _, _, thumb_url)| async move {
        match thumb_url {
            Some(u) => fetch_image_as_b64(u).await,
            None => None,
        }
    }))
    .await;

    let results = items
        .into_iter()
        .zip(thumbnails)
        .map(|((provider_id, title, year, creator, _), thumbnail_b64)| ApiSearchResult {
            provider: "jikan_manga".to_string(),
            provider_id,
            title,
            year,
            creator,
            thumbnail_b64,
        })
        .collect();

    Ok(results)
}

/// Fetch full detail for a single anime from Jikan (`/anime/{id}/full`).
pub async fn get_detail_anime(
    id: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    let client = build_client();
    let url = format!("{}/anime/{}/full", BASE_URL, id);

    rate_limiter.acquire("jikan_anime").await;
    let resp = retry(3, || async { client.get(url.as_str()).send().await }).await?;

    if !resp.status().is_success() {
        return Err(format!("Jikan anime detail failed: HTTP {}", resp.status()));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Jikan response: {}", e))?;

    let data = match body.get("data") {
        Some(d) => d.clone(),
        None => return Err("Jikan anime detail: missing 'data' field".to_string()),
    };

    let title = data
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let release_date = data
        .get("aired")
        .and_then(|a| a.get("from"))
        .and_then(|f| f.as_str())
        .and_then(date_to_ymd);
    let creator = data
        .get("studios")
        .and_then(|s| s.as_array())
        .and_then(|arr| arr.first())
        .and_then(|st| st.get("name"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());
    let media_status = data
        .get("status")
        .and_then(|v| v.as_str())
        .and_then(anime_status);
    let synopsis = data
        .get("synopsis")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let primary_img = data
        .get("images")
        .and_then(|i| i.get("jpg"))
        .and_then(|j| j.get("large_image_url"))
        .and_then(|u| u.as_str())
        .map(|s| s.to_string());

    let mut extras: Vec<String> = Vec::new();
    if let Some(pics) = data.get("pictures").and_then(|p| p.as_array()) {
        for p in pics {
            if let Some(u) = picture_url(p) {
                extras.push(u);
            }
        }
    }

    let duration = data
        .get("episodes")
        .and_then(|v| v.as_u64())
        .map(|v| v as f64);
    let genres = extract_jikan_genres_and_tags(&data);

    let images = build_images(primary_img.as_deref(), &extras);

    Ok(ApiMediaDetail {
        provider: "jikan_anime".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status,
        synopsis,
        duration,
        genres,
        credits: vec![],
        images,
    })
}

/// Fetch full detail for a single manga from Jikan (`/manga/{id}/full`).
pub async fn get_detail_manga(
    id: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    let client = build_client();
    let url = format!("{}/manga/{}/full", BASE_URL, id);

    rate_limiter.acquire("jikan_manga").await;
    let resp = retry(3, || async { client.get(url.as_str()).send().await }).await?;

    if !resp.status().is_success() {
        return Err(format!("Jikan manga detail failed: HTTP {}", resp.status()));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Jikan response: {}", e))?;

    let data = match body.get("data") {
        Some(d) => d.clone(),
        None => return Err("Jikan manga detail: missing 'data' field".to_string()),
    };

    let title = data
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let release_date = data
        .get("published")
        .and_then(|p| p.get("from"))
        .and_then(|f| f.as_str())
        .and_then(date_to_ymd);
    let creator = data
        .get("authors")
        .and_then(|a| a.as_array())
        .and_then(|arr| arr.first())
        .and_then(|au| au.get("name"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());
    let media_status = data
        .get("status")
        .and_then(|v| v.as_str())
        .and_then(manga_status);
    let synopsis = data
        .get("synopsis")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let primary_img = data
        .get("images")
        .and_then(|i| i.get("jpg"))
        .and_then(|j| j.get("large_image_url"))
        .and_then(|u| u.as_str())
        .map(|s| s.to_string());

    let mut extras: Vec<String> = Vec::new();
    if let Some(pics) = data.get("pictures").and_then(|p| p.as_array()) {
        for p in pics {
            if let Some(u) = picture_url(p) {
                extras.push(u);
            }
        }
    }

    let duration = data
        .get("chapters")
        .or_else(|| data.get("volumes"))
        .and_then(|v| v.as_u64())
        .map(|v| v as f64);
    let genres = extract_jikan_genres_and_tags(&data);

    let images = build_images(primary_img.as_deref(), &extras);

    Ok(ApiMediaDetail {
        provider: "jikan_manga".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status,
        synopsis,
        duration,
        genres,
        credits: vec![],
        images,
    })
}

fn extract_jikan_genres_and_tags(data: &Value) -> Vec<String> {
    let mut genres = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let keys = ["genres", "themes", "demographics", "explicit_genres"];
    for key in keys {
        if let Some(arr) = data.get(key).and_then(|g| g.as_array()) {
            for item in arr {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    let trim = name.trim();
                    if !trim.is_empty() && seen.insert(trim.to_lowercase()) {
                        genres.push(trim.to_string());
                    }
                }
            }
        }
    }
    genres
}