use crate::api::types::ProviderInfo;
use std::collections::HashMap;

/// Static metadata for a provider.
struct ProviderMeta {
    id: &'static str,
    label: &'static str,
    media_type: &'static str,
    needs_key: bool,
    key_setting: Option<&'static str>,
    doc_url: &'static str,
}

const PROVIDERS: &[ProviderMeta] = &[
    ProviderMeta {
        id: "tmdb",
        label: "TMDB",
        media_type: "movie",
        needs_key: true,
        key_setting: Some("api_key_tmdb"),
        doc_url: "https://developer.themoviedb.org/docs",
    },
    ProviderMeta {
        id: "omdb",
        label: "OMDb",
        media_type: "movie",
        needs_key: true,
        key_setting: Some("api_key_omdb"),
        doc_url: "https://www.omdbapi.com/apikey.aspx",
    },
    ProviderMeta {
        id: "tmdb",
        label: "TMDB",
        media_type: "series",
        needs_key: true,
        key_setting: Some("api_key_tmdb"),
        doc_url: "https://developer.themoviedb.org/docs",
    },
    ProviderMeta {
        id: "tvmaze",
        label: "TVMaze",
        media_type: "series",
        needs_key: false,
        key_setting: None,
        doc_url: "https://www.tvmaze.com/api",
    },
    ProviderMeta {
        id: "jikan_anime",
        label: "Jikan (MyAnimeList)",
        media_type: "anime",
        needs_key: false,
        key_setting: None,
        doc_url: "https://docs.api.jikan.moe/",
    },
    ProviderMeta {
        id: "anilist_anime",
        label: "AniList",
        media_type: "anime",
        needs_key: false,
        key_setting: None,
        doc_url: "https://docs.anilist.co/",
    },
    ProviderMeta {
        id: "jikan_manga",
        label: "Jikan (MyAnimeList)",
        media_type: "manga",
        needs_key: false,
        key_setting: None,
        doc_url: "https://docs.api.jikan.moe/",
    },
    ProviderMeta {
        id: "anilist_manga",
        label: "AniList",
        media_type: "manga",
        needs_key: false,
        key_setting: None,
        doc_url: "https://docs.anilist.co/",
    },
    ProviderMeta {
        id: "rawg",
        label: "RAWG",
        media_type: "game",
        needs_key: true,
        key_setting: Some("api_key_rawg"),
        doc_url: "https://rawg.io/apidocs",
    },
    ProviderMeta {
        id: "igdb",
        label: "IGDB",
        media_type: "game",
        needs_key: true,
        key_setting: Some("api_key_igdb_client_id"),
        doc_url: "https://dev.twitch.tv/console",
    },
    ProviderMeta {
        id: "musicbrainz",
        label: "MusicBrainz",
        media_type: "music",
        needs_key: false,
        key_setting: None,
        doc_url: "https://musicbrainz.org/doc/MusicBrainz_API",
    },
    ProviderMeta {
        id: "itunes",
        label: "iTunes",
        media_type: "music",
        needs_key: false,
        key_setting: None,
        doc_url: "https://performance-partners.apple.com/search-api",
    },
    ProviderMeta {
        id: "google_books",
        label: "Google Books",
        media_type: "book",
        needs_key: true,
        key_setting: Some("api_key_google_books"),
        doc_url: "https://developers.google.com/books/docs/v1/using",
    },
    ProviderMeta {
        id: "openlibrary",
        label: "Open Library",
        media_type: "book",
        needs_key: false,
        key_setting: None,
        doc_url: "https://openlibrary.org/developers/api",
    },
    ProviderMeta {
        id: "bgg",
        label: "BoardGameGeek",
        media_type: "board_game",
        needs_key: true,
        key_setting: Some("api_key_bgg"),
        doc_url: "https://boardgamegeek.com/applications",
    },
];

/// Build the list of available providers, marking each as available or
/// unavailable based on whether the required API key is present in settings.
pub fn available_providers(settings: &HashMap<String, String>) -> Vec<ProviderInfo> {
    PROVIDERS
        .iter()
        .map(|p| {
            let available = if p.id == "igdb" {
                let id_ok = settings.get("api_key_igdb_client_id").map(|v| !v.is_empty()).unwrap_or(false);
                let secret_ok = settings.get("api_key_igdb_client_secret").map(|v| !v.is_empty()).unwrap_or(false);
                id_ok && secret_ok
            } else if p.needs_key {
                p.key_setting
                    .and_then(|k| settings.get(k))
                    .map(|v| !v.is_empty())
                    .unwrap_or(false)
            } else {
                true
            };
            ProviderInfo {
                id: p.id.to_string(),
                label: p.label.to_string(),
                media_type: p.media_type.to_string(),
                needs_key: p.needs_key,
                key_setting: p.key_setting.map(|s| s.to_string()),
                available,
                doc_url: p.doc_url.to_string(),
            }
        })
        .collect()
}

/// Get the API key for a provider from settings, if required.
pub fn get_key(provider: &str, settings: &HashMap<String, String>) -> Option<String> {
    if provider == "igdb" {
        let client_id = settings.get("api_key_igdb_client_id")?.trim();
        let client_secret = settings.get("api_key_igdb_client_secret")?.trim();
        if !client_id.is_empty() && !client_secret.is_empty() {
            return Some(format!("{}:{}", client_id, client_secret));
        }
        return None;
    }
    let key_setting = PROVIDERS
        .iter()
        .find(|p| p.id == provider)
        .and_then(|p| p.key_setting)?;
    settings.get(key_setting).filter(|v| !v.is_empty()).cloned()
}
