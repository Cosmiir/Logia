use crate::api::types::{ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};

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

    let mut out = Vec::new();
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
        let creator = None;
        let thumb = item.get("background_image").and_then(|v| v.as_str());
        let thumbnail_b64 = if let Some(url) = thumb {
            // Use a smaller version by replacing the width param
            let small_url = url.replace("/media/", "/media/crop/92x92/");
            fetch_image_as_b64(&small_url).await.or_else(|| {
                let _ = url;
                None
            })
        } else {
            None
        };
        out.push(ApiSearchResult {
            provider: "rawg".to_string(),
            provider_id: id.to_string(),
            title,
            year,
            creator,
            thumbnail_b64,
        });
    }
    Ok(out)
}

pub async fn get_detail(
    id: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    let key = api_key.ok_or("RAWG API key required")?;
    rate_limiter.acquire("rawg").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/games/{}", BASE_URL, id))
                .query(&[("key", key)])
                .send()
                .await
        }
    })
    .await?;
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

    // Images: background_image + screenshots
    let mut image_urls: Vec<String> = Vec::new();
    if let Some(bg) = body.get("background_image").and_then(|v| v.as_str()) {
        image_urls.push(bg.to_string());
    }
    // RAWG screenshots require a separate API call to /games/{id}/screenshots
    // but we can also use background_image_additional which is sometimes present
    if image_urls.len() < 8 {
        rate_limiter.acquire("rawg").await;
        if let Ok(ss_resp) = retry(3, || {
            let client = &client;
            async move {
                client
                    .get(format!("{}/games/{}/screenshots", BASE_URL, id))
                    .query(&[("key", key)])
                    .send()
                    .await
            }
        })
        .await
        {
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
