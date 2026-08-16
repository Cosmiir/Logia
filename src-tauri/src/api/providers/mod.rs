pub mod tmdb;
pub mod omdb;
pub mod tvmaze;
pub mod jikan;
pub mod anilist;
pub mod rawg;
pub mod thegamesdb;
pub mod musicbrainz;
pub mod itunes;

use crate::api::types::{ApiSearchResult, ApiMediaDetail};
use crate::api::rate_limiter::{user_agent, RateLimiter};

/// Shared HTTP client builder. All providers use the same client with the
/// Logia User-Agent header.
pub fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(user_agent())
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .expect("Failed to build reqwest client")
}

/// Download image bytes from a URL, returning base64-encoded data.
/// Used for search thumbnails (low-res) and gallery image preview.
pub async fn fetch_image_as_b64(url: &str) -> Option<String> {
    let client = build_client();
    let resp = client.get(url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let bytes = resp.bytes().await.ok()?;
    use base64::Engine;
    let engine = base64::engine::general_purpose::STANDARD;
    Some(engine.encode(&bytes))
}

/// Dispatch a search to the right provider by id.
pub async fn search(
    provider: &str,
    query: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    match provider {
        "tmdb" => tmdb::search(query, api_key, rate_limiter).await,
        "omdb" => omdb::search(query, api_key, rate_limiter).await,
        "tvmaze" => tvmaze::search(query, api_key, rate_limiter).await,
        "jikan_anime" => jikan::search_anime(query, api_key, rate_limiter).await,
        "jikan_manga" => jikan::search_manga(query, api_key, rate_limiter).await,
        "anilist_anime" => anilist::search_anime(query, api_key, rate_limiter).await,
        "anilist_manga" => anilist::search_manga(query, api_key, rate_limiter).await,
        "rawg" => rawg::search(query, api_key, rate_limiter).await,
        "thegamesdb" => thegamesdb::search(query, api_key, rate_limiter).await,
        "musicbrainz" => musicbrainz::search(query, api_key, rate_limiter).await,
        "itunes" => itunes::search(query, api_key, rate_limiter).await,
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

/// Dispatch a detail fetch to the right provider by id.
pub async fn get_detail(
    provider: &str,
    id: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    match provider {
        "tmdb" => tmdb::get_detail(id, api_key, rate_limiter).await,
        "omdb" => omdb::get_detail(id, api_key, rate_limiter).await,
        "tvmaze" => tvmaze::get_detail(id, api_key, rate_limiter).await,
        "jikan_anime" => jikan::get_detail_anime(id, api_key, rate_limiter).await,
        "jikan_manga" => jikan::get_detail_manga(id, api_key, rate_limiter).await,
        "anilist_anime" => anilist::get_detail_anime(id, api_key, rate_limiter).await,
        "anilist_manga" => anilist::get_detail_manga(id, api_key, rate_limiter).await,
        "rawg" => rawg::get_detail(id, api_key, rate_limiter).await,
        "thegamesdb" => thegamesdb::get_detail(id, api_key, rate_limiter).await,
        "musicbrainz" => musicbrainz::get_detail(id, api_key, rate_limiter).await,
        "itunes" => itunes::get_detail(id, api_key, rate_limiter).await,
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

// Re-export retry helper for providers (crate-internal use only).
pub(crate) use crate::api::rate_limiter::execute_with_retry as retry;
