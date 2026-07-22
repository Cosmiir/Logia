use tauri::State;
use crate::{AppState, models::{Media, MediaAttachment, MediaDetail, MediaListItem, CreateMediaDto, UpdateMediaDto}, db, utils};
use serde::Serialize;
use std::path::Path;

/// Convert a relative path to absolute using storage_dir
fn to_absolute_path(storage_dir: &Path, relative: &str) -> String {
    storage_dir.join(relative).to_string_lossy().to_string()
}

/// Structure de progression pour les uploads avec Channel
#[derive(Clone, Serialize)]
pub struct ImageUploadProgress {
    pub file_index: usize,
    pub total_files: usize,
    pub file_name: String,
    pub stage: String,  // "reading" | "processing" | "saving" | "done"
    pub percent: u8,
}

#[derive(Clone, Serialize)]
pub struct AttachmentUploadResult {
    pub attachment_id: i64,
    pub path: String,
}

/// Read EXIF orientation from a file on disk
fn get_exif_orientation(file_path: &str) -> Option<u32> {
    let file = std::fs::File::open(file_path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;
    let orientation_tag = exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)?;
    let orientation = orientation_tag.value.get_uint(0)?;
    match orientation {
        3 => Some(180),
        6 => Some(90),
        8 => Some(270),
        _ => None,
    }
}

/// Lire l'orientation EXIF depuis des bytes en mémoire
fn get_exif_orientation_from_bytes(data: &[u8]) -> Option<u32> {
    let mut cursor = std::io::Cursor::new(data);
    let exif = exif::Reader::new().read_from_container(&mut cursor).ok()?;
    let orientation_tag = exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)?;
    let orientation = orientation_tag.value.get_uint(0)?;
    match orientation {
        3 => Some(180),
        6 => Some(90),
        8 => Some(270),
        _ => None,
    }
}

fn enrich_with_genres(conn: &rusqlite::Connection, media_list: Vec<Media>) -> Result<Vec<MediaListItem>, String> {
    let ids: Vec<i64> = media_list.iter().map(|m| m.id).collect();
    let mut genres_map = db::genres::get_by_media_ids(conn, &ids).map_err(|e| e.to_string())?;
    Ok(media_list.into_iter().map(|m| {
        let genres = genres_map.remove(&m.id).unwrap_or_default();
        MediaListItem { media: m, genres }
    }).collect())
}

/// Parse sort criteria JSON, falling back to created_at desc
fn parse_sort_criteria(sort_criteria_json: &Option<String>) -> Vec<db::media::SortCriterion> {
    sort_criteria_json
        .as_ref()
        .and_then(|json| serde_json::from_str(json).ok())
        .unwrap_or_else(|| {
            vec![db::media::SortCriterion {
                field: "created_at".to_string(),
                order: "desc".to_string(),
            }]
        })
}

/// Convert cover_image paths to absolute using storage_dir
fn absolutize_covers(media: Vec<Media>, storage_dir: &Path) -> Vec<Media> {
    media.into_iter().map(|mut m| {
        if let Some(ref cover) = m.cover_image {
            m.cover_image = Some(to_absolute_path(storage_dir, cover));
        }
        m
    }).collect()
}

/// Common filter parameters for media queries — extracted to reduce duplication
struct MediaFilterParams<'a> {
    search_query: &'a Option<String>,
    genre_ids: &'a Option<Vec<i64>>,
    person_ids: &'a Option<Vec<i64>>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    media_statuses: &'a Option<Vec<String>>,
    progress_statuses: &'a Option<Vec<String>>,
    creators: &'a Option<Vec<String>>,
    release_date_from: &'a Option<String>,
    release_date_to: &'a Option<String>,
    experience_date_from: &'a Option<String>,
    experience_date_to: &'a Option<String>,
    created_at_from: &'a Option<String>,
    created_at_to: &'a Option<String>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
}

