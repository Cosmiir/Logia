//! AniList provider — GraphQL API for anime/manga (no key required).
//!
//! Docs: https://docs.anilist.co/
//! Endpoint: https://graphql.anilist.co
//!
//! All requests are POST with a JSON body `{"query": "...", "variables": {...}}`.
//! Responses are parsed flexibly with `serde_json::Value` so missing fields
//! degrade gracefully instead of failing the whole request.

use crate::api::rate_limiter::RateLimiter;
use crate::api::types::{ApiImage, ApiMediaDetail, ApiSearchResult};
use futures::future::join_all;
use serde_json::{json, Value};
use super::{build_client, fetch_image_as_b64, retry};

const MAX_RESULTS: usize = 5;
const MAX_IMAGES: usize = 8;
const GRAPHQL_URL: &str = "https://graphql.anilist.co";

/// GraphQL query for searching anime (studios as creator).
const ANIME_SEARCH_QUERY: &str = r#"
query ($search: String, $type: MediaType) {
  Page(perPage: 5) {
    media(search: $search, type: $type) {
      id
      title { romaji english native }
      seasonYear
      studios(isMain: true) { nodes { name } }
      coverImage { medium }
    }
  }
}
"#;

/// GraphQL query for searching manga (staff as creator).
const MANGA_SEARCH_QUERY: &str = r#"
query ($search: String, $type: MediaType) {
  Page(perPage: 5) {
    media(search: $search, type: $type) {
      id
      title { romaji english native }
      seasonYear
      staff { edges { node { name { full } } } }
      coverImage { medium }
    }
  }
}
"#;

/// GraphQL query for fetching a single anime by id.
const ANIME_DETAIL_QUERY: &str = r#"
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    startDate { year month day }
    status
    description
    episodes
    genres
    tags { name }
    studios(isMain: true) { nodes { name } }
    characters(perPage: 10, sort: [ROLE, RELEVANCE]) {
      edges {
        role
        node {
          name { full }
          image { large }
        }
      }
    }
    coverImage { large extraLarge }
    bannerImage
  }
}
"#;

/// GraphQL query for fetching a single manga by id.
const MANGA_DETAIL_QUERY: &str = r#"
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    title { romaji english native }
    startDate { year month day }
    status
    description
    chapters
    volumes
    genres
    tags { name }
    staff(perPage: 10) {
      edges {
        role
        node {
          name { full }
          image { large }
        }
      }
    }
    coverImage { large extraLarge }
    bannerImage
  }
}
"#;

/// Strip HTML tags from an AniList description, converting `<br>` to newlines.
fn strip_html_tags(s: &str) -> String {
    let s = s
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n");

    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            out.push(c);
        }
    }
    out
}

