use tauri::State;
use tauri::Emitter;
use crate::AppState;
use crate::db;
use super::*;
use log::warn;

// ── Helpers ──

fn dir_size(path: &std::path::Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    let mut size = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                size += std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
            } else if p.is_dir() {
                size += dir_size(&p);
            }
        }
    }
    size
}

/// Remove directory with retry logic to handle temporary file locks
fn remove_dir_with_retry(path: &std::path::Path, max_retries: u32) -> Result<(), String> {
    for attempt in 0..max_retries {
        match std::fs::remove_dir_all(path) {
            Ok(_) => return Ok(()),
            Err(e) => {
                if attempt == max_retries - 1 {
                    return Err(format!("Failed to delete directory after {} attempts: {}", max_retries, e));
                }
                let delay_ms = 100 * (1 << attempt);
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            }
        }
    }
    unreachable!()
}

/// Copy directory recursively (handles cross-device moves)
fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    if !src.exists() { return Ok(()); }
    std::fs::create_dir_all(dst).map_err(|e| format!("Failed to create directory: {}", e))?;

    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_file() {
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy file {:?}: {}", src_path, e))?;
        } else if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

// ── Commands ──

/// Get storage usage info (DB size + images size)
#[tauri::command]
pub async fn get_storage_info(state: State<'_, AppState>) -> Result<StorageInfo, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;

    let db_path = db::profiles::profile_db_path(&storage_dir, profile_id);
    let db_size = std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);

    let wal_size = std::fs::metadata(db_path.with_extension("db-wal"))
        .map(|m| m.len()).unwrap_or(0);
    let shm_size = std::fs::metadata(db_path.with_extension("db-shm"))
        .map(|m| m.len()).unwrap_or(0);
    let total_db = db_size + wal_size + shm_size;

    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);
    let people_dir = db::profiles::profile_people_dir(&storage_dir, profile_id);
    let images_size = dir_size(&media_dir) + dir_size(&people_dir);

    let total_media: i32 = conn.query_row("SELECT COUNT(*) FROM media", [], |r| r.get(0))
        .unwrap_or(0);
    let total_images: i32 = conn.query_row("SELECT COUNT(*) FROM media_images", [], |r| r.get(0))
        .unwrap_or(0);

    let attachments_size_opt: Option<i64> = conn.query_row(
        "SELECT SUM(size_bytes) FROM media_attachments",
        [],
        |r| r.get(0)
    ).unwrap_or(None);
    let attachments_size_bytes = attachments_size_opt.unwrap_or(0) as u64;

    let clean_images_size_bytes = if images_size > attachments_size_bytes {
        images_size - attachments_size_bytes
    } else {
        0
    };

    Ok(StorageInfo {
        db_size_bytes: total_db,
        images_size_bytes: clean_images_size_bytes,
        attachments_size_bytes,
        total_size_bytes: total_db + clean_images_size_bytes + attachments_size_bytes,
        total_media,
        total_images,
    })
}

/// Reset the database: drop all data and re-initialize
#[tauri::command]
pub async fn reset_database(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;

    conn.execute_batch(
        "DELETE FROM media_images;
         DELETE FROM media_genres;
         DELETE FROM media_credits;
         DELETE FROM media_fts;
         DELETE FROM media;
         DELETE FROM genres;
         DELETE FROM people;
         DELETE FROM collections;"
    ).map_err(|e| e.to_string())?;

    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);
    let people_dir = db::profiles::profile_people_dir(&storage_dir, profile_id);
    if media_dir.exists() {
        std::fs::remove_dir_all(&media_dir).map_err(|e| e.to_string())?;
    }
    if people_dir.exists() {
        std::fs::remove_dir_all(&people_dir).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(&media_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&people_dir).map_err(|e| e.to_string())?;

    Ok(())
}

