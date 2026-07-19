use crate::db::notifications;
use crate::models::{Notification, CreateNotificationDto};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn get_notifications(
    profile_id: String,
    limit: Option<i32>,
    state: State<'_, AppState>,
) -> Result<Vec<Notification>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::get_all(&conn, &profile_id, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_unread_count(
    profile_id: String,
    state: State<'_, AppState>,
) -> Result<i32, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::get_unread_count(&conn, &profile_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_notification_read(
    notification_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::mark_as_read(&conn, notification_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_all_notifications_read(
    profile_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::mark_all_as_read(&conn, &profile_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_notification(
    notification_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::delete(&conn, notification_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cleanup_old_notifications(
    profile_id: String,
    days: i32,
    state: State<'_, AppState>,
) -> Result<i32, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::cleanup_old(&conn, &profile_id, days).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_notification(
    dto: CreateNotificationDto,
    state: State<'_, AppState>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::insert(&conn, dto).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_duplicate_exists(
    profile_id: String,
    notification_type: String,
    related_entity_type: Option<String>,
    related_entity_id: Option<i64>,
    max_age_days: Option<i32>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::check_duplicate_exists(
        &conn,
        &profile_id,
        &notification_type,
        related_entity_type.as_deref(),
        related_entity_id,
        max_age_days,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_monthly_report_exists(
    profile_id: String,
    year: i32,
    month: i32,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::check_monthly_report_exists(&conn, &profile_id, year, month).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_notifications(
    profile_id: String,
    preferences: notifications::NotificationPrefs,
    state: State<'_, AppState>,
) -> Result<i32, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notifications::generate_all_notifications(&conn, &profile_id, &preferences).map_err(|e| e.to_string())
}
