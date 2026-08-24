use crate::api::types::{ApiSearchResult, ApiMediaDetail, ApiImage};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, retry};

const BASE_URL: &str = "https://musicbrainz.org/ws/2";
const MAX_RESULTS: usize = 5;

pub async fn search(
    query: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    rate_limiter.acquire("musicbrainz").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/release", BASE_URL))
                .query(&[("query", query), ("limit", "5"), ("fmt", "json")])
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("MusicBrainz search failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let releases = body
        .get("releases")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();

    let mut out = Vec::new();
    for release in releases.iter().take(MAX_RESULTS) {
        let id = release
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let title = release
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if title.is_empty() || id.is_empty() {
            continue;
        }
        let year = release
            .get("date")
            .and_then(|v| v.as_str())
            .and_then(|s| s.get(..4))
            .map(|s| s.to_string());
        let creator = release
            .get("artist-credit")
            .and_then(|ac| ac.as_array())
            .and_then(|a| a.first())
            .and_then(|c| c.get("name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        // MusicBrainz doesn't return images in search results
        out.push(ApiSearchResult {
            provider: "musicbrainz".to_string(),
            provider_id: id,
            title,
            year,
            creator,
            thumbnail_b64: None,
        });
    }
    Ok(out)
}

pub async fn get_detail(
    id: &str,
    _api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    rate_limiter.acquire("musicbrainz").await;
    let client = build_client();

    // The release lookup (musicbrainz.org) and the cover art lookup (a
    // separate host, coverartarchive.org) are independent of each other, so
    // run them concurrently instead of waiting on the release response
    // before even starting the cover art request.
    let release_future = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/release/{}", BASE_URL, id))
                .query(&[("inc", "artist-credits+release-groups"), ("fmt", "json")])
                .send()
                .await
        }
    });
    let cover_art_future = fetch_cover_art(&client, id);

    let (resp_res, images) = futures::join!(release_future, cover_art_future);

    let resp = resp_res?;
    if !resp.status().is_success() {
        return Err(format!("MusicBrainz detail failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let title = body
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let release_date = body
        .get("date")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let creator = body
        .get("artist-credit")
        .and_then(|ac| ac.as_array())
        .and_then(|a| a.first())
        .and_then(|c| c.get("name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(ApiMediaDetail {
        provider: "musicbrainz".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status: None,
        synopsis: None,
        duration: None,
        genres: vec![],
        credits: vec![],
        images,
    })
}

/// Fetch cover art thumbnails for a release from the Cover Art Archive
/// (coverartarchive.org), a companion service to MusicBrainz. Unlike the
/// MusicBrainz API itself, it requires no API key and has no documented
/// rate limit, so failures here are treated as "no cover art" rather than
/// a hard error — a release without artwork is common and not exceptional.
async fn fetch_cover_art(client: &reqwest::Client, release_id: &str) -> Vec<ApiImage> {
    let resp = match client
        .get(format!("https://coverartarchive.org/release/{}", release_id))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r,
        _ => return Vec::new(),
    };
    let body: serde_json::Value = match resp.json().await {
        Ok(b) => b,
        Err(_) => return Vec::new(),
    };

    let mut images = Vec::new();
    if let Some(arr) = body.get("images").and_then(|i| i.as_array()) {
        for img in arr.iter().take(8) {
            let url = img
                .pointer("/thumbnails/1200")
                .or_else(|| img.pointer("/thumbnails/500"))
                .or_else(|| img.get("image"))
                .and_then(|v| v.as_str());
            if let Some(url) = url {
                images.push(ApiImage {
                    url: url.to_string(),
                    thumbnail_b64: None,
                    kind: None,
                });
            }
        }
    }
    images
}