/// Clean up orphaned image directories (images on disk but not in DB)
#[tauri::command]
pub async fn cleanup_orphaned_images(state: State<'_, AppState>) -> Result<CleanupReport, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);

    if !media_dir.exists() {
        return Ok(CleanupReport { removed_dirs: 0, freed_bytes: 0, removed_duplicates: 0, duplicate_details: vec![] });
    }

    let mut stmt = conn.prepare("SELECT id FROM media").map_err(|e| e.to_string())?;
    let db_media_ids: std::collections::HashSet<i64> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut removed_dirs: u32 = 0;
    let mut freed_bytes: u64 = 0;
    let mut removed_duplicates: u32 = 0;
    let mut duplicate_details: Vec<DuplicateDetail> = vec![];

    if let Ok(entries) = std::fs::read_dir(&media_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");

                if let Some(id_str) = dir_name.strip_prefix("media_") {
                    if let Ok(media_id) = id_str.parse::<i64>() {
                        if !db_media_ids.contains(&media_id) {
                            let size = dir_size(&path);
                            if std::fs::remove_dir_all(&path).is_ok() {
                                removed_dirs += 1;
                                freed_bytes += size;
                            }
                        } else {
                            let mut ref_stmt = conn.prepare(
                                "SELECT full_path FROM media_images WHERE media_id = ?1"
                            ).map_err(|e| e.to_string())?;
                            let db_paths: std::collections::HashSet<String> = ref_stmt
                                .query_map(rusqlite::params![media_id], |row| row.get(0))
                                .map_err(|e| e.to_string())?
                                .filter_map(|r| r.ok())
                                .collect();

                            let mut media_removed: u32 = 0;

                            if let Ok(file_entries) = std::fs::read_dir(&path) {
                                for file_entry in file_entries.flatten() {
                                    let file_path = file_entry.path();
                                    if !file_path.is_file() { continue; }

                                    let file_name = file_path.file_name()
                                        .and_then(|n| n.to_str())
                                        .unwrap_or("");

                                    if file_name == "cover.webp" { continue; }
                                    if !file_name.ends_with("_full.webp") { continue; }

                                    let relative = file_path
                                        .strip_prefix(&*storage_dir)
                                        .ok()
                                        .and_then(|p| p.to_str())
                                        .map(|s| s.replace('\\', "/"))
                                        .unwrap_or_default();

                                    if !db_paths.contains(&relative) {
                                        let size = file_path.metadata().map(|m| m.len()).unwrap_or(0);
                                        if std::fs::remove_file(&file_path).is_ok() {
                                            freed_bytes += size;
                                            removed_duplicates += 1;
                                            media_removed += 1;
                                        }
                                    }
                                }
                            }

                            if media_removed > 0 {
                                let media_title: String = conn.query_row(
                                    "SELECT title FROM media WHERE id = ?1",
                                    rusqlite::params![media_id],
                                    |row| row.get(0),
                                ).unwrap_or_else(|_| format!("Média #{}", media_id));

                                duplicate_details.push(DuplicateDetail {
                                    media_id,
                                    media_title,
                                    removed_count: media_removed,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(CleanupReport { removed_dirs, freed_bytes, removed_duplicates, duplicate_details })
}

/// Get the current storage path
#[tauri::command]
pub async fn get_storage_path(state: State<'_, AppState>) -> Result<String, String> {
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    Ok(storage_dir.to_string_lossy().to_string())
}

/// Get the current app status (storage accessibility)
#[tauri::command]
pub fn get_app_status(state: State<'_, AppState>) -> Result<AppStatus, String> {
    let storage_missing = *state.storage_missing.lock().map_err(|e| e.to_string())?;
    let storage_path = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?;

    let config = crate::load_config(&app_dir);
    let has_config = config.storage_path.is_some();

    Ok(AppStatus {
        storage_missing,
        storage_path: storage_path.to_string_lossy().to_string(),
        has_config,
    })
}

/// Retry to connect to the storage directory (after reconnecting external drive, etc.)
#[tauri::command]
pub async fn retry_storage_connection(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?;
    let config = crate::load_config(&app_dir);
    let storage_dir = config.storage_path
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| app_dir.clone());

    let profiles_json = storage_dir.join("profiles.json");
    if !storage_dir.exists() || !profiles_json.exists() {
        return Ok(false);
    }

    let manifest = db::profiles::load_manifest(&storage_dir);

    if manifest.profiles.is_empty() {
        let mut storage_missing = state.storage_missing.lock().map_err(|e| e.to_string())?;
        *storage_missing = false;
        app.emit("storage-status-changed", false as bool).map_err(|e: tauri::Error| e.to_string())?;
        return Ok(true);
    }

    let active_id = &manifest.active_profile_id;
    let new_conn = db::profiles::ensure_profile_dir(&storage_dir, active_id);

    new_conn.execute_batch("PRAGMA integrity_check;").map_err(|e| e.to_string())?;

    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    *db = new_conn;

    let mut storage_dir_mut = state.storage_dir.lock().map_err(|e| e.to_string())?;
    *storage_dir_mut = storage_dir.clone();

    let mut storage_missing = state.storage_missing.lock().map_err(|e| e.to_string())?;
    *storage_missing = false;

    app.emit("storage-status-changed", false as bool).map_err(|e: tauri::Error| e.to_string())?;

    Ok(true)
}

/// Reset storage to default app_data directory
#[tauri::command]
pub async fn reset_to_default_storage(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let app_dir = {
        let guard = state.app_dir.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    let storage_dir = {
        let guard = state.storage_dir.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let _move_success = if *storage_dir != *app_dir {
        {
            let mut db = state.db.lock().map_err(|e| e.to_string())?;
            let _ = db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
            let _ = db.execute_batch("PRAGMA journal_mode=DELETE;");
            let temp_conn = rusqlite::Connection::open_in_memory().expect("Failed to open temp DB");
            crate::db::initialize_database(&temp_conn).expect("Failed to init temp DB");
            *db = temp_conn;
        }
        std::thread::sleep(std::time::Duration::from_millis(500));

        let profiles_json = storage_dir.join("profiles.json");
        let new_profiles_json = app_dir.join("profiles.json");

        if profiles_json.exists() {
            if std::fs::rename(&profiles_json, &new_profiles_json).is_err() {
                std::fs::copy(&profiles_json, &new_profiles_json)
                    .map_err(|e| format!("Failed to copy profiles.json: {}", e))?;
                std::fs::remove_file(&profiles_json).ok();
            }
        }

        let profiles_dir = storage_dir.join("profiles");
        if profiles_dir.exists() {
            let new_profiles_dir = app_dir.join("profiles");
            if new_profiles_dir.exists() {
                std::fs::remove_dir_all(&new_profiles_dir).ok();
            }

            if std::fs::rename(&profiles_dir, &new_profiles_dir).is_err() {
                copy_dir_recursive(&profiles_dir, &new_profiles_dir)
                    .map_err(|e| format!("Failed to copy profiles directory: {}", e))?;
                std::fs::remove_dir_all(&profiles_dir).ok();
            }
        }

        let manifest = db::profiles::load_manifest(&app_dir);
        let active_id = &manifest.active_profile_id;
        let new_conn = if !manifest.profiles.is_empty() {
            db::profiles::ensure_profile_dir(&app_dir, active_id)
        } else {
            let c = rusqlite::Connection::open_in_memory().expect("Failed to open in-memory DB");
            db::initialize_database(&c).expect("Failed to init in-memory DB");
            c
        };

        {
            let mut db = state.db.lock().map_err(|e| e.to_string())?;
            *db = new_conn;
        }

        let mut storage_dir_mut = state.storage_dir.lock().map_err(|e| e.to_string())?;
        *storage_dir_mut = app_dir.clone();

        true
    } else {
        false
    };

    let mut config = crate::load_config(&app_dir);
    config.storage_path = None;
    crate::save_config(&app_dir, &config);

    let mut storage_missing = state.storage_missing.lock().map_err(|e| e.to_string())?;
    *storage_missing = false;

    app.emit("storage-status-changed", false as bool).map_err(|e: tauri::Error| e.to_string())?;

    Ok(app_dir.to_string_lossy().to_string())
}

/// Verify if a path is accessible and writable
#[tauri::command]
pub async fn verify_storage_path(path: String) -> Result<bool, String> {
    let path_buf = std::path::PathBuf::from(&path);

    if !path_buf.exists() {
        std::fs::create_dir_all(&path_buf)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let metadata = std::fs::metadata(&path_buf)
        .map_err(|e| format!("Failed to access directory: {}", e))?;

    if !metadata.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let test_file = path_buf.join(".write_test");
    std::fs::write(&test_file, b"test")
        .map_err(|e| format!("Directory not writable: {}", e))?;
    std::fs::remove_file(&test_file)
        .map_err(|e| format!("Failed to clean up test file: {}", e))?;

    Ok(true)
}

/// Initialize storage path for first launch (only updates config.json, no DB manipulation)
#[tauri::command]
pub async fn init_storage_path(
    state: State<'_, AppState>,
    new_path: String,
) -> Result<String, String> {
    let app_dir = state.app_dir.lock().map_err(|e| e.to_string())?;

    let new_path_buf = std::path::PathBuf::from(&new_path);

    if !new_path_buf.exists() {
        std::fs::create_dir_all(&new_path_buf)
            .map_err(|e| format!("Failed to create new directory: {}", e))?;
    }

    let mut config = crate::load_config(&app_dir);
    config.storage_path = Some(new_path.clone());
    crate::save_config(&app_dir, &config);

    let mut storage_dir_mut = state.storage_dir.lock().map_err(|e| e.to_string())?;
    *storage_dir_mut = new_path_buf.clone();

    Ok(new_path)
}

/// Set a new storage path and move all data
#[tauri::command]
pub async fn set_storage_path(
    state: State<'_, AppState>,
    new_path: String,
) -> Result<String, String> {
    let app_dir = {
        let guard = state.app_dir.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    let current_path = {
        let guard = state.storage_dir.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    let new_path_buf = std::path::PathBuf::from(&new_path);

    if !new_path_buf.exists() {
        std::fs::create_dir_all(&new_path_buf)
            .map_err(|e| format!("Failed to create new directory: {}", e))?;
    }

    let profiles_json = current_path.join("profiles.json");
    let has_existing_data = profiles_json.exists();
    if has_existing_data {
        let manifest = crate::db::profiles::load_manifest(&current_path);
        let _active_profile_id = manifest.active_profile_id.clone();

        {
            let mut db = state.db.lock().map_err(|e| e.to_string())?;
            let _ = db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
            let _ = db.execute_batch("PRAGMA journal_mode=DELETE;");
            let temp_conn = rusqlite::Connection::open_in_memory()
                .expect("Failed to open temp DB");
            crate::db::initialize_database(&temp_conn)
                .expect("Failed to init temp DB");
            *db = temp_conn;
        }

        std::thread::sleep(std::time::Duration::from_millis(500));

        let new_profiles_json = new_path_buf.join("profiles.json");
        if std::fs::rename(&profiles_json, &new_profiles_json).is_err() {
            std::fs::copy(&profiles_json, &new_profiles_json)
                .map_err(|e| format!("Failed to copy profiles.json: {}", e))?;
            let mut delete_success = false;
            for attempt in 0..5 {
                if std::fs::remove_file(&profiles_json).is_ok() {
                    delete_success = true;
                    break;
                }
                if attempt < 4 {
                    let delay_ms = 100 * (1 << attempt);
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                }
            }
            if !delete_success {
                warn!("[set_storage_path] Warning: Could not delete old profiles.json after 5 attempts");
            }
        }

        let profiles_dir = current_path.join("profiles");
        if profiles_dir.exists() {
            let new_profiles_dir = new_path_buf.join("profiles");

            if new_profiles_dir.exists() {
                remove_dir_with_retry(&new_profiles_dir, 5)
                    .map_err(|e| format!("Failed to delete new profiles directory: {}", e))?;
            }

            if std::fs::rename(&profiles_dir, &new_profiles_dir).is_err() {
                copy_dir_recursive(&profiles_dir, &new_profiles_dir)
                    .map_err(|e| format!("Failed to copy profiles directory: {}", e))?;
                match remove_dir_with_retry(&profiles_dir, 5) {
                    Ok(_) => {},
                    Err(e) => {
                        warn!("[set_storage_path] Warning: Could not delete old profiles directory: {}", e);
                    }
                }
            }
        }
    }

    {
        let mut storage_dir_mut = state.storage_dir.lock().map_err(|e| e.to_string())?;
        *storage_dir_mut = new_path_buf.clone();
    }

    let mut config = crate::load_config(&app_dir);
    config.storage_path = Some(new_path.clone());
    crate::save_config(&app_dir, &config);

    if has_existing_data {
        let manifest = crate::db::profiles::load_manifest(&new_path_buf);
        let active_profile_id = manifest.active_profile_id.clone();

        let new_conn = if !manifest.profiles.is_empty() {
            crate::db::profiles::ensure_profile_dir(&new_path_buf, &active_profile_id)
        } else {
            let c = rusqlite::Connection::open_in_memory().expect("Failed to open in-memory DB");
            crate::db::initialize_database(&c).expect("Failed to init in-memory DB");
            c
        };

        {
            let mut db = state.db.lock().map_err(|e| e.to_string())?;
            *db = new_conn;
        }
    }

    Ok(new_path)
}
