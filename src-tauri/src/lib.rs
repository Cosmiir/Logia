mod models;
mod db;
mod commands;
mod utils;

use std::sync::Mutex;
use std::path::PathBuf;
use rusqlite::Connection;
use tauri::Manager;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct AppConfig {
    storage_path: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            storage_path: None,
        }
    }
}

pub struct AppState {
    pub db: Mutex<Connection>,
    pub app_dir: Mutex<PathBuf>,
    pub storage_dir: Mutex<PathBuf>,
    pub storage_missing: Mutex<bool>,
}

/// Get the path to config.json in %AppData%
pub fn config_path(app_dir: &PathBuf) -> PathBuf {
    app_dir.join("config.json")
}

/// Load or create the app config
pub fn load_config(app_dir: &PathBuf) -> AppConfig {
    let path = config_path(app_dir);
    if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        let config = AppConfig::default();
        save_config(app_dir, &config);
        config
    }
}

/// Save the app config
pub fn save_config(app_dir: &PathBuf, config: &AppConfig) {
    let path = config_path(app_dir);
    let content = serde_json::to_string_pretty(config).expect("Failed to serialize config");
    std::fs::write(path, content).expect("Failed to write config.json");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Get app data directory (for config.json only)
            let app_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            
            // Create directory if it doesn't exist
            std::fs::create_dir_all(&app_dir)
                .expect("Failed to create app data directory");
            
            // Load config to get storage path
            let config = load_config(&app_dir);
            
            // Determine storage directory and check accessibility
            let (storage_dir, storage_missing) = if let Some(ref path) = config.storage_path {
                // Custom storage path is configured
                let storage_dir = PathBuf::from(path);
                
                // Check if the folder exists AND contains profiles.json
                // Do NOT call create_dir_all - we don't want to silently recreate an empty folder
                let profiles_json = storage_dir.join("profiles.json");
                let has_data = storage_dir.exists() && profiles_json.exists();
                
                if has_data {
                    // Storage is accessible and contains data
                    (storage_dir, false)
                } else {
                    // Storage is missing (folder doesn't exist or no data)
                    // Use the configured path but mark as missing
                    (storage_dir, true)
                }
            } else {
                // No custom storage path - first launch, use app_dir
                // Create app_dir if needed (only for default storage)
                std::fs::create_dir_all(&app_dir)
                    .expect("Failed to create app data directory");
                (app_dir.clone(), false)
            };
            
            // Load (or create) the profiles manifest and get active profile (from storage_dir)
            let conn = if storage_missing {
                // Storage inaccessible (disque débranché etc.) - use in-memory DB
                let c = Connection::open_in_memory().expect("Failed to open in-memory DB");
                db::initialize_database(&c).expect("Failed to init in-memory DB");
                c
            } else {
                // Storage accessible - proceed normally
                let manifest = db::profiles::load_manifest(&storage_dir);
                
                // If profiles exist, open the active profile's DB.
                // On fresh install (no profiles), use an in-memory placeholder —
                // the frontend will show onboarding, create a profile, then switch_profile
                // swaps this connection to the real DB.
                if manifest.profiles.is_empty() {
                    let c = Connection::open_in_memory().expect("Failed to open in-memory DB");
                    db::initialize_database(&c).expect("Failed to init in-memory DB");
                    c
                } else {
                    let active_id = &manifest.active_profile_id;
                    db::profiles::ensure_profile_dir(&storage_dir, active_id)
                }
            };
            
            // Store connection, app_dir, storage_dir, and storage_missing in app state
            app.manage(AppState {
                db: Mutex::new(conn),
                app_dir: Mutex::new(app_dir),
                storage_dir: Mutex::new(storage_dir),
                storage_missing: Mutex::new(storage_missing),
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::collections::get_all_collections,
            commands::collections::get_collection_by_id,
            commands::collections::create_collection,
            commands::collections::update_collection,
            commands::collections::delete_collection,
            commands::collections::delete_collection_with_options,
            commands::collections::reorder_collections,
            commands::media::get_media_by_collection,
            commands::media::get_all_media,
            commands::media::count_media_by_collection,
            commands::media::count_all_media,
            commands::media::get_all_media_ids,
            commands::media::get_media_ids_by_collection,
            commands::media::get_distinct_creators,
            commands::media::get_progress_current_range,
            commands::media::get_media_by_id,
            commands::media::create_media,
            commands::media::update_media,
            commands::media::delete_media,
            commands::media::upload_media_image,
            commands::media::upload_media_images_from_paths,
            commands::media::upload_media_attachments_from_paths,
            commands::media::delete_media_attachment,
            commands::media::get_cbz_pages,
            commands::media::read_cbz_page,
            commands::media::delete_media_image,
            commands::media::set_media_cover,
            commands::media::clear_media_cover,
            commands::media::update_image_positions,
            commands::media::get_similar_media,
            commands::media::read_file_base64,
            commands::media::download_attachment,
            commands::genres::search_genres,
            commands::genres::create_genre,
            commands::genres::get_all_genres,
            commands::genres::update_genre_color,
            commands::genres::delete_genre,
            commands::people::get_all_people,
            commands::people::search_people,
            commands::people::create_person,
            commands::people::update_person,
            commands::people::delete_person,
            commands::people::get_media_credits,
            commands::people::get_unique_roles,
            commands::stats::get_dashboard_stats,
                        commands::profiles::get_all_profiles,
            commands::profiles::get_active_profile,
            commands::profiles::create_profile,
            commands::profiles::update_profile,
            commands::profiles::delete_profile,
            commands::profiles::switch_profile,
            commands::profiles::verify_profile_password,
            commands::data::get_storage_info,
            commands::data::reset_database,
            commands::data::cleanup_orphaned_images,
            commands::data::export_database,
            commands::data::export_to_csv_or_markdown,
            commands::data::import_database,
            commands::data::merge_profile_data,
            commands::data::preview_csv_import,
            commands::data::import_from_csv,
            commands::data::import_reviews_from_md,
            commands::data::get_storage_path,
            commands::data::set_storage_path,
            commands::data::init_storage_path,
            commands::data::verify_storage_path,
            commands::data::get_app_status,
            commands::data::retry_storage_connection,
            commands::data::reset_to_default_storage,
            commands::objectives::get_all_objectives,
            commands::objectives::create_objective,
            commands::objectives::update_objective,
            commands::objectives::delete_objective,
            commands::notifications::get_notifications,
            commands::notifications::get_unread_count,
            commands::notifications::mark_notification_read,
            commands::notifications::mark_all_notifications_read,
            commands::notifications::delete_notification,
            commands::notifications::cleanup_old_notifications,
            commands::notifications::create_notification,
            commands::notifications::check_duplicate_exists,
            commands::notifications::check_monthly_report_exists,
            commands::notifications::generate_notifications,
            commands::settings::get_settings,
            commands::settings::get_setting,
            commands::settings::update_setting,
            commands::settings::update_settings_batch,
            commands::review_templates::get_all_review_templates,
            commands::review_templates::get_review_template_by_id,
            commands::review_templates::create_review_template,
            commands::review_templates::update_review_template,
            commands::review_templates::delete_review_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