impl<'a> MediaFilterParams<'a> {
    fn query_media(
        &self,
        conn: &rusqlite::Connection,
        collection_id: Option<i64>,
        sort_criteria: &[db::media::SortCriterion],
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<Media>, rusqlite::Error> {
        db::media::get_media(
            conn,
            collection_id,
            self.search_query.as_deref(),
            self.genre_ids.as_deref(),
            self.person_ids.as_deref(),
            self.min_rating,
            self.max_rating,
            sort_criteria,
            limit,
            offset,
            self.media_statuses.as_deref(),
            self.progress_statuses.as_deref(),
            self.creators.as_deref(),
            self.release_date_from.as_deref(),
            self.release_date_to.as_deref(),
            self.experience_date_from.as_deref(),
            self.experience_date_to.as_deref(),
            self.created_at_from.as_deref(),
            self.created_at_to.as_deref(),
            self.progress_total_min,
            self.progress_total_max,
            self.progress_current_min,
            self.progress_current_max,
        )
    }

    fn count_media(
        &self,
        conn: &rusqlite::Connection,
        collection_id: Option<i64>,
    ) -> Result<i64, rusqlite::Error> {
        db::media::count_media(
            conn,
            collection_id,
            self.search_query.as_deref(),
            self.genre_ids.as_deref(),
            self.person_ids.as_deref(),
            self.min_rating,
            self.max_rating,
            self.media_statuses.as_deref(),
            self.progress_statuses.as_deref(),
            self.creators.as_deref(),
            self.release_date_from.as_deref(),
            self.release_date_to.as_deref(),
            self.experience_date_from.as_deref(),
            self.experience_date_to.as_deref(),
            self.created_at_from.as_deref(),
            self.created_at_to.as_deref(),
            self.progress_total_min,
            self.progress_total_max,
            self.progress_current_min,
            self.progress_current_max,
        )
    }

    fn query_media_ids(
        &self,
        conn: &rusqlite::Connection,
        collection_id: Option<i64>,
        sort_criteria: &[db::media::SortCriterion],
    ) -> Result<Vec<i64>, rusqlite::Error> {
        db::media::get_media_ids(
            conn,
            collection_id,
            self.search_query.as_deref(),
            self.genre_ids.as_deref(),
            self.person_ids.as_deref(),
            self.min_rating,
            self.max_rating,
            sort_criteria,
            self.media_statuses.as_deref(),
            self.progress_statuses.as_deref(),
            self.creators.as_deref(),
            self.release_date_from.as_deref(),
            self.release_date_to.as_deref(),
            self.experience_date_from.as_deref(),
            self.experience_date_to.as_deref(),
            self.created_at_from.as_deref(),
            self.created_at_to.as_deref(),
            self.progress_total_min,
            self.progress_total_max,
            self.progress_current_min,
            self.progress_current_max,
        )
    }
}

#[tauri::command]
pub async fn get_media_by_collection(
    state: State<'_, AppState>,
    collection_id: i64,
    search_query: Option<String>,
    genre_ids: Option<Vec<i64>>,
    person_ids: Option<Vec<i64>>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    sort_criteria_json: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    // Additional filters
    media_statuses: Option<Vec<String>>,
    progress_statuses: Option<Vec<String>>,
    creators: Option<Vec<String>>,
    release_date_from: Option<String>,
    release_date_to: Option<String>,
    experience_date_from: Option<String>,
    experience_date_to: Option<String>,
    created_at_from: Option<String>,
    created_at_to: Option<String>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<Vec<MediaListItem>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let sort_criteria = parse_sort_criteria(&sort_criteria_json);

    let filters = MediaFilterParams {
        search_query: &search_query,
        genre_ids: &genre_ids,
        person_ids: &person_ids,
        min_rating,
        max_rating,
        media_statuses: &media_statuses,
        progress_statuses: &progress_statuses,
        creators: &creators,
        release_date_from: &release_date_from,
        release_date_to: &release_date_to,
        experience_date_from: &experience_date_from,
        experience_date_to: &experience_date_to,
        created_at_from: &created_at_from,
        created_at_to: &created_at_to,
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
    };

    let media = filters.query_media(&conn, Some(collection_id), &sort_criteria, limit, offset)
        .map_err(|e| e.to_string())?;

    let media = absolutize_covers(media, &storage_dir);
    let result = enrich_with_genres(&conn, media)?;
    Ok(result)
}

#[tauri::command]
pub async fn get_all_media(
    state: State<'_, AppState>,
    search_query: Option<String>,
    genre_ids: Option<Vec<i64>>,
    person_ids: Option<Vec<i64>>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    sort_criteria_json: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    // Additional filters
    media_statuses: Option<Vec<String>>,
    progress_statuses: Option<Vec<String>>,
    creators: Option<Vec<String>>,
    release_date_from: Option<String>,
    release_date_to: Option<String>,
    experience_date_from: Option<String>,
    experience_date_to: Option<String>,
    created_at_from: Option<String>,
    created_at_to: Option<String>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<Vec<MediaListItem>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let sort_criteria = parse_sort_criteria(&sort_criteria_json);

    let filters = MediaFilterParams {
        search_query: &search_query,
        genre_ids: &genre_ids,
        person_ids: &person_ids,
        min_rating,
        max_rating,
        media_statuses: &media_statuses,
        progress_statuses: &progress_statuses,
        creators: &creators,
        release_date_from: &release_date_from,
        release_date_to: &release_date_to,
        experience_date_from: &experience_date_from,
        experience_date_to: &experience_date_to,
        created_at_from: &created_at_from,
        created_at_to: &created_at_to,
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
    };

    let media = filters.query_media(&conn, None, &sort_criteria, limit, offset)
        .map_err(|e| e.to_string())?;

    let media = absolutize_covers(media, &storage_dir);
    let result = enrich_with_genres(&conn, media)?;
    Ok(result)
}

#[tauri::command]
pub async fn count_all_media(
    state: State<'_, AppState>,
    search_query: Option<String>,
    genre_ids: Option<Vec<i64>>,
    person_ids: Option<Vec<i64>>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    media_statuses: Option<Vec<String>>,
    progress_statuses: Option<Vec<String>>,
    creators: Option<Vec<String>>,
    release_date_from: Option<String>,
    release_date_to: Option<String>,
    experience_date_from: Option<String>,
    experience_date_to: Option<String>,
    created_at_from: Option<String>,
    created_at_to: Option<String>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let filters = MediaFilterParams {
        search_query: &search_query,
        genre_ids: &genre_ids,
        person_ids: &person_ids,
        min_rating,
        max_rating,
        media_statuses: &media_statuses,
        progress_statuses: &progress_statuses,
        creators: &creators,
        release_date_from: &release_date_from,
        release_date_to: &release_date_to,
        experience_date_from: &experience_date_from,
        experience_date_to: &experience_date_to,
        created_at_from: &created_at_from,
        created_at_to: &created_at_to,
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
    };

    let result = filters.count_media(&conn, None).map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
pub async fn count_media_by_collection(
    state: State<'_, AppState>,
    collection_id: i64,
    search_query: Option<String>,
    genre_ids: Option<Vec<i64>>,
    person_ids: Option<Vec<i64>>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    media_statuses: Option<Vec<String>>,
    progress_statuses: Option<Vec<String>>,
    creators: Option<Vec<String>>,
    release_date_from: Option<String>,
    release_date_to: Option<String>,
    experience_date_from: Option<String>,
    experience_date_to: Option<String>,
    created_at_from: Option<String>,
    created_at_to: Option<String>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let filters = MediaFilterParams {
        search_query: &search_query,
        genre_ids: &genre_ids,
        person_ids: &person_ids,
        min_rating,
        max_rating,
        media_statuses: &media_statuses,
        progress_statuses: &progress_statuses,
        creators: &creators,
        release_date_from: &release_date_from,
        release_date_to: &release_date_to,
        experience_date_from: &experience_date_from,
        experience_date_to: &experience_date_to,
        created_at_from: &created_at_from,
        created_at_to: &created_at_to,
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
    };

    let result = filters.count_media(&conn, Some(collection_id)).map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
pub async fn get_all_media_ids(
    state: State<'_, AppState>,
    search_query: Option<String>,
    genre_ids: Option<Vec<i64>>,
    person_ids: Option<Vec<i64>>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    sort_criteria_json: Option<String>,
    media_statuses: Option<Vec<String>>,
    progress_statuses: Option<Vec<String>>,
    creators: Option<Vec<String>>,
    release_date_from: Option<String>,
    release_date_to: Option<String>,
    experience_date_from: Option<String>,
    experience_date_to: Option<String>,
    created_at_from: Option<String>,
    created_at_to: Option<String>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<Vec<i64>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let sort_criteria = parse_sort_criteria(&sort_criteria_json);
    let filters = MediaFilterParams {
        search_query: &search_query,
        genre_ids: &genre_ids,
        person_ids: &person_ids,
        min_rating,
        max_rating,
        media_statuses: &media_statuses,
        progress_statuses: &progress_statuses,
        creators: &creators,
        release_date_from: &release_date_from,
        release_date_to: &release_date_to,
        experience_date_from: &experience_date_from,
        experience_date_to: &experience_date_to,
        created_at_from: &created_at_from,
        created_at_to: &created_at_to,
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
    };
    let ids = filters.query_media_ids(&conn, None, &sort_criteria).map_err(|e| e.to_string())?;
    Ok(ids)
}

#[tauri::command]
pub async fn get_media_ids_by_collection(
    state: State<'_, AppState>,
    collection_id: i64,
    search_query: Option<String>,
    genre_ids: Option<Vec<i64>>,
    person_ids: Option<Vec<i64>>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    sort_criteria_json: Option<String>,
    media_statuses: Option<Vec<String>>,
    progress_statuses: Option<Vec<String>>,
    creators: Option<Vec<String>>,
    release_date_from: Option<String>,
    release_date_to: Option<String>,
    experience_date_from: Option<String>,
    experience_date_to: Option<String>,
    created_at_from: Option<String>,
    created_at_to: Option<String>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<Vec<i64>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let sort_criteria = parse_sort_criteria(&sort_criteria_json);
    let filters = MediaFilterParams {
        search_query: &search_query,
        genre_ids: &genre_ids,
        person_ids: &person_ids,
        min_rating,
        max_rating,
        media_statuses: &media_statuses,
        progress_statuses: &progress_statuses,
        creators: &creators,
        release_date_from: &release_date_from,
        release_date_to: &release_date_to,
        experience_date_from: &experience_date_from,
        experience_date_to: &experience_date_to,
        created_at_from: &created_at_from,
        created_at_to: &created_at_to,
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
    };
    let ids = filters.query_media_ids(&conn, Some(collection_id), &sort_criteria).map_err(|e| e.to_string())?;
    Ok(ids)
}

#[tauri::command]
pub async fn get_distinct_creators(
    state: State<'_, AppState>,
    collection_id: Option<i64>,
    search_query: Option<String>,
    genre_ids: Option<Vec<i64>>,
    person_ids: Option<Vec<i64>>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    media_statuses: Option<Vec<String>>,
    progress_statuses: Option<Vec<String>>,
    release_date_from: Option<String>,
    release_date_to: Option<String>,
    experience_date_from: Option<String>,
    experience_date_to: Option<String>,
    created_at_from: Option<String>,
    created_at_to: Option<String>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<Vec<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let result = db::media::get_distinct_creators(
        &conn,
        collection_id,
        search_query.as_deref(),
        genre_ids.as_deref(),
        person_ids.as_deref(),
        min_rating,
        max_rating,
        media_statuses.as_deref(),
        progress_statuses.as_deref(),
        release_date_from.as_deref(),
        release_date_to.as_deref(),
        experience_date_from.as_deref(),
        experience_date_to.as_deref(),
        created_at_from.as_deref(),
        created_at_to.as_deref(),
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
    ).map_err(|e| e.to_string())?;
    Ok(result)
}

/// Get the min and max progress_current values for a collection
#[tauri::command]
pub async fn get_progress_current_range(
    state: State<'_, AppState>,
    collection_id: i64,
) -> Result<(f64, f64), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let result = db::media::get_progress_current_range(&conn, collection_id)
        .map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
pub async fn get_media_by_id(
    state: State<'_, AppState>,
    media_id: i64,
) -> Result<Option<MediaDetail>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    
    let mut media_detail = db::media::get_by_id(&conn, media_id).map_err(|e| e.to_string())?;
    
    if let Some(ref mut detail) = media_detail {
        // Reconstruct absolute path for cover_image
        if let Some(ref cover) = detail.media.cover_image {
            detail.media.cover_image = Some(to_absolute_path(&storage_dir, cover));
        }
        
        // Reconstruct absolute paths for images
        for image in &mut detail.images {
            image.full_path = to_absolute_path(&storage_dir, &image.full_path);
            image.thumb_path = to_absolute_path(&storage_dir, &image.thumb_path);
        }

        for attachment in &mut detail.attachments {
            attachment.stored_path = to_absolute_path(&storage_dir, &attachment.stored_path);
        }

        // Reconstruct absolute paths for credit photos
        for credit in &mut detail.credits {
            if let Some(ref path) = credit.photo_path {
                credit.photo_path = Some(to_absolute_path(&storage_dir, path));
            }
        }
    }
    
    Ok(media_detail)
}

#[tauri::command]
pub async fn create_media(
    state: State<'_, AppState>,
    mut dto: CreateMediaDto,
) -> Result<i64, String> {
    utils::validate_media_title(&dto.title)?;

    if let Some(rating) = dto.user_rating {
        utils::validate_rating(rating)?;
    }

    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    let genre_ids = dto.genre_ids.take();
    if let Some(ref ids) = genre_ids {
        utils::validate_media_genres(ids)?;
    }
    let credits = dto.credits.take();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let media_id = db::media::insert(&tx, dto).map_err(|e| e.to_string())?;
    if let Some(ids) = genre_ids {
        db::genres::link_to_media(&tx, media_id, &ids).map_err(|e| e.to_string())?;
    }
    if let Some(c) = credits {
        db::people::link_to_media(&tx, media_id, &c).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(media_id)
}

fn safe_attachment_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').to_string();
    if trimmed.is_empty() { "file".to_string() } else { trimmed }
}

#[tauri::command]
pub async fn upload_media_attachments_from_paths(
    state: State<'_, AppState>,
    media_id: i64,
    file_paths: Vec<String>,
) -> Result<Vec<AttachmentUploadResult>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);
    let attachments_dir = media_dir.join(format!("media_{}", media_id)).join("attachments");
    std::fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for file_path in file_paths {
        let source = std::path::Path::new(&file_path);
        if !source.is_file() {
            return Err(format!("File not found: {}", file_path));
        }

        let original_name = source
            .file_name()
            .and_then(|s| s.to_str())
            .map(safe_attachment_file_name)
            .unwrap_or_else(|| "file".to_string());

        let attachment_id_hint = chrono::Utc::now().timestamp_millis();
        let stored_name = format!("{}_{}", attachment_id_hint, original_name);
        let destination = attachments_dir.join(&stored_name);
        std::fs::copy(source, &destination)
            .map_err(|e| format!("Failed to copy {} : {}", original_name, e))?;

        let size_bytes = std::fs::metadata(&destination)
            .map(|m| m.len() as i64)
            .unwrap_or(0);

        let relative_path = destination
            .strip_prefix(&*storage_dir)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.replace('\\', "/"))
            .unwrap_or_default();

