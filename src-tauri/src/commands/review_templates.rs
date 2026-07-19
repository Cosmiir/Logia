use tauri::State;
use crate::{AppState, models::{ReviewTemplate, CreateReviewTemplateDto, UpdateReviewTemplateDto}, db};

#[tauri::command]
pub async fn get_all_review_templates(
    state: State<'_, AppState>,
) -> Result<Vec<ReviewTemplate>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::review_templates::get_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_review_template_by_id(
    state: State<'_, AppState>,
    template_id: i64,
) -> Result<Option<ReviewTemplate>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::review_templates::get_by_id(&conn, template_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_review_template(
    state: State<'_, AppState>,
    dto: CreateReviewTemplateDto,
) -> Result<i64, String> {
    if dto.name.trim().is_empty() {
        return Err("Le nom du modèle est requis".to_string());
    }
    if dto.icon.trim().is_empty() {
        return Err("L'icône est requise".to_string());
    }
    if dto.content.trim().is_empty() {
        return Err("Le contenu du modèle est requis".to_string());
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::review_templates::insert(&conn, &dto).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_review_template(
    state: State<'_, AppState>,
    dto: UpdateReviewTemplateDto,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let updated = db::review_templates::update(&conn, &dto)
        .map_err(|e| e.to_string())?;
    
    if !updated {
        return Err("Modèle non trouvé".to_string());
    }
    
    Ok(())
}

#[tauri::command]
pub async fn delete_review_template(
    state: State<'_, AppState>,
    template_id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let deleted = db::review_templates::delete(&conn, template_id)
        .map_err(|e| e.to_string())?;
    
    if !deleted {
        return Err("Modèle non trouvé".to_string());
    }
    
    Ok(())
}
