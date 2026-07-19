use tauri::State;
use rusqlite::params;
use crate::{AppState, models::{Person, MediaCredit}, db, utils};
use std::path::Path;
use log::warn;

fn to_absolute_path(storage_dir: &Path, relative: &str) -> String {
    storage_dir.join(relative).to_string_lossy().to_string()
}

fn save_person_photo(
    storage_dir: &Path,
    profile_id: &str,
    person_id: i64,
    photo_data_base64: &str,
) -> Result<String, String> {
    use base64::Engine;
    use image::imageops::FilterType;

    let people_dir = db::profiles::profile_people_dir(storage_dir, profile_id);
    std::fs::create_dir_all(&people_dir).map_err(|e| e.to_string())?;

    // Handle data URL prefix
    let clean_base64 = if let Some(pos) = photo_data_base64.find(',') {
        &photo_data_base64[pos + 1..]
    } else {
        photo_data_base64
    };

    let engine = base64::engine::general_purpose::STANDARD;
    let raw_bytes = engine.decode(clean_base64.trim())
        .map_err(|e| format!("Invalid base64: {}", e))?;

    let img = image::load_from_memory(&raw_bytes)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Portrait 3:4 for consistent credit cards
    let portrait_img = img.resize_to_fill(360, 480, FilterType::Lanczos3);

    // Save as WebP
    let filename = format!("person_{}.webp", person_id);
    let filepath = people_dir.join(&filename);
    let webp_data = crate::commands::media::encode_webp(&portrait_img, 85.0)?;
    std::fs::write(&filepath, &webp_data).map_err(|e| e.to_string())?;

    // Relative path from storage_dir
    let relative_path = filepath
        .strip_prefix(storage_dir)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/");

    Ok(relative_path)
}

#[tauri::command]
pub async fn get_all_people(state: State<'_, AppState>) -> Result<Vec<Person>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    
    let mut people = db::people::get_all(&conn).map_err(|e| e.to_string())?;
    for person in &mut people {
        if let Some(ref path) = person.photo_path {
            person.photo_path = Some(to_absolute_path(&storage_dir, path));
        }
    }
    
    Ok(people)
}

#[tauri::command]
pub async fn search_people(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Person>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    
    let mut people = db::people::search(&conn, &query).map_err(|e| e.to_string())?;
    for person in &mut people {
        if let Some(ref path) = person.photo_path {
            person.photo_path = Some(to_absolute_path(&storage_dir, path));
        }
    }
    
    Ok(people)
}

#[tauri::command]
pub async fn create_person(
    state: State<'_, AppState>,
    name: String,
    photo_data_base64: Option<String>,
) -> Result<i64, String> {
    utils::validate_person_name(&name)?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    // Insert first to get the ID
    let person_id = db::people::insert(&conn, &name, None).map_err(|e| e.to_string())?;

    if let Some(ref base64) = photo_data_base64 {
        if !base64.trim().is_empty() {
            let manifest = db::profiles::load_manifest(&storage_dir);
            let profile_id = &manifest.active_profile_id;
            
            match save_person_photo(&storage_dir, profile_id, person_id, base64) {
                Ok(relative_path) => {
                    db::people::update(&conn, person_id, &name, Some(&relative_path)).map_err(|e| e.to_string())?;
                }
                Err(err) => {
                    warn!("Failed to save person photo: {}", err);
                }
            }
        }
    }

    Ok(person_id)
}

#[tauri::command]
pub async fn update_person(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    photo_data_base64: Option<String>,
    remove_photo: Option<bool>,
) -> Result<(), String> {
    utils::validate_person_name(&name)?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;

    // Retrieve existing person to get current photo_path
    let mut stmt = conn.prepare("SELECT photo_path FROM people WHERE id = ?1").map_err(|e| e.to_string())?;
    let current_photo_path: Option<String> = stmt.query_row(params![id], |row| row.get(0)).map_err(|e| e.to_string())?;

    let mut new_photo_path = current_photo_path.clone();

    if let Some(true) = remove_photo {
        if let Some(ref path) = current_photo_path {
            let abs_path = to_absolute_path(&storage_dir, path);
            let _ = std::fs::remove_file(abs_path);
        }
        new_photo_path = None;
    } else if let Some(ref base64) = photo_data_base64 {
        if !base64.trim().is_empty() {
            // Delete old photo if it exists
            if let Some(ref path) = current_photo_path {
                let abs_path = to_absolute_path(&storage_dir, path);
                let _ = std::fs::remove_file(abs_path);
            }
            
            new_photo_path = match save_person_photo(&storage_dir, profile_id, id, base64) {
                Ok(path) => Some(path),
                Err(err) => return Err(format!("Failed to save photo: {}", err)),
            };
        }
    }

    db::people::update(&conn, id, &name, new_photo_path.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_person(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    // Retrieve photo_path to delete file on disk
    let mut stmt = conn.prepare("SELECT photo_path FROM people WHERE id = ?1").map_err(|e| e.to_string())?;
    let current_photo_path: Option<String> = stmt.query_row(params![id], |row| row.get(0)).map_err(|e| e.to_string())?;

    if let Some(ref path) = current_photo_path {
        let abs_path = to_absolute_path(&storage_dir, path);
        let _ = std::fs::remove_file(abs_path);
    }

    db::people::delete(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_media_credits(
    state: State<'_, AppState>,
    media_id: i64,
) -> Result<Vec<MediaCredit>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let mut credits = db::people::get_by_media_id(&conn, media_id).map_err(|e| e.to_string())?;
    for credit in &mut credits {
        if let Some(ref path) = credit.photo_path {
            credit.photo_path = Some(to_absolute_path(&storage_dir, path));
        }
    }

    Ok(credits)
}

#[tauri::command]
pub async fn get_unique_roles(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::people::get_unique_roles(&conn).map_err(|e| e.to_string())
}