        let attachment_id = db::media::insert_attachment(
            &conn,
            media_id,
            &original_name,
            &relative_path,
            size_bytes,
        ).map_err(|e| e.to_string())?;

        results.push(AttachmentUploadResult {
            attachment_id,
            path: to_absolute_path(&storage_dir, &relative_path),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn delete_media_attachment(
    state: State<'_, AppState>,
    attachment_id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let attachment: MediaAttachment = db::media::get_attachment_by_id(&conn, attachment_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Attachment not found: {}", attachment_id))?;

    let path_abs = to_absolute_path(&storage_dir, &attachment.stored_path);
    let path = std::path::Path::new(&path_abs);
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }

    db::media::delete_attachment(&conn, attachment_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_media(
    state: State<'_, AppState>,
    mut dto: UpdateMediaDto,
) -> Result<(), String> {
    if let Some(title) = dto.title.as_deref() {
        utils::validate_media_title(title)?;
    }
    
    if let Some(rating) = dto.user_rating {
        utils::validate_rating(rating)?;
    }

    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    let media_id = dto.media_id;
    let genre_ids = dto.genre_ids.take();
    if let Some(ref ids) = genre_ids {
        utils::validate_media_genres(ids)?;
    }
    let credits = dto.credits.take();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    db::media::update(&tx, dto).map_err(|e| e.to_string())?;
    if let Some(ids) = genre_ids {
        db::genres::link_to_media(&tx, media_id, &ids).map_err(|e| e.to_string())?;
    }
    if let Some(c) = credits {
        db::people::link_to_media(&tx, media_id, &c).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_media(
    state: State<'_, AppState>,
    media_id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);

    // Delete image files from disk
    let media_images_dir = media_dir.join(format!("media_{}", media_id));
    if media_images_dir.exists() {
        let _ = std::fs::remove_dir_all(&media_images_dir);
    }

    db::media::delete(&conn, media_id).map_err(|e| e.to_string())
}

/// Appliquer la rotation EXIF à une image
fn apply_exif_rotation(img: image::DynamicImage, rotation: u32) -> image::DynamicImage {
    match rotation {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => img,
    }
}

/// Encode a DynamicImage to WebP at the given quality (0-100).
pub fn encode_webp(img: &image::DynamicImage, quality: f32) -> Result<Vec<u8>, String> {
    let encoder = match webp::Encoder::from_image(img) {
        Ok(encoder) => encoder,
        Err(_) => {
            // Fallback for formats not directly supported by the webp crate (e.g. grayscale, 16-bit)
            let rgba_img = image::DynamicImage::ImageRgba8(img.to_rgba8());
            let encoder = webp::Encoder::from_image(&rgba_img)
                .map_err(|e| format!("WebP encoder error: {}", e))?;
            let mem = encoder.encode(quality);
            return Ok(mem.to_vec());
        }
    };
    let mem = encoder.encode(quality);
    Ok(mem.to_vec())
}

/// Upload an image for a media item. Accepts base64-encoded image data.
/// Processes the image (creates full WebP), saves to disk, inserts into DB.
/// Full image: max 1920px on longest side, WebP quality 80.
/// No per-image thumbnail is generated — only a single cover.webp is created
/// via set_media_cover when the user crops the cover.
#[tauri::command]
pub async fn upload_media_image(
    state: State<'_, AppState>,
    media_id: i64,
    image_data_base64: String,
    file_name: String,
    position: i32,
) -> Result<i64, String> {
    use image::imageops::FilterType;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);

    // Create media-specific images directory
    let media_images_dir = media_dir.join(format!("media_{}", media_id));
    std::fs::create_dir_all(&media_images_dir).map_err(|e| e.to_string())?;

    // Decode base64
    use base64::Engine;
    let engine = base64::engine::general_purpose::STANDARD;
    let raw_bytes = engine.decode(&image_data_base64)
        .map_err(|e| format!("Invalid base64: {}", e))?;

    // Load image
    let mut img = image::load_from_memory(&raw_bytes)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Apply EXIF rotation if needed
    if let Some(rotation) = get_exif_orientation_from_bytes(&raw_bytes) {
        img = apply_exif_rotation(img, rotation);
    }

    // Generate filename
    let stem = std::path::Path::new(&file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let full_name = format!("{}_{}_full.webp", stem, position);
    let full_path = media_images_dir.join(&full_name);

    // Resize full image: max 1920px on longest side, keep aspect ratio
    let full_img = {
        let max_dim = 1920u32;
        if img.width() > max_dim || img.height() > max_dim {
            img.resize(max_dim, max_dim, FilterType::Lanczos3)
        } else {
            img.clone()
        }
    };

    // Save as WebP
    let full_webp = encode_webp(&full_img, 80.0)?;
    std::fs::write(&full_path, &full_webp).map_err(|e| e.to_string())?;

    // Convert to relative path (from storage_dir) with forward slashes
    let relative_path = full_path
        .strip_prefix(&*storage_dir)
        .ok()
        .and_then(|p| p.to_str())
        .map(|s| s.replace('\\', "/"))
        .unwrap_or_else(|| "".to_string());

    // Insert into DB (thumb_path = full_path for backward compat)
    let image_id = db::media::insert_image(
        &conn,
        media_id,
        &relative_path,
        &relative_path,
        position,
    ).map_err(|e| e.to_string())?;

    Ok(image_id)
}

/// Upload multiple images from disk paths (drag-drop native).
/// Processes directly in Rust without base64 round-trip.
/// Emits progress events via Channel.
#[tauri::command]
pub async fn upload_media_images_from_paths(
    state: State<'_, AppState>,
    media_id: i64,
    file_paths: Vec<String>,
    on_progress: tauri::ipc::Channel<ImageUploadProgress>,
    start_position: Option<i32>,
) -> Result<Vec<(i64, String)>, String> {
    use image::imageops::FilterType;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);

    // Create media-specific images directory
    let media_images_dir = media_dir.join(format!("media_{}", media_id));
    std::fs::create_dir_all(&media_images_dir).map_err(|e| e.to_string())?;

    let total_files = file_paths.len();
    let start_pos = start_position.unwrap_or(0);
    // Store (relative_path, absolute_path, position) for batch insert
    let mut to_insert: Vec<(String, String, i32)> = Vec::new();

    for (file_index, file_path) in file_paths.iter().enumerate() {
        let file_name = std::path::Path::new(file_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("image");

        // Emit reading progress
        on_progress.send(ImageUploadProgress {
            file_index,
            total_files,
            file_name: file_name.to_string(),
            stage: "reading".to_string(),
            percent: 10,
        }).ok();

        // Read file from disk directly
        let raw_bytes = std::fs::read(file_path)
            .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;

        // Emit processing progress
        on_progress.send(ImageUploadProgress {
            file_index,
            total_files,
            file_name: file_name.to_string(),
            stage: "processing".to_string(),
            percent: 40,
        }).ok();

        // Load image
        let mut img = image::load_from_memory(&raw_bytes)
            .map_err(|e| format!("Failed to decode image {}: {}", file_path, e))?;

        // Apply EXIF rotation if needed
        if let Some(rotation) = get_exif_orientation(file_path) {
            img = apply_exif_rotation(img, rotation);
        }

        // Generate filename and position (offset by start_position to avoid conflicts)
        let position = start_pos + file_index as i32;
        let stem = std::path::Path::new(file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("image");
        let full_name = format!("{}_{}_full.webp", stem, position);
        let full_path = media_images_dir.join(&full_name);

        // Emit saving progress
        on_progress.send(ImageUploadProgress {
            file_index,
            total_files,
            file_name: file_name.to_string(),
            stage: "saving".to_string(),
            percent: 85,
        }).ok();

        // Resize full image: max 1920px on longest side, keep aspect ratio
        let full_img = {
            let max_dim = 1920u32;
            if img.width() > max_dim || img.height() > max_dim {
                img.resize(max_dim, max_dim, FilterType::Lanczos3)
            } else {
                img
            }
        };

        // Save as WebP
        let full_webp = encode_webp(&full_img, 80.0)?;
        std::fs::write(&full_path, &full_webp)
            .map_err(|e| format!("Failed to write file {}: {}", full_path.display(), e))?;

        // Convert to relative path (from storage_dir) with forward slashes
        let relative_path = full_path
            .strip_prefix(&*storage_dir)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.replace('\\', "/"))
            .unwrap_or_else(|| "".to_string());
        // Build absolute path for frontend display
        let absolute_path = to_absolute_path(&storage_dir, &relative_path);
        to_insert.push((relative_path, absolute_path, position));

        // Emit done progress
        on_progress.send(ImageUploadProgress {
            file_index,
            total_files,
            file_name: file_name.to_string(),
            stage: "done".to_string(),
            percent: 100,
        }).ok();
    }

    // Single DB lock for all insertions (already locked at start)
    let mut results = Vec::new();
    for (relative_path, absolute_path, position) in to_insert {
        let image_id = db::media::insert_image(
            &conn,
            media_id,
            &relative_path,
            &relative_path,
            position,
        ).map_err(|e| e.to_string())?;
        // Return absolute path to frontend for immediate display
        results.push((image_id, absolute_path));
    }

    Ok(results)
}

/// Generate a cropped cover image from the first gallery image + crop parameters.
/// The crop uses the same coordinate system as CoverCropModal:
/// - pan_x, pan_y are pixel offsets in a 200×300 preview frame
/// - zoom is a multiplier (1 = cover-fit)
/// Output: 400×600 WebP cover saved as cover.webp in the media folder.
#[tauri::command]
pub async fn set_media_cover(
    state: State<'_, AppState>,
    media_id: i64,
    pan_x: f64,
    pan_y: f64,
    zoom: f64,
    source_image_index: Option<usize>,
) -> Result<String, String> {
    use image::imageops::FilterType;

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);
    let media_images_dir = media_dir.join(format!("media_{}", media_id));

    // Get the source image from DB (by index, default first)
    let images = db::media::get_images(&conn, media_id).map_err(|e| e.to_string())?;
    let idx = source_image_index.unwrap_or(0);
    let source_image = images.get(idx).or_else(|| images.first()).ok_or("No images found for this media")?;

    // Reconstruct absolute path for source image
    let source_path_abs = to_absolute_path(&storage_dir, &source_image.full_path);

    // Load source image from disk
    let src = image::open(&source_path_abs)
        .map_err(|e| format!("Failed to open source image: {}", e))?;

    let nat_w = src.width() as f64;
    let nat_h = src.height() as f64;

    // The CoverCropModal uses a 200×300 preview frame.
    // cover_scale = max(200/nat_w, 300/nat_h) so image fills the frame.
    // total_scale = cover_scale * zoom
    // The image is centered, then panned by (pan_x, pan_y) in preview pixels.
    let preview_w: f64 = 200.0;
    let preview_h: f64 = 300.0;
    let cover_scale = (preview_w / nat_w).max(preview_h / nat_h);
    let total_scale = cover_scale * zoom;

    // In the preview, the visible region maps to these source-pixel coordinates:
    // The image center in the preview is at (preview_w/2 + pan_x, preview_h/2 + pan_y).
    // The visible region in source pixels:
    let visible_w_src = preview_w / total_scale;
    let visible_h_src = preview_h / total_scale;
    let center_x_src = nat_w / 2.0 - pan_x / total_scale;
    let center_y_src = nat_h / 2.0 - pan_y / total_scale;

    let crop_x = (center_x_src - visible_w_src / 2.0).max(0.0).min(nat_w - visible_w_src);
    let crop_y = (center_y_src - visible_h_src / 2.0).max(0.0).min(nat_h - visible_h_src);

    let crop_w = visible_w_src.min(nat_w) as u32;
    let crop_h = visible_h_src.min(nat_h) as u32;
    let crop_x = crop_x as u32;
    let crop_y = crop_y as u32;

    // Crop and resize to final cover size (400×600 for good quality 2:3)
    let cropped = src.crop_imm(crop_x, crop_y, crop_w.max(1), crop_h.max(1));
    let cover = cropped.resize_exact(400, 600, FilterType::Lanczos3);

    // Save as cover.webp
    std::fs::create_dir_all(&media_images_dir).map_err(|e| e.to_string())?;
    let cover_path = media_images_dir.join("cover.webp");
    let cover_webp = encode_webp(&cover, 85.0)?;
    std::fs::write(&cover_path, &cover_webp).map_err(|e| e.to_string())?;

    // Convert to relative path (from storage_dir) with forward slashes
    let relative_cover_path = cover_path
        .strip_prefix(&*storage_dir)
        .ok()
        .and_then(|p| p.to_str())
        .map(|s| s.replace('\\', "/"))
        .unwrap_or_else(|| "".to_string());

    // Update DB
    db::media::set_cover_path(&conn, media_id, &relative_cover_path, source_image_index.map(|i| i as i64)).map_err(|e| e.to_string())?;

    // Return absolute path to frontend for immediate display
    let absolute_cover_path = to_absolute_path(&storage_dir, &relative_cover_path);
    Ok(absolute_cover_path)
}

/// Delete a single media image by its ID. Removes the file from disk and the DB record.
#[tauri::command]
pub async fn delete_media_image(
    state: State<'_, AppState>,
    image_id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    // Get image record to find the file path
    let image = db::media::get_image_by_id(&conn, image_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Image with id {} not found", image_id))?;

    // Reconstruct absolute paths from relative paths
    let full_path_abs = to_absolute_path(&storage_dir, &image.full_path);
    let thumb_path_abs = to_absolute_path(&storage_dir, &image.thumb_path);

    // Delete file from disk (ignore errors if file already missing)
    let path = std::path::Path::new(&full_path_abs);
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    // Also delete thumb if different from full
    if image.thumb_path != image.full_path {
        let thumb = std::path::Path::new(&thumb_path_abs);
        if thumb.exists() {
            let _ = std::fs::remove_file(thumb);
        }
    }

    // Delete DB record
    db::media::delete_image(&conn, image_id).map_err(|e| e.to_string())?;

    Ok(())
}

/// Read a file from disk and return its content as base64 (for drag-drop from OS)
#[tauri::command]
pub async fn read_file_base64(file_path: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;
    let engine = base64::engine::general_purpose::STANDARD;
    Ok(engine.encode(&bytes))
}

/// Clear the cover image when all images are deleted.
/// Removes the cover file from disk and clears the DB path.
#[tauri::command]
pub async fn clear_media_cover(
    state: State<'_, AppState>,
    media_id: i64,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);
    let media_images_dir = media_dir.join(format!("media_{}", media_id));

    // Delete cover file from disk
    let cover_path = media_images_dir.join("cover.webp");
    if cover_path.exists() {
        let _ = std::fs::remove_file(cover_path);
    }

    // Clear DB record
    db::media::clear_cover_path(&conn, media_id).map_err(|e| e.to_string())?;

    Ok(())
}

/// Update positions of multiple images at once.
/// Takes a list of (image_id, position) tuples.
#[tauri::command]
pub async fn update_image_positions(
    state: State<'_, AppState>,
    updates: Vec<(i64, i32)>,
) -> Result<(), String> {
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    db::media::update_image_positions(&mut conn, &updates).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get similar media from the same collection, sorted by common genres
#[tauri::command]
pub async fn get_similar_media(
    state: State<'_, AppState>,
    media_id: i64,
    collection_id: i64,
    limit: Option<i64>,
) -> Result<Vec<MediaListItem>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let media = db::media::get_similar_media(&conn, media_id, collection_id, limit.unwrap_or(4))
        .map_err(|e| e.to_string())?;

    // Convertir les chemins relatifs en absolus
    let media: Vec<Media> = media.into_iter().map(|mut m| {
        if let Some(ref cover) = m.cover_image {
            m.cover_image = Some(to_absolute_path(&storage_dir, cover));
        }
        m
    }).collect();

    enrich_with_genres(&conn, media)
}

#[derive(PartialEq, Eq)]
enum SortSegment {
    String(String),
    Number(u64),
}

impl PartialOrd for SortSegment {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for SortSegment {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match (self, other) {
            (SortSegment::Number(n1), SortSegment::Number(n2)) => n1.cmp(n2),
            (SortSegment::String(s1), SortSegment::String(s2)) => {
                s1.to_lowercase().cmp(&s2.to_lowercase())
            }
            (SortSegment::Number(_), SortSegment::String(_)) => std::cmp::Ordering::Less,
            (SortSegment::String(_), SortSegment::Number(_)) => std::cmp::Ordering::Greater,
        }
    }
}

fn natural_sort_key(s: &str) -> Vec<SortSegment> {
    let mut segments = Vec::new();
    let mut chars = s.chars().peekable();
    while let Some(&c) = chars.peek() {
        if c.is_ascii_digit() {
            let mut num_str = String::new();
            while let Some(&nc) = chars.peek() {
                if nc.is_ascii_digit() {
                    num_str.push(chars.next().unwrap());
                } else {
                    break;
                }
            }
            if let Ok(num) = num_str.parse::<u64>() {
                segments.push(SortSegment::Number(num));
            } else {
                segments.push(SortSegment::String(num_str));
            }
        } else {
            let mut str_val = String::new();
            while let Some(&nc) = chars.peek() {
                if !nc.is_ascii_digit() {
                    str_val.push(chars.next().unwrap());
                } else {
                    break;
                }
            }
            segments.push(SortSegment::String(str_val));
        }
    }
    segments
}

/// Reads the list of pages/images contained in a .cbz or .zip file
#[tauri::command]
pub async fn get_cbz_pages(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<Vec<String>, String> {
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let path_abs = to_absolute_path(&storage_dir, &relative_path);
    let path = std::path::Path::new(&path_abs);

    if !path.exists() {
        return Err(format!("File does not exist: {}", path_abs));
    }

    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Invalid CBZ/ZIP archive: {}", e))?;

    let mut pages = Vec::new();
    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name();
        
        // Exclude directories and system/hidden files
        if file.is_dir() 
            || name.starts_with("__MACOSX") 
            || name.contains(".DS_Store") 
            || name.contains("Thumbs.db") 
        {
            continue;
        }

        let path_in_zip = std::path::Path::new(name);
        if let Some(ext) = path_in_zip.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if ext_lower == "jpg" 
                || ext_lower == "jpeg" 
                || ext_lower == "png" 
                || ext_lower == "webp" 
                || ext_lower == "gif" 
                || ext_lower == "bmp" 
            {
                pages.push(name.to_string());
            }
        }
    }

    // Natural sort to guarantee page order
    pages.sort_by(|a, b| natural_sort_key(a).cmp(&natural_sort_key(b)));

    Ok(pages)
}

/// Extracts a specific page from a .cbz/.zip file and returns it as a Base64 Data URL
#[tauri::command]
pub async fn read_cbz_page(
    state: State<'_, AppState>,
    relative_path: String,
    page_name: String,
) -> Result<String, String> {
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
    let path_abs = to_absolute_path(&storage_dir, &relative_path);
    let path = std::path::Path::new(&path_abs);

    if !path.exists() {
        return Err(format!("File does not exist: {}", path_abs));
    }

    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Invalid CBZ/ZIP archive: {}", e))?;

    let mut target_file = archive.by_name(&page_name)
        .map_err(|e| format!("Page '{}' not found in archive: {}", page_name, e))?;

    let mut bytes = Vec::new();
    std::io::copy(&mut target_file, &mut bytes)
        .map_err(|e| format!("Failed to read page: {}", e))?;

    // Determine MIME type
    let ext = std::path::Path::new(&page_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let mime = match ext.as_str() {
        "webp" => "image/webp",
        "png" => "image/png",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "image/jpeg", // default to jpeg
    };

    use base64::Engine;
    let engine = base64::engine::general_purpose::STANDARD;
    let base64_data = engine.encode(&bytes);

    Ok(format!("data:{};base64,{}", mime, base64_data))
}

/// Copy an attachment file to a destination path (for download)
#[tauri::command]
pub fn download_attachment(source_path: String, dest_path: String) -> Result<(), String> {
    std::fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}