/// Pick the best available title from an AniList `title` object
/// (romaji > english > native > "").
fn anilist_title(obj: &Value) -> String {
    obj.get("romaji")
        .and_then(|v| v.as_str())
        .or_else(|| obj.get("english").and_then(|v| v.as_str()))
        .or_else(|| obj.get("native").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string()
}

/// Build a `YYYY-MM-DD` (or partial) release date from an AniList `startDate`.
fn anilist_start_date(obj: &Value) -> Option<String> {
    let year = obj.get("year").and_then(|v| v.as_i64());
    let month = obj.get("month").and_then(|v| v.as_i64());
    let day = obj.get("day").and_then(|v| v.as_i64());
    match (year, month, day) {
        (Some(y), Some(m), Some(d)) => Some(format!("{}-{:02}-{:02}", y, m, d)),
        (Some(y), Some(m), None) => Some(format!("{}-{:02}", y, m)),
        (Some(y), None, None) => Some(format!("{}", y)),
        _ => None,
    }
}

/// Map an AniList `status` string to a Logia media status.
fn anilist_status(s: &str) -> Option<String> {
    match s {
        "FINISHED" => Some("COMPLETED".to_string()),
        "RELEASING" => Some("ONGOING".to_string()),
        "NOT_YET_RELEASED" => Some("UPCOMING".to_string()),
        _ => None,
    }
}

/// Build the image list for a detail response, deduping by URL and capping at
/// `MAX_IMAGES`. The cover image is added first, then the banner.
fn build_images(cover: Option<&str>, banner: Option<&str>) -> Vec<ApiImage> {
    let mut seen = std::collections::HashSet::new();
    let mut images = Vec::new();

    for url in [cover, banner].into_iter().flatten() {
        if images.len() >= MAX_IMAGES {
            break;
        }
        if !url.is_empty() && seen.insert(url.to_string()) {
            images.push(ApiImage {
                url: url.to_string(),
                thumbnail_b64: None,
                kind: None,
            });
        }
    }

    images
}

/// Extract the main studio name from an AniList anime media node.
fn anime_creator(media: &Value) -> Option<String> {
    media
        .get("studios")
        .and_then(|s| s.get("nodes"))
        .and_then(|n| n.as_array())
        .and_then(|arr| arr.first())
        .and_then(|node| node.get("name"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string())
}

/// Extract the first staff/author name from an AniList manga media node.
fn manga_creator(media: &Value) -> Option<String> {
    media
        .get("staff")
        .and_then(|s| s.get("edges"))
        .and_then(|e| e.as_array())
        .and_then(|arr| arr.first())
        .and_then(|edge| edge.get("node"))
        .and_then(|n| n.get("name"))
        .and_then(|n| n.get("full"))
        .and_then(|f| f.as_str())
        .map(|s| s.to_string())
}

/// Extract the best cover image URL from an AniList `coverImage` object.
fn cover_large(obj: &Value) -> Option<String> {
    obj.get("extraLarge")
        .and_then(|v| v.as_str())
        .or_else(|| obj.get("large").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
}

/// Search AniList for anime.
pub async fn search_anime(
    query: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let client = build_client();
    let body = json!({
        "query": ANIME_SEARCH_QUERY,
        "variables": { "search": query, "type": "ANIME" }
    });

    rate_limiter.acquire("anilist_anime").await;
    let resp = retry(3, || async { client.post(GRAPHQL_URL).json(&body).send().await }).await?;

    if !resp.status().is_success() {
        return Err(format!("AniList anime search failed: HTTP {}", resp.status()));
    }

    let resp_body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse AniList response: {}", e))?;

    let media = match resp_body
        .get("data")
        .and_then(|d| d.get("Page"))
        .and_then(|p| p.get("media"))
        .and_then(|m| m.as_array())
    {
        Some(arr) => arr.clone(),
        None => return Ok(vec![]),
    };

    let mut items = Vec::new();
    for item in media.iter().take(MAX_RESULTS) {
        let provider_id = item
            .get("id")
            .and_then(|v| v.as_i64())
            .map(|i| i.to_string())
            .unwrap_or_default();
        let title = item
            .get("title")
            .map(anilist_title)
            .unwrap_or_default();
        let year = item
            .get("seasonYear")
            .and_then(|v| v.as_i64())
            .map(|y| y.to_string());
        let creator = anime_creator(item);
        let thumb_url = item
            .get("coverImage")
            .and_then(|c| c.get("medium"))
            .and_then(|m| m.as_str())
            .map(|s| s.to_string());

        items.push((provider_id, title, year, creator, thumb_url));
    }

    // Fetch thumbnails concurrently instead of one at a time.
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
            provider: "anilist_anime".to_string(),
            provider_id,
            title,
            year,
            creator,
            thumbnail_b64,
        })
        .collect();

    Ok(results)
}

/// Search AniList for manga.
pub async fn search_manga(
    query: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let client = build_client();
    let body = json!({
        "query": MANGA_SEARCH_QUERY,
        "variables": { "search": query, "type": "MANGA" }
    });

    rate_limiter.acquire("anilist_manga").await;
    let resp = retry(3, || async { client.post(GRAPHQL_URL).json(&body).send().await }).await?;

    if !resp.status().is_success() {
        return Err(format!("AniList manga search failed: HTTP {}", resp.status()));
    }

    let resp_body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse AniList response: {}", e))?;

    let media = match resp_body
        .get("data")
        .and_then(|d| d.get("Page"))
        .and_then(|p| p.get("media"))
        .and_then(|m| m.as_array())
    {
        Some(arr) => arr.clone(),
        None => return Ok(vec![]),
    };

    let mut items = Vec::new();
    for item in media.iter().take(MAX_RESULTS) {
        let provider_id = item
            .get("id")
            .and_then(|v| v.as_i64())
            .map(|i| i.to_string())
            .unwrap_or_default();
        let title = item
            .get("title")
            .map(anilist_title)
            .unwrap_or_default();
        let year = item
            .get("seasonYear")
            .and_then(|v| v.as_i64())
            .map(|y| y.to_string());
        let creator = manga_creator(item);
        let thumb_url = item
            .get("coverImage")
            .and_then(|c| c.get("medium"))
            .and_then(|m| m.as_str())
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
            provider: "anilist_manga".to_string(),
            provider_id,
            title,
            year,
            creator,
            thumbnail_b64,
        })
        .collect();

    Ok(results)
}

