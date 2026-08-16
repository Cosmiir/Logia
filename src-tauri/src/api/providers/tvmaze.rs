use crate::api::types::{ApiSearchResult, ApiMediaDetail, ApiImage, ApiCredit};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};

const BASE_URL: &str = "https://api.tvmaze.com";
const MAX_RESULTS: usize = 5;
const MAX_IMAGES: usize = 8;
const MAX_CREDITS: usize = 10;

pub async fn search(
    query: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    rate_limiter.acquire("tvmaze").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/search/shows", BASE_URL))
                .query(&[("q", query)])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("TVMaze search failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let arr = body.as_array().cloned().unwrap_or_default();

    let mut out = Vec::new();
    for entry in arr.iter().take(MAX_RESULTS) {
        let show = match entry.get("show") {
            Some(s) => s,
            None => continue,
        };
        let id = show
            .get("id")
            .and_then(|v| v.as_i64())
            .unwrap_or(0)
            .to_string();
        let title = show
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if title.is_empty() || id.is_empty() {
            continue;
        }
        let year = show
            .get("premiered")
            .and_then(|v| v.as_str())
            .and_then(|s| s.get(..4))
            .map(|s| s.to_string());
        let creator = show
            .get("network")
            .and_then(|n| n.get("name"))
            .and_then(|v| v.as_str())
            .or_else(|| {
                show.get("webChannel")
                    .and_then(|n| n.get("name"))
                    .and_then(|v| v.as_str())
            })
            .map(|s| s.to_string());
        let thumb_url = show
            .get("image")
            .and_then(|i| i.get("medium"))
            .and_then(|v| v.as_str());
        let thumbnail_b64 = if let Some(url) = thumb_url {
            fetch_image_as_b64(url).await
        } else {
            None
        };
        out.push(ApiSearchResult {
            provider: "tvmaze".to_string(),
            provider_id: id,
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
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    rate_limiter.acquire("tvmaze").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/shows/{}", BASE_URL, id))
                .query(&[("embed[]", "cast"), ("embed[]", "episodes")])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("TVMaze detail failed: {}", resp.status()));
    }
    let show: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let title = show
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let release_date = show
        .get("premiered")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let creator = show
        .get("network")
        .and_then(|n| n.get("name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let media_status = show
        .get("status")
        .and_then(|v| v.as_str())
        .and_then(|s| match s {
            "Running" => Some("ONGOING".to_string()),
            "Ended" => Some("COMPLETED".to_string()),
            "To Be Determined" => Some("UPCOMING".to_string()),
            _ => None,
        });
    let synopsis = show
        .get("summary")
        .and_then(|v| v.as_str())
        .map(|s| strip_html_tags(s));

    // Credits from embedded cast (max 10)
    let mut credits: Vec<ApiCredit> = Vec::new();
    if let Some(cast) = show
        .get("_embedded")
        .and_then(|e| e.get("cast"))
        .and_then(|c| c.as_array())
    {
        for entry in cast.iter().take(MAX_CREDITS) {
            let name = entry
                .get("person")
                .and_then(|p| p.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }
            let role = entry
                .get("character")
                .and_then(|c| c.get("name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let photo_url = entry
                .get("person")
                .and_then(|p| p.get("image"))
                .and_then(|i| i.get("medium").or_else(|| i.get("original")))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            credits.push(ApiCredit { name, role, photo_url });
        }
    }

    let duration = show
        .get("_embedded")
        .and_then(|e| e.get("episodes"))
        .and_then(|arr| arr.as_array())
        .map(|arr| arr.len() as f64)
        .or_else(|| {
            show.get("runtime")
                .or_else(|| show.get("averageRuntime"))
                .and_then(|v| v.as_u64())
                .map(|v| v as f64)
        });

    let genres = show
        .get("genres")
        .and_then(|g| g.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    // Images from image.medium + image.original (max 8, dedup by URL)
    let mut images: Vec<ApiImage> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    if let Some(img) = show.get("image") {
        for key in &["medium", "original"] {
            if images.len() >= MAX_IMAGES {
                break;
            }
            if let Some(url) = img.get(*key).and_then(|v| v.as_str()) {
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
    }

    Ok(ApiMediaDetail {
        provider: "tvmaze".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status,
        synopsis,
        duration,
        genres,
        credits,
        images,
    })
}

/// Remove HTML tags from a string by stripping anything between `<` and `>`.
fn strip_html_tags(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    result.trim().to_string()
}
