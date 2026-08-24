use crate::api::types::{ApiCredit, ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use futures::future::join_all;

const BASE_URL: &str = "https://www.googleapis.com/books/v1";
const MAX_RESULTS: usize = 5;
const MAX_IMAGES: usize = 8;
const MAX_CREDITS: usize = 10;

pub async fn search(
    query: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let key = api_key.ok_or("Google Books API key required")?;
    rate_limiter.acquire("google_books").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/volumes", BASE_URL))
                .query(&[("q", query), ("maxResults", "5"), ("key", key)])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).map(|s| s.to_string()))
            .unwrap_or(body.chars().take(200).collect());
        return Err(format!("Google Books search failed: {} — {}", status, msg));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let items = body
        .get("items")
        .and_then(|i| i.as_array())
        .cloned()
        .unwrap_or_default();

    let mut entries = Vec::new();
    for item in items.iter().take(MAX_RESULTS) {
        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let vi = match item.get("volumeInfo") {
            Some(v) => v,
            None => continue,
        };
        let title = vi.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if title.is_empty() || id.is_empty() {
            continue;
        }
        let year = vi
            .get("publishedDate")
            .and_then(|v| v.as_str())
            .and_then(|s| s.get(..4))
            .map(|s| s.to_string());
        let creator = vi
            .get("authors")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .filter(|s| !s.is_empty());
        let thumb_url = vi
            .get("imageLinks")
            .and_then(|i| {
                i.get("thumbnail")
                    .or_else(|| i.get("smallThumbnail"))
                    .or_else(|| i.get("small"))
                    .or_else(|| i.get("medium"))
            })
            .and_then(|v| v.as_str())
            .map(|s| s.replace("http://", "https://"));

        entries.push((id, title, year, creator, thumb_url));
    }

    let thumbnails = join_all(entries.iter().map(|(_, _, _, _, thumb_url)| async move {
        match thumb_url {
            Some(u) => fetch_image_as_b64(u).await,
            None => None,
        }
    }))
    .await;

    let out = entries
        .into_iter()
        .zip(thumbnails)
        .map(|((id, title, year, creator, _), thumbnail_b64)| ApiSearchResult {
            provider: "google_books".to_string(),
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
    let key = api_key.ok_or("Google Books API key required")?;
    rate_limiter.acquire("google_books").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/volumes/{}", BASE_URL, id))
                .query(&[("key", key)])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).map(|s| s.to_string()))
            .unwrap_or(body.chars().take(200).collect());
        return Err(format!("Google Books detail failed: {} — {}", status, msg));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let vi = body.get("volumeInfo").cloned().unwrap_or_default();

    let title = vi.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let release_date = vi
        .get("publishedDate")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let creator = vi
        .get("authors")
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|s| !s.is_empty());
    let synopsis = vi
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let duration = vi
        .get("pageCount")
        .and_then(|v| v.as_u64())
        .map(|v| v as f64);

    let genres = vi
        .get("categories")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let mut credits: Vec<ApiCredit> = Vec::new();
    if let Some(authors) = vi.get("authors").and_then(|a| a.as_array()) {
        for name in authors.iter().filter_map(|v| v.as_str()) {
            if name.is_empty() {
                continue;
            }
            credits.push(ApiCredit {
                name: name.to_string(),
                role: Some("Author".to_string()),
                photo_url: None,
            });
            if credits.len() >= MAX_CREDITS {
                break;
            }
        }
    }

    let mut images: Vec<ApiImage> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    if let Some(img) = vi.get("imageLinks") {
        for key in &["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"] {
            if images.len() >= MAX_IMAGES {
                break;
            }
            if let Some(url) = img.get(*key).and_then(|v| v.as_str()) {
                let url = url.replace("http://", "https://");
                if seen.contains(&url) {
                    continue;
                }
                seen.insert(url.clone());
                images.push(ApiImage {
                    url,
                    thumbnail_b64: None,
                    kind: None,
                });
            }
        }
    }

    Ok(ApiMediaDetail {
        provider: "google_books".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status: None,
        synopsis,
        duration,
        genres,
        credits,
        images,
    })
}
