use tauri::State;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use crate::{AppState, db, models::{Profile, CreateProfileDto, UpdateProfileDto}};

const MAX_ATTEMPTS: u32 = 5;
const BASE_LOCK_DURATION_MS: u64 = 1000;

static RATE_LIMITS: LazyLock<Mutex<HashMap<String, (u32, Instant)>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// After MAX_ATTEMPTS failed tries, subsequent attempts are rejected with
/// an exponential backoff lock (1s, 2s, 4s, 8s, 16s…).
fn check_rate_limit(profile_id: &str) -> Result<(), String> {
    let mut map = RATE_LIMITS.lock().map_err(|e| e.to_string())?;
    if let Some(&(attempts, lock_until)) = map.get(profile_id) {
        if attempts >= MAX_ATTEMPTS && Instant::now() < lock_until {
            let remaining = (lock_until - Instant::now()).as_secs();
            return Err(format!(
                "Trop de tentatives échouées. Réessayez dans {}s.",
                remaining.max(1)
            ));
        }
        if attempts >= MAX_ATTEMPTS {
            map.remove(profile_id);
        }
    }
    Ok(())
}

fn record_failed_attempt(profile_id: &str) {
    if let Ok(mut map) = RATE_LIMITS.lock() {
        let entry = map.entry(profile_id.to_string()).or_insert((0, Instant::now()));
        entry.0 += 1;
        if entry.0 >= MAX_ATTEMPTS {
            let lock_ms = BASE_LOCK_DURATION_MS * (1 << (entry.0 - MAX_ATTEMPTS).min(4));
            entry.1 = Instant::now() + Duration::from_millis(lock_ms);
        }
    }
}

fn record_successful_attempt(profile_id: &str) {
    if let Ok(mut map) = RATE_LIMITS.lock() {
        map.remove(profile_id);
    }
}

#[tauri::command]
pub async fn get_all_profiles(state: State<'_, AppState>) -> Result<Vec<Profile>, String> {
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    Ok(db::profiles::get_all(&storage_dir))
}

#[tauri::command]
pub async fn get_active_profile(state: State<'_, AppState>) -> Result<Profile, String> {
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    manifest.profiles.iter()
        .find(|p| p.id == manifest.active_profile_id)
        .cloned()
        .ok_or_else(|| "Active profile not found".to_string())
}

#[tauri::command]
pub async fn create_profile(
    state: State<'_, AppState>,
    dto: CreateProfileDto,
) -> Result<Profile, String> {
    if dto.name.trim().is_empty() {
        return Err("Le nom du profil ne peut pas être vide".to_string());
    }
    if dto.name.len() > 30 {
        return Err("Le nom du profil est trop long (max 30 caractères)".to_string());
    }

    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    db::profiles::create(&storage_dir, dto)
}

#[tauri::command]
pub async fn update_profile(
    state: State<'_, AppState>,
    dto: UpdateProfileDto,
) -> Result<(), String> {
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    db::profiles::update(&storage_dir, dto)
}

#[tauri::command]
pub async fn delete_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<(), String> {
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    
    // Cannot delete the currently active profile while using it
    let manifest = db::profiles::load_manifest(&storage_dir);
    if manifest.active_profile_id == profile_id {
        return Err("Cannot delete the active profile. Switch profiles first.".to_string());
    }

    db::profiles::delete(&storage_dir, &profile_id)
}

#[tauri::command]
pub async fn verify_profile_password(
    state: State<'_, AppState>,
    profile_id: String,
    password: String,
) -> Result<bool, String> {
    check_rate_limit(&profile_id)?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let valid = db::profiles::verify_password(&storage_dir, &profile_id, &password)?;
    if valid {
        record_successful_attempt(&profile_id);
    } else {
        record_failed_attempt(&profile_id);
    }
    Ok(valid)
}

#[tauri::command]
pub async fn switch_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Profile, String> {
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    
    // Validate profile exists
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile = manifest.profiles.iter()
        .find(|p| p.id == profile_id)
        .cloned()
        .ok_or_else(|| format!("Profile '{}' not found", profile_id))?;

    // Update active profile in manifest
    db::profiles::set_active(&storage_dir, &profile_id)?;

    // Swap the DB connection
    let new_conn = db::profiles::ensure_profile_dir(&storage_dir, &profile_id);
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    *db = new_conn;

    Ok(profile)
}
