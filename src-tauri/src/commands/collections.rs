use tauri::State;
use crate::{AppState, models::{Collection, CreateCollectionDto, UpdateCollectionDto}, db, utils};

#[tauri::command]
pub async fn get_all_collections(state: State<'_, AppState>) -> Result<Vec<Collection>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::collections::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_collection_by_id(
    state: State<'_, AppState>,
    collection_id: i64,
) -> Result<Option<Collection>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::collections::get_by_id(&conn, collection_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_collection(
    state: State<'_, AppState>,
    dto: CreateCollectionDto,
) -> Result<i64, String> {
    utils::validate_collection_name(&dto.name)?;
    
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::collections::insert(&conn, dto).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_collection(
    state: State<'_, AppState>,
    dto: UpdateCollectionDto,
) -> Result<(), String> {
    if let Some(name) = dto.name.as_deref() {
        utils::validate_collection_name(name)?;
    }
    
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::collections::update(&conn, dto).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_collection(
    state: State<'_, AppState>,
    collection_id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::collections::delete(&conn, collection_id).map_err(|e| e.to_string())
}

/// Delete a collection with options for handling its media.
/// mode: "delete_media" | "transfer" (requires target_collection_id)
#[tauri::command]
pub async fn delete_collection_with_options(
    state: State<'_, AppState>,
    collection_id: i64,
    mode: String,
    target_collection_id: Option<i64>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);

    match mode.as_str() {
        "delete_media" => {
            // Delete collection and all its media + their image files
            let media_ids = db::collections::delete_with_media(&conn, collection_id)
                .map_err(|e| e.to_string())?;
            // Clean up image files from disk
            for mid in media_ids {
                let media_images_dir = media_dir.join(format!("media_{}", mid));
                if media_images_dir.exists() {
                    let _ = std::fs::remove_dir_all(&media_images_dir);
                }
            }
            Ok(())
        }
        "unlink" => {
            // Delete collection but keep media with collection_id = NULL
            db::collections::delete_and_unlink_media(&conn, collection_id)
                .map_err(|e| e.to_string())
        }
        "transfer" => {
            let target = target_collection_id
                .ok_or_else(|| "target_collection_id is required for transfer mode".to_string())?;
            db::collections::delete_and_transfer_media(&conn, collection_id, target)
                .map_err(|e| e.to_string())
        }
        _ => Err(format!("Unknown deletion mode: {}", mode)),
    }
}

#[tauri::command]
pub async fn reorder_collections(
    state: State<'_, AppState>,
    collection_ids: Vec<i64>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::collections::reorder(&conn, collection_ids).map_err(|e| e.to_string())
}
