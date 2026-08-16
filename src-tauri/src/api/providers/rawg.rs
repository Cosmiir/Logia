use crate::api::types::{ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use futures::future::join_all;

const BASE_URL: &str = "https://api.rawg.io/api";

pub async fn search(
    query: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let key = api_key.ok_or("RAWG API key required")?;
    rate_limiter.acquire("rawg").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/games", BASE_URL))
                .query(&[("key", key), ("search", query), ("page_size", "5")])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("RAWG search failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let results = body
        .get("results")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();

    let mut items = Vec::new();
    for item in results.iter().take(5) {
        let id = item.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let title = item.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if title.is_empty() {
            continue;
        }
        let year = item
            .get("released")
            .and_then(|v| v.as_str())
            .and_then(|s| s.get(0..4))
            .map(|s| s.to_string());
        // Developers are not in search results — fetched in detail
        let creator: Option<String> = None;
        let thumb_url = item
            .get("background_image")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        items.push((id.to_string(), title, year, creator, thumb_url));
    }

    // Fetch thumbnails concurrently instead of one at a time. Each one tries
    // a small cropped version first and falls back to the original
    // full-size image if the CDN rejects the crop path — the previous
    // `.or_else(...)` here was a no-op (`Option::or_else` can't run async
    // code), so a failed crop silently lost the thumbnail entirely instead
    // of retrying with the original URL.
    let thumbnails = join_all(items.iter().map(|(_, _, _, _, thumb_url)| async move {
        let url = match thumb_url {
            Some(u) => u,
            None => return None,
        };
        let small_url = url.replace("/media/", "/media/crop/92x92/");
        if let Some(b64) = fetch_image_as_b64(&small_url).await {
            return Some(b64);
        }
        fetch_image_as_b64(url).await
    }))
    .await;

    let out = items
        .into_iter()
        .zip(thumbnails)
        .map(|((id, title, year, creator, _), thumbnail_b64)| ApiSearchResult {
            provider: "rawg".to_string(),
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
    let key = api_key.ok_or("RAWG API key required")?;
    let client = build_client();

    // RAWG has no way to include screenshots in the main game payload, so it
    // takes two requests either way. Fire them concurrently instead of
    // sequentially — this cuts the network latency of a RAWG detail fetch
    // roughly in half compared to awaiting the game detail before even
    // starting the screenshots request.
    rate_limiter.acquire("rawg").await;
    let detail_future = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/games/{}", BASE_URL, id))
                .query(&[("key", key)])
                .send()
                .await
        }
    });

    rate_limiter.acquire("rawg").await;
    let screenshots_future = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/games/{}/screenshots", BASE_URL, id))
                .query(&[("key", key)])
                .send()
                .await
        }
    });

    let (resp_res, ss_res) = futures::join!(detail_future, screenshots_future);

    let resp = resp_res?;
    if !resp.status().is_success() {
        return Err(format!("RAWG detail failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let title = body.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let release_date = body.get("released").and_then(|v| v.as_str()).map(|s| s.to_string());
    let creator = body
        .get("developers")
        .and_then(|d| d.as_array())
        .and_then(|arr| arr.first())
        .and_then(|d| d.get("name").and_then(|n| n.as_str()))
        .map(|s| s.to_string());
    let media_status = body
        .get("released")
        .and_then(|v| v.as_str())
        .map(|s| if s.is_empty() { "UPCOMING" } else { "COMPLETED" }.to_string());
    let synopsis = body
        .get("description_raw")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("description").and_then(|v| v.as_str()))
        .map(|s| strip_html(s));

    // Images: background_image + screenshots (screenshots come from the
    // request fired in parallel above; a failure there just means we fall
    // back to whatever background_image gave us, same as before).
    let mut image_urls: Vec<String> = Vec::new();
    if let Some(bg) = body.get("background_image").and_then(|v| v.as_str()) {
        image_urls.push(bg.to_string());
    }
    if let Ok(ss_resp) = ss_res {
        if ss_resp.status().is_success() {
            if let Ok(ss_body) = ss_resp.json::<serde_json::Value>().await {
                if let Some(results) = ss_body.get("results").and_then(|r| r.as_array()) {
                    for ss in results.iter() {
                        if image_urls.len() >= 8 {
                            break;
                        }
                        if let Some(url) = ss.get("image").and_then(|i| i.as_str()) {
                            if !image_urls.contains(&url.to_string()) {
                                image_urls.push(url.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    let duration = body
        .get("playtime")
        .and_then(|v| v.as_u64())
        .map(|v| v as f64);

    let mut genres: Vec<String> = Vec::new();
    let mut seen_genres = std::collections::HashSet::new();

    if let Some(arr) = body.get("genres").and_then(|g| g.as_array()) {
        for item in arr {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                let trim = name.trim();
                if !trim.is_empty() && seen_genres.insert(trim.to_lowercase()) {
                    genres.push(trim.to_string());
                }
            }
        }
    }
    if let Some(arr) = body.get("tags").and_then(|t| t.as_array()) {
        for item in arr {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                let trim = name.trim();
                if !trim.is_empty() && seen_genres.insert(trim.to_lowercase()) {
                    genres.push(trim.to_string());
                }
            }
        }
    }

    let images = image_urls
        .into_iter()
        .map(|url| ApiImage { url, thumbnail_b64: None })
        .collect();

    Ok(ApiMediaDetail {
        provider: "rawg".to_string(),
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

fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            out.push(ch);
        }
    }
    out
}