use tauri::State;
use crate::{AppState, models::{Objective, CreateObjectiveDto, UpdateObjectiveDto}, db};

#[tauri::command]
pub async fn get_all_objectives(
    state: State<'_, AppState>,
) -> Result<Vec<Objective>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::objectives::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_objective(
    state: State<'_, AppState>,
    dto: CreateObjectiveDto,
) -> Result<i64, String> {
    if dto.target_count <= 0 {
        return Err("target_count must be positive".to_string());
    }
    if dto.start_date >= dto.end_date {
        return Err("start_date must be before end_date".to_string());
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::objectives::insert(&conn, dto).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_objective(
    state: State<'_, AppState>,
    dto: UpdateObjectiveDto,
) -> Result<(), String> {
    if let Some(tc) = dto.target_count {
        if tc <= 0 {
            return Err("target_count must be positive".to_string());
        }
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::objectives::update(&conn, dto).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_objective(
    state: State<'_, AppState>,
    objective_id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::objectives::delete(&conn, objective_id).map_err(|e| e.to_string())
}
