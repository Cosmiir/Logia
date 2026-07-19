use tauri::State;
use crate::{AppState, models::Genre, db, utils};

#[tauri::command]
pub async fn search_genres(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Genre>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::genres::search(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_genre(
    state: State<'_, AppState>,
    name: String,
    color: Option<String>,
) -> Result<i64, String> {
    utils::validate_genre_name(&name)?;
    
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::genres::insert(&conn, &name, color.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_genre_color(
    state: State<'_, AppState>,
    genre_id: i64,
    color: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::genres::update_color(&conn, genre_id, &color).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_genres(state: State<'_, AppState>) -> Result<Vec<Genre>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::genres::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_genre(
    state: State<'_, AppState>,
    genre_id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::genres::delete(&conn, genre_id).map_err(|e| e.to_string())
}
