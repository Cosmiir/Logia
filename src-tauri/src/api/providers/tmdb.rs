use crate::api::types::{ApiCredit, ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use futures::future::join_all;

const BASE_URL: &str = "https://api.themoviedb.org/3";
const IMG_BASE: &str = "https://image.tmdb.org/t/p";

fn minutes_to_hours_decimal(minutes: u64) -> f64 {
    let hours = minutes / 60;
    let mins = minutes % 60;
    if mins == 0 {
        hours as f64
    } else {
        format!("{}.{:02}", hours, mins).parse::<f64>().unwrap_or(minutes as f64)
    }
}

fn img_url(path: &str, size: &str) -> String {
    format!("{}{}{}", IMG_BASE, size, path)
}

/// Determine search type from provider id suffix is not used here — TMDB
/// searches multi by default. The collection mapping decides which provider
/// id is used, and TMDB covers both movies and series.
pub async fn search(
    query: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let key = api_key.ok_or("TMDB API key required")?;
    rate_limiter.acquire("tmdb").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/search/multi", BASE_URL))
                .query(&[("api_key", key), ("query", query), ("page", "1")])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("TMDB search failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let results = body.get("results").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    let mut items = Vec::new();
    for item in results.iter().take(5) {
        let media_type = item.get("media_type").and_then(|v| v.as_str()).unwrap_or("");
        if media_type != "movie" && media_type != "tv" {
            continue;
        }
        let id = item.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .or_else(|| item.get("name").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();
        if title.is_empty() {
            continue;
        }
        let year = item
            .get("release_date")
            .or_else(|| item.get("first_air_date"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.get(0..4))
            .map(|s| s.to_string());
        let creator = item
            .get("original_name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let thumb_url = item
            .get("poster_path")
            .and_then(|v| v.as_str())
            .map(|p| img_url(p, "/w92"));

        items.push((format!("{}:{}", media_type, id), title, year, creator, thumb_url));
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
        .map(|((provider_id, title, year, creator, _), thumbnail_b64)| ApiSearchResult {
            provider: "tmdb".to_string(),
            provider_id,
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
    let key = api_key.ok_or("TMDB API key required")?;
    // id format: "movie:123" or "tv:123"
    let (media_type, tmdb_id) = id
        .split_once(':')
        .ok_or("Invalid TMDB id format (expected 'type:id')")?;
    let endpoint = format!("{}/{}/{}", BASE_URL, media_type, tmdb_id);

    rate_limiter.acquire("tmdb").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        let endpoint = &endpoint;
        async move {
            client
                .get(endpoint)
                .query(&[
                    ("api_key", key),
                    ("append_to_response", "credits,images,keywords"),
                    ("include_image_language", "en,null"),
                ])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("TMDB detail failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let title = body
        .get("title")
        .and_then(|v| v.as_str())
        .or_else(|| body.get("name").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    let release_date = body
        .get("release_date")
        .or_else(|| body.get("first_air_date"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let creator = if media_type == "movie" {
        body.get("credits")
            .and_then(|c| c.get("crew"))
            .and_then(|c| c.as_array())
            .and_then(|crew| {
                crew.iter()
                    .find(|p| p.get("job").and_then(|j| j.as_str()) == Some("Director"))
                    .and_then(|d| d.get("name").and_then(|n| n.as_str()))
                    .map(|s| s.to_string())
            })
    } else {
        body.get("created_by")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|c| c.get("name").and_then(|n| n.as_str()))
            .map(|s| s.to_string())
    };
    let media_status = body
        .get("status")
        .and_then(|v| v.as_str())
        .map(|s| match s {
            "Released" | "Ended" | "Canceled" => "COMPLETED",
            "Post Production" | "Planned" => "UPCOMING",
            "Returning Series" => "ONGOING",
            _ => "ONGOING",
        }
        .to_string());
    let synopsis = body
        .get("overview")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let duration = if media_type == "movie" {
        body.get("runtime")
            .and_then(|v| v.as_u64())
            .map(minutes_to_hours_decimal)
    } else {
        body.get("number_of_episodes")
            .and_then(|v| v.as_u64())
            .map(|v| v as f64)
            .or_else(|| {
                body.get("episode_run_time")
                    .and_then(|arr| arr.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|v| v.as_u64())
                    .map(minutes_to_hours_decimal)
            })
    };

    // Extract genres and keywords (tags)
    let mut genres: Vec<String> = Vec::new();
    if let Some(genres_arr) = body.get("genres").and_then(|g| g.as_array()) {
        for item in genres_arr {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                let name_trimmed = name.trim().to_string();
                if !name_trimmed.is_empty() && !genres.contains(&name_trimmed) {
                    genres.push(name_trimmed);
                }
            }
        }
    }

    let keywords_arr = body
        .get("keywords")
        .and_then(|k| k.get("keywords").or_else(|| k.get("results")))
        .and_then(|k| k.as_array());

    if let Some(keywords) = keywords_arr {
        for item in keywords {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                let name_trimmed = name.trim().to_string();
                if !name_trimmed.is_empty() && !genres.iter().any(|g| g.eq_ignore_ascii_case(&name_trimmed)) {
                    genres.push(name_trimmed);
                }
            }
        }
    }

    // Credits: top 10 cast
    let credits = body
        .get("credits")
        .and_then(|c| c.get("cast"))
        .and_then(|c| c.as_array())
        .map(|cast| {
            cast.iter()
                .take(10)
                .filter_map(|p| {
                    let name = p.get("name").and_then(|n| n.as_str())?.to_string();
                    let role = p
                        .get("character")
                        .and_then(|c| c.as_str())
                        .map(|s| s.to_string());
                    let photo_url = p
                        .get("profile_path")
                        .and_then(|path| path.as_str())
                        .map(|path| img_url(path, "/w185"));
                    Some(ApiCredit { name, role, photo_url })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    // Images: posters + backdrops, fetched independently and tagged with `kind`
    // so the frontend can auto-assign cover (poster) and backdrop.
    // Posters use /w780 (~1080p height, under the app's 1920px storage cap).
    // Backdrops use /original (≥1920px) since /w1280 would be upscaled to
    // the app's 1920×1080 backdrop storage size.
    let mut api_images: Vec<ApiImage> = Vec::new();
    if let Some(images) = body.get("images") {
        // Posters: max 6, sorted by vote_average descending
        if let Some(posters) = images.get("posters").and_then(|p| p.as_array()) {
            let mut sorted_posters: Vec<&serde_json::Value> = posters.iter().collect();
            sorted_posters.sort_by(|a, b| {
                let va = a.get("vote_average").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let vb = b.get("vote_average").and_then(|v| v.as_f64()).unwrap_or(0.0);
                vb.partial_cmp(&va).unwrap_or(std::cmp::Ordering::Equal)
            });
            for p in sorted_posters.iter() {
                if api_images.len() >= 6 {
                    break;
                }
                if let Some(path) = p.get("file_path").and_then(|f| f.as_str()) {
                    let url = img_url(path, "/w780");
                    if !api_images.iter().any(|i| i.url == url) {
                        api_images.push(ApiImage {
                            url,
                            thumbnail_b64: None,
                            kind: Some("poster".to_string()),
                        });
                    }
                }
            }
        }
        // Backdrops: max 2, sorted by vote_average descending
        if let Some(backdrops) = images.get("backdrops").and_then(|b| b.as_array()) {
            let mut sorted_backdrops: Vec<&serde_json::Value> = backdrops.iter().collect();
            sorted_backdrops.sort_by(|a, b| {
                let va = a.get("vote_average").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let vb = b.get("vote_average").and_then(|v| v.as_f64()).unwrap_or(0.0);
                vb.partial_cmp(&va).unwrap_or(std::cmp::Ordering::Equal)
            });
            for b in sorted_backdrops.iter() {
                if api_images.iter().filter(|i| i.kind.as_deref() == Some("backdrop")).count() >= 2 {
                    break;
                }
                if let Some(path) = b.get("file_path").and_then(|f| f.as_str()) {
                    let url = img_url(path, "/original");
                    if !api_images.iter().any(|i| i.url == url) {
                        api_images.push(ApiImage {
                            url,
                            thumbnail_b64: None,
                            kind: Some("backdrop".to_string()),
                        });
                    }
                }
            }
        }
    }
    // Fallback: poster_path from main body
    if api_images.is_empty() {
        if let Some(path) = body.get("poster_path").and_then(|p| p.as_str()) {
            api_images.push(ApiImage {
                url: img_url(path, "/w780"),
                thumbnail_b64: None,
                kind: Some("poster".to_string()),
            });
        }
    }
    let images = api_images;

    Ok(ApiMediaDetail {
        provider: "tmdb".to_string(),
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