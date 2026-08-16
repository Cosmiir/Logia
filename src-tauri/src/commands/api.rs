use tauri::State;
use crate::AppState;
use crate::api::types::{ApiSearchResult, ApiMediaDetail, ProviderInfo};
use crate::api::registry;
use crate::api::providers;
use crate::db;
use std::collections::HashMap;

/// Get the list of available API providers with their availability status
/// (based on whether required API keys are configured in settings).
#[tauri::command]
pub async fn get_api_providers(state: State<'_, AppState>) -> Result<Vec<ProviderInfo>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let settings = db::settings::get_all(&conn).map_err(|e| e.to_string())?;
    Ok(registry::available_providers(&settings))
}

/// Search across multiple providers in parallel. Results are grouped by
/// provider (each result carries its `provider` + `provider_id`).
#[tauri::command]
pub async fn search_api_media(
    state: State<'_, AppState>,
    providers: Vec<String>,
    query: String,
) -> Result<Vec<ApiSearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let settings = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::settings::get_all(&conn).map_err(|e| e.to_string())?
    };

    let rate_limiter = {
        let guard = state.rate_limiter.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    // Launch all provider searches in parallel
    let mut handles = Vec::new();
    for provider_id in &providers {
        let key = registry::get_key(provider_id, &settings);
        let provider_id = provider_id.clone();
        let query = query.clone();
        let rl = rate_limiter.clone();
        handles.push(tokio::spawn(async move {
            providers::search(&provider_id, &query, key.as_deref(), &rl)
                .await
                .unwrap_or_default()
        }));
    }

    let mut all_results = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(results) => all_results.extend(results),
            Err(e) => eprintln!("Provider search task failed: {}", e),
        }
    }
    Ok(all_results)
}

/// Get detailed information for a single media item from a specific provider.
#[tauri::command]
pub async fn get_api_media_detail(
    state: State<'_, AppState>,
    provider: String,
    id: String,
) -> Result<ApiMediaDetail, String> {
    let settings = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::settings::get_all(&conn).map_err(|e| e.to_string())?
    };

    let key = registry::get_key(&provider, &settings);
    let rate_limiter = {
        let guard = state.rate_limiter.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    providers::get_detail(&provider, &id, key.as_deref(), &rate_limiter).await
}

/// Download an image from a URL and save it to a media's image gallery.
/// Reuses the existing image processing pipeline (resize, WebP, EXIF).
#[tauri::command]
pub async fn download_api_image_to_media(
    state: State<'_, AppState>,
    url: String,
    media_id: i64,
) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    // Download image bytes
    let client = providers::build_client();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to download image: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Image download failed: {}", resp.status()));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    // Determine filename from URL
    let file_name = url
        .rsplit('/')
        .next()
        .and_then(|s| {
            let clean = s.split('?').next().unwrap_or(s);
            if clean.is_empty() {
                None
            } else {
                Some(clean.to_string())
            }
        })
        .unwrap_or_else(|| "api_image.jpg".to_string());

    // Get current max position and save image
    let image_id = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let max_pos: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(position), -1) FROM media_images WHERE media_id = ?1",
                rusqlite::params![media_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
        super::media::save_image_bytes_to_media(
            &conn,
            &storage_dir,
            media_id,
            &bytes,
            &file_name,
            max_pos + 1,
        )?
    };

    let mut result = HashMap::new();
    result.insert("imageId".to_string(), serde_json::Value::from(image_id));
    Ok(result)
}
