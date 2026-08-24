use crate::api::types::{ApiCredit, ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use futures::future::join_all;

const BASE_URL: &str = "https://www.omdbapi.com";

pub async fn search(
    query: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let key = api_key.ok_or("OMDb API key required")?;
    rate_limiter.acquire("omdb").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(BASE_URL)
                .query(&[("apikey", key), ("s", query), ("type", "movie")])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("OMDb search failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if body.get("Response").and_then(|r| r.as_str()) == Some("False") {
        return Ok(vec![]);
    }
    let results = body
        .get("Search")
        .and_then(|s| s.as_array())
        .cloned()
        .unwrap_or_default();

    let mut items = Vec::new();
    for item in results.iter().take(5) {
        let id = item.get("imdbID").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let title = item.get("Title").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if title.is_empty() || id.is_empty() {
            continue;
        }
        let year = item.get("Year").and_then(|v| v.as_str()).map(|s| s.to_string());
        // OMDb search doesn't return director — will be fetched in detail
        let creator: Option<String> = None;
        let thumb_url = item
            .get("Poster")
            .and_then(|v| v.as_str())
            .filter(|s| *s != "N/A")
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
            provider: "omdb".to_string(),
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
    let key = api_key.ok_or("OMDb API key required")?;
    rate_limiter.acquire("omdb").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(BASE_URL)
                .query(&[("apikey", key), ("i", id), ("plot", "full")])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("OMDb detail failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if body.get("Response").and_then(|r| r.as_str()) == Some("False") {
        return Err("OMDb: title not found".to_string());
    }

    let title = body.get("Title").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let release_date = body.get("Released").and_then(|v| v.as_str()).map(|s| {
        // OMDb format: "15 Jul 2010" → try to parse to YYYY-MM-DD, else keep as-is
        parse_omdb_date(s)
    });
    let creator = body
        .get("Director")
        .and_then(|v| v.as_str())
        .filter(|s| *s != "N/A")
        .map(|s| s.to_string());
    let media_status = body.get("Type").and_then(|v| v.as_str()).map(|t| {
        // OMDb doesn't have a real status; "movie" is always completed
        if t == "movie" {
            "COMPLETED".to_string()
        } else {
            "ONGOING".to_string()
        }
    });
    let synopsis = body
        .get("Plot")
        .and_then(|v| v.as_str())
        .filter(|s| *s != "N/A")
        .map(|s| s.to_string());

    // Credits: actors + writer + director
    let mut credits: Vec<ApiCredit> = Vec::new();
    if let Some(director) = body.get("Director").and_then(|v| v.as_str()).filter(|s| *s != "N/A") {
        for name in director.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
            credits.push(ApiCredit {
                name: name.to_string(),
                role: Some("Director".to_string()),
                photo_url: None,
            });
            if credits.len() >= 10 {
                break;
            }
        }
    }
    if credits.len() < 10 {
        if let Some(actors) = body.get("Actors").and_then(|v| v.as_str()).filter(|s| *s != "N/A") {
            for name in actors.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
                credits.push(ApiCredit {
                    name: name.to_string(),
                    role: Some("Actor".to_string()),
                    photo_url: None,
                });
                if credits.len() >= 10 {
                    break;
                }
            }
        }
    }

    let duration = body
        .get("Runtime")
        .and_then(|v| v.as_str())
        .and_then(|s| {
            s.split_whitespace()
                .next()
                .and_then(|num| num.parse::<u64>().ok())
        })
        .map(|mins| {
            let hours = mins / 60;
            let m = mins % 60;
            if m == 0 {
                hours as f64
            } else {
                format!("{}.{:02}", hours, m).parse::<f64>().unwrap_or(mins as f64)
            }
        });

    let genres = body
        .get("Genre")
        .and_then(|v| v.as_str())
        .filter(|s| *s != "N/A")
        .map(|s| s.split(',').map(|g| g.trim().to_string()).collect())
        .unwrap_or_default();

    // Images: OMDb only has Poster (single image)
    let images = body
        .get("Poster")
        .and_then(|v| v.as_str())
        .filter(|s| *s != "N/A")
        .map(|url| vec![ApiImage { url: url.to_string(), thumbnail_b64: None, kind: None }])
        .unwrap_or_default();

    Ok(ApiMediaDetail {
        provider: "omdb".to_string(),
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

fn parse_omdb_date(s: &str) -> String {
    // OMDb format: "15 Jul 2010"
    let months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() == 3 {
        let day = parts[0].trim_start_matches('0');
        let month_idx = months.iter().position(|m| *m == parts[1]);
        let year = parts[2];
        if let Some(idx) = month_idx {
            return format!("{}-{:02}-{}", year, idx + 1, day);
        }
    }
    s.to_string()
}