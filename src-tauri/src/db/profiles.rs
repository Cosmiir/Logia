use std::fs;
use std::path::{Path, PathBuf};
use rusqlite::Connection;
use crate::models::{Profile, CreateProfileDto, UpdateProfileDto};

const PROFILES_FILE: &str = "profiles.json";
const DEFAULT_PROFILE_ID: &str = "default";

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct ProfilesManifest {
    pub active_profile_id: String,
    pub profiles: Vec<Profile>,
}

impl Default for ProfilesManifest {
    fn default() -> Self {
        Self {
            active_profile_id: String::new(),
            profiles: Vec::new(),
        }
    }
}

/// Get the path to profiles.json
fn manifest_path(app_dir: &Path) -> PathBuf {
    app_dir.join(PROFILES_FILE)
}

/// Get the directory for a specific profile
pub fn profile_dir(app_dir: &Path, profile_id: &str) -> PathBuf {
    app_dir.join("profiles").join(profile_id)
}

/// Get the DB path for a specific profile
pub fn profile_db_path(app_dir: &Path, profile_id: &str) -> PathBuf {
    profile_dir(app_dir, profile_id).join("logia.db")
}

/// Get the storage directory for a specific profile
pub fn profile_storage_dir(app_dir: &Path, profile_id: &str) -> PathBuf {
    profile_dir(app_dir, profile_id).join("storage")
}

/// Get the media root directory for a specific profile
pub fn profile_media_dir(app_dir: &Path, profile_id: &str) -> PathBuf {
    profile_storage_dir(app_dir, profile_id).join("media")
}

/// Get the people directory for a specific profile
pub fn profile_people_dir(app_dir: &Path, profile_id: &str) -> PathBuf {
    profile_storage_dir(app_dir, profile_id).join("people")
}

/// Load or create the profiles manifest
pub fn load_manifest(app_dir: &Path) -> ProfilesManifest {
    let path = manifest_path(app_dir);
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        // Only create profiles.json if the directory exists
        // If directory doesn't exist, return empty manifest without creating file
        if app_dir.exists() {
            let manifest = ProfilesManifest::default();
            let _ = save_manifest(app_dir, &manifest); // Ignore errors
            manifest
        } else {
            ProfilesManifest::default()
        }
    }
}

/// Save the profiles manifest
pub fn save_manifest(app_dir: &Path, manifest: &ProfilesManifest) -> Result<(), String> {
    let path = manifest_path(app_dir);
    let content = serde_json::to_string_pretty(manifest).map_err(|e| format!("Failed to serialize profiles: {}", e))?;
    fs::write(path, content).map_err(|e| format!("Failed to write profiles.json: {}", e))?;
    Ok(())
}

/// Ensure a profile's directory structure exists and return an initialized DB connection
pub fn ensure_profile_dir(app_dir: &Path, profile_id: &str) -> Connection {
    let dir = profile_dir(app_dir, profile_id);
    fs::create_dir_all(&dir).expect("Failed to create profile directory");

    let storage = profile_storage_dir(app_dir, profile_id);
    fs::create_dir_all(&storage).expect("Failed to create profile storage directory");

    let media = profile_media_dir(app_dir, profile_id);
    fs::create_dir_all(&media).expect("Failed to create profile media directory");

    let people = profile_people_dir(app_dir, profile_id);
    fs::create_dir_all(&people).expect("Failed to create profile people directory");

    let db_path = profile_db_path(app_dir, profile_id);
    let conn = Connection::open(&db_path).expect("Failed to open profile database");
    super::initialize_database(&conn).expect("Failed to initialize profile database");

    conn
}

/// Get all profiles
pub fn get_all(app_dir: &Path) -> Vec<Profile> {
    load_manifest(app_dir).profiles
}

