use tauri::State;
use crate::{AppState, db};

#[tauri::command]
pub async fn get_dashboard_stats(
    state: State<'_, AppState>,
) -> Result<db::stats::DashboardStats, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::stats::get_dashboard_stats(&conn).map_err(|e| e.to_string())
}