/// Fetch full detail for a single anime from AniList.
pub async fn get_detail_anime(
    id: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    let id_num: i64 = id
        .parse()
        .map_err(|_| format!("Invalid AniList id: {}", id))?;

    let client = build_client();
    let body = json!({
        "query": ANIME_DETAIL_QUERY,
        "variables": { "id": id_num }
    });

    rate_limiter.acquire("anilist_anime").await;
    let resp = retry(3, || async { client.post(GRAPHQL_URL).json(&body).send().await }).await?;

    if !resp.status().is_success() {
        return Err(format!("AniList anime detail failed: HTTP {}", resp.status()));
    }

    let resp_body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse AniList response: {}", e))?;

    let media = match resp_body.get("data").and_then(|d| d.get("Media")) {
        Some(m) => m.clone(),
        None => return Err("AniList anime detail: missing 'Media' field".to_string()),
    };

    let title = media.get("title").map(anilist_title).unwrap_or_default();
    let release_date = media
        .get("startDate")
        .and_then(anilist_start_date);
    let creator = anime_creator(&media);
    let media_status = media
        .get("status")
        .and_then(|v| v.as_str())
        .and_then(anilist_status);
    let synopsis = media
        .get("description")
        .and_then(|v| v.as_str())
        .map(strip_html_tags);

    let cover = media
        .get("coverImage")
        .and_then(cover_large);
    let banner = media
        .get("bannerImage")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let duration = media
        .get("episodes")
        .and_then(|v| v.as_u64())
        .map(|v| v as f64);
    let genres = extract_anilist_genres_and_tags(&media);
    let credits = extract_anilist_credits(&media);
    let images = build_images(cover.as_deref(), banner.as_deref());

    Ok(ApiMediaDetail {
        provider: "anilist_anime".to_string(),
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

/// Fetch full detail for a single manga from AniList.
pub async fn get_detail_manga(
    id: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    let id_num: i64 = id
        .parse()
        .map_err(|_| format!("Invalid AniList id: {}", id))?;

    let client = build_client();
    let body = json!({
        "query": MANGA_DETAIL_QUERY,
        "variables": { "id": id_num }
    });

    rate_limiter.acquire("anilist_manga").await;
    let resp = retry(3, || async { client.post(GRAPHQL_URL).json(&body).send().await }).await?;

    if !resp.status().is_success() {
        return Err(format!("AniList manga detail failed: HTTP {}", resp.status()));
    }

    let resp_body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse AniList response: {}", e))?;

    let media = match resp_body.get("data").and_then(|d| d.get("Media")) {
        Some(m) => m.clone(),
        None => return Err("AniList manga detail: missing 'Media' field".to_string()),
    };

    let title = media.get("title").map(anilist_title).unwrap_or_default();
    let release_date = media.get("startDate").and_then(anilist_start_date);
    let creator = manga_creator(&media);
    let media_status = media
        .get("status")
        .and_then(|v| v.as_str())
        .and_then(anilist_status);
    let synopsis = media
        .get("description")
        .and_then(|v| v.as_str())
        .map(strip_html_tags);

    let duration = media
        .get("chapters")
        .or_else(|| media.get("volumes"))
        .and_then(|v| v.as_u64())
        .map(|v| v as f64);
    let genres = extract_anilist_genres_and_tags(&media);
    let credits = extract_anilist_credits(&media);

    let cover = media.get("coverImage").and_then(cover_large);
    let banner = media
        .get("bannerImage")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let images = build_images(cover.as_deref(), banner.as_deref());

    Ok(ApiMediaDetail {
        provider: "anilist_manga".to_string(),
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

fn extract_anilist_genres_and_tags(media: &Value) -> Vec<String> {
    let mut genres = Vec::new();
    let mut seen = std::collections::HashSet::new();

    if let Some(arr) = media.get("genres").and_then(|g| g.as_array()) {
        for v in arr {
            if let Some(s) = v.as_str() {
                let s_trim = s.trim();
                if !s_trim.is_empty() && seen.insert(s_trim.to_lowercase()) {
                    genres.push(s_trim.to_string());
                }
            }
        }
    }
    if let Some(tags_arr) = media.get("tags").and_then(|t| t.as_array()) {
        for item in tags_arr {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                let n_trim = name.trim();
                if !n_trim.is_empty() && seen.insert(n_trim.to_lowercase()) {
                    genres.push(n_trim.to_string());
                }
            }
        }
    }
    genres
}

fn extract_anilist_credits(media: &Value) -> Vec<crate::api::types::ApiCredit> {
    let mut credits = Vec::new();
    let edges = media
        .get("characters")
        .or_else(|| media.get("staff"))
        .and_then(|c| c.get("edges"))
        .and_then(|e| e.as_array());

    if let Some(arr) = edges {
        for edge in arr.iter().take(10) {
            let role = edge.get("role").and_then(|r| r.as_str()).map(|s| s.to_string());
            if let Some(node) = edge.get("node") {
                let name = node
                    .get("name")
                    .and_then(|n| n.get("full"))
                    .and_then(|f| f.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !name.is_empty() {
                    let photo_url = node
                        .get("image")
                        .and_then(|i| i.get("large"))
                        .and_then(|l| l.as_str())
                        .map(|s| s.to_string());
                    credits.push(crate::api::types::ApiCredit {
                        name,
                        role,
                        photo_url,
                    });
                }
            }
        }
    }
    credits
}