/// Create a new profile
pub fn create(app_dir: &Path, dto: CreateProfileDto) -> Result<Profile, String> {
    let mut manifest = load_manifest(app_dir);

    // Reject duplicate names (case-insensitive)
    let trimmed = dto.name.trim();
    if manifest.profiles.iter().any(|p| p.name.eq_ignore_ascii_case(trimmed)) {
        return Err("A profile with this name already exists".to_string());
    }

    // Generate ID from name (slug)
    let id = slug_from_name(&dto.name, &manifest.profiles);

    let password_hash = if let Some(ref pw) = dto.password {
        if !pw.is_empty() {
            Some(bcrypt::hash(pw, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?)
        } else {
            None
        }
    } else {
        None
    };

    let profile = Profile {
        id: id.clone(),
        name: dto.name,
        avatar_id: dto.avatar_id.unwrap_or_else(|| "default-1".to_string()),
        custom_avatar_data_url: None,
        custom_avatars: Vec::new(),
        password_hash,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    // Create directory + DB
    ensure_profile_dir(app_dir, &id);

    manifest.profiles.push(profile.clone());
    save_manifest(app_dir, &manifest)?;

    Ok(profile)
}

/// Update a profile's metadata
pub fn update(app_dir: &Path, dto: UpdateProfileDto) -> Result<(), String> {
    let mut manifest = load_manifest(app_dir);

    let profile = manifest.profiles.iter_mut()
        .find(|p| p.id == dto.id)
        .ok_or_else(|| format!("Profile '{}' not found", dto.id))?;

    if let Some(name) = dto.name {
        profile.name = name;
    }
    if let Some(ref avatar_id) = dto.avatar_id {
        profile.avatar_id = avatar_id.clone();
        // When switching to a default avatar, clear the active custom URL
        if avatar_id != "custom" {
            profile.custom_avatar_data_url = None;
        }
    }
    if let Some(data_url) = dto.custom_avatar_data_url {
        profile.custom_avatar_data_url = Some(data_url.clone());
        // Also save to persistent custom avatars list (avoid duplicates)
        if !profile.custom_avatars.contains(&data_url) {
            profile.custom_avatars.push(data_url);
        }
    }
    if let Some(remove_url) = dto.remove_custom_avatar {
        profile.custom_avatars.retain(|u| u != &remove_url);
        // If the removed avatar was the active one, reset to default
        if profile.avatar_id == "custom" && profile.custom_avatar_data_url.as_deref() == Some(&remove_url) {
            profile.avatar_id = "default-1".to_string();
            profile.custom_avatar_data_url = None;
        }
    }
    if dto.remove_password.unwrap_or(false) {
        profile.password_hash = None;
    } else if let Some(ref pw) = dto.password {
        if !pw.is_empty() {
            profile.password_hash = Some(bcrypt::hash(pw, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?);
        }
    }

    save_manifest(app_dir, &manifest)?;
    Ok(())
}

/// Verify a profile's password
pub fn verify_password(app_dir: &Path, profile_id: &str, password: &str) -> Result<bool, String> {
    let manifest = load_manifest(app_dir);
    let profile = manifest.profiles.iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| format!("Profile '{}' not found", profile_id))?;

    match &profile.password_hash {
        None => Ok(true), // No password set, always OK
        Some(hash) => bcrypt::verify(password, hash).map_err(|e| e.to_string()),
    }
}

/// Delete a profile (cannot delete the last one)
pub fn delete(app_dir: &Path, profile_id: &str) -> Result<(), String> {
    let mut manifest = load_manifest(app_dir);

    if manifest.profiles.len() <= 1 {
        return Err("Cannot delete the last profile".to_string());
    }

    manifest.profiles.retain(|p| p.id != profile_id);

    // If the deleted profile was active, switch to the first remaining
    if manifest.active_profile_id == profile_id {
        manifest.active_profile_id = manifest.profiles.first()
            .map(|p| p.id.clone())
            .unwrap_or_else(|| DEFAULT_PROFILE_ID.to_string());
    }

    save_manifest(app_dir, &manifest)?;

    // Remove the profile directory
    let dir = profile_dir(app_dir, profile_id);
    if dir.exists() {
        let _ = fs::remove_dir_all(&dir);
    }

    Ok(())
}

/// Set the active profile
pub fn set_active(app_dir: &Path, profile_id: &str) -> Result<(), String> {
    let mut manifest = load_manifest(app_dir);

    if !manifest.profiles.iter().any(|p| p.id == profile_id) {
        return Err(format!("Profile '{}' not found", profile_id));
    }

    manifest.active_profile_id = profile_id.to_string();
    save_manifest(app_dir, &manifest)?;
    Ok(())
}

/// Generate a URL-safe slug from a profile name, ensuring uniqueness
fn slug_from_name(name: &str, existing: &[Profile]) -> String {
    let base: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    let base = if base.is_empty() { "profile".to_string() } else { base };

    let existing_ids: Vec<&str> = existing.iter().map(|p| p.id.as_str()).collect();

    if !existing_ids.contains(&base.as_str()) {
        return base;
    }

    let mut counter = 2;
    loop {
        let candidate = format!("{}-{}", base, counter);
        if !existing_ids.contains(&candidate.as_str()) {
            return candidate;
        }
        counter += 1;
    }
}
