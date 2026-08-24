use crate::api::types::{ApiCredit, ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use futures::future::join_all;

const BASE_URL: &str = "https://openlibrary.org";
const COVERS_URL: &str = "https://covers.openlibrary.org/b/id";
const MAX_RESULTS: usize = 5;
const MAX_IMAGES: usize = 8;
const MAX_CREDITS: usize = 10;

fn cover_url(id: &str, size: &str) -> String {
    format!("{}/{}-{}.jpg", COVERS_URL, id, size)
}

pub async fn search(
    query: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    rate_limiter.acquire("openlibrary").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/search.json", BASE_URL))
                .query(&[("q", query), ("limit", "5")])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("Open Library search failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let docs = body
        .get("docs")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default();

    let mut entries = Vec::new();
    for doc in docs.iter().take(MAX_RESULTS) {
        let key = doc.get("key").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let title = doc.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if title.is_empty() || key.is_empty() {
            continue;
        }
        let year = doc
            .get("first_publish_year")
            .and_then(|v| v.as_i64())
            .map(|y| y.to_string());
        let creator = doc
            .get("author_name")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .filter(|s| !s.is_empty());
        let thumb_url = doc
            .get("cover_i")
            .and_then(|v| v.as_i64())
            .map(|id| cover_url(&id.to_string(), "M"));

        entries.push((key, title, year, creator, thumb_url));
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
        .map(|((key, title, year, creator, _), thumbnail_b64)| ApiSearchResult {
            provider: "openlibrary".to_string(),
            provider_id: key,
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
    rate_limiter.acquire("openlibrary").await;
    let client = build_client();
    // id is a work key like "/works/OL12345W"
    let resp = retry(3, || {
        let client = &client;
        async move { client.get(format!("{}{}.json", BASE_URL, id)).send().await }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("Open Library detail failed: {}", resp.status()));
    }
    let work: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let title = work
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Authors: fetch first author name(s) via /authors/{key}.json
    let mut author_names: Vec<String> = Vec::new();
    if let Some(authors) = work.get("authors").and_then(|a| a.as_array()) {
        for entry in authors.iter().take(MAX_CREDITS) {
            let author_key = match entry.get("author").and_then(|a| a.get("key")).and_then(|v| v.as_str()) {
                Some(k) => k,
                None => continue,
            };
            rate_limiter.acquire("openlibrary").await;
            let aresp = retry(3, || {
                let client = &client;
                let url = format!("{}{}.json", BASE_URL, author_key);
                async move { client.get(&url).send().await }
            })
            .await;
            if let Ok(aresp) = aresp {
                if aresp.status().is_success() {
                    if let Ok(abody) = aresp.json::<serde_json::Value>().await {
                        if let Some(name) = abody.get("name").and_then(|v| v.as_str()) {
                            author_names.push(name.to_string());
                        }
                    }
                }
            }
            if author_names.len() >= MAX_CREDITS {
                break;
            }
        }
    }

    let creator = if author_names.is_empty() {
        None
    } else {
        Some(author_names.join(", "))
    };

    let synopsis = work
        .get("description")
        .and_then(|v| {
            v.as_str()
                .map(|s| s.to_string())
                .or_else(|| v.get("value").and_then(|v| v.as_str()).map(|s| s.to_string()))
        });

    let release_date = work
        .get("first_publish_date")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let genres = work
        .get("subjects")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .take(10)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let credits: Vec<ApiCredit> = author_names
        .into_iter()
        .map(|name| ApiCredit {
            name,
            role: Some("Author".to_string()),
            photo_url: None,
        })
        .collect();

    // Page count is not available on the /works/ endpoint — it's edition-specific.
    // Fetch the cover_edition (if any) to get number_of_pages.
    let mut duration: Option<f64> = None;
    if let Some(cover_edition) = work.get("cover_edition").and_then(|c| c.get("key")).and_then(|v| v.as_str()) {
        rate_limiter.acquire("openlibrary").await;
        let eresp = retry(3, || {
            let client = &client;
            let url = format!("{}{}.json", BASE_URL, cover_edition);
            async move { client.get(&url).send().await }
        })
        .await;
        if let Ok(eresp) = eresp {
            if eresp.status().is_success() {
                if let Ok(ebody) = eresp.json::<serde_json::Value>().await {
                    duration = ebody
                        .get("number_of_pages")
                        .and_then(|v| v.as_u64())
                        .map(|v| v as f64);
                }
            }
        }
    }

    let mut images: Vec<ApiImage> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    if let Some(covers) = work.get("covers").and_then(|c| c.as_array()) {
        for cid in covers.iter().filter_map(|v| v.as_i64()) {
            if images.len() >= MAX_IMAGES {
                break;
            }
            let url = cover_url(&cid.to_string(), "L");
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

    Ok(ApiMediaDetail {
        provider: "openlibrary".to_string(),
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
