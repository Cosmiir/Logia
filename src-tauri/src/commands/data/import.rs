use tauri::State;
use crate::AppState;
use crate::db;
use super::*;
use log::warn;

// ── Helpers ──

fn parse_date(date_str: &str) -> Option<String> {
    let date_str = date_str.trim();
    if date_str.is_empty() {
        return None;
    }

    if let Ok(parsed) = chrono::NaiveDate::parse_from_str(date_str, "%d/%m/%Y") {
        return Some(parsed.format("%Y-%m-%d").to_string());
    }
    if let Ok(parsed) = chrono::NaiveDate::parse_from_str(date_str, "%d/%m/%y") {
        return Some(parsed.format("%Y-%m-%d").to_string());
    }
    if let Ok(parsed) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        return Some(parsed.format("%Y-%m-%d").to_string());
    }
    if let Ok(parsed) = chrono::NaiveDate::parse_from_str(date_str, "%m/%d/%Y") {
        return Some(parsed.format("%Y-%m-%d").to_string());
    }
    if let Ok(parsed) = chrono::NaiveDate::parse_from_str(date_str, "%m/%d/%y") {
        return Some(parsed.format("%Y-%m-%d").to_string());
    }

    Some(date_str.to_string())
}

fn copy_person_photo(
    src_rel_path: &str,
    source_people_dir: &std::path::Path,
    dest_people_dir: &std::path::Path,
    new_person_id: i32,
    dest_storage_dir: &std::path::Path,
) -> Option<String> {
    let normalized = src_rel_path.replace('\\', "/");
    let filename = normalized.split('/').last().unwrap_or("");
    if filename.is_empty() { return None; }

    let src_file = source_people_dir.join(filename);
    if !src_file.exists() { return None; }

    let ext = std::path::Path::new(filename).extension().and_then(|e| e.to_str()).unwrap_or("webp");
    let new_filename = format!("person_{}.{}", new_person_id, ext);
    let dest_file = dest_people_dir.join(&new_filename);

    if std::fs::copy(&src_file, &dest_file).is_ok() {
        let relative_path = dest_file
            .strip_prefix(dest_storage_dir)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.replace('\\', "/"));
        relative_path
    } else {
        None
    }
}

fn copy_media_cover(
    src_rel_path: &str,
    source_media_dir: &std::path::Path,
    dest_media_dir: &std::path::Path,
    new_media_id: i32,
    dest_storage_dir: &std::path::Path,
) -> Option<String> {
    let normalized = src_rel_path.replace('\\', "/");
    let parts: Vec<&str> = normalized.split('/').collect();
    if parts.len() < 2 { return None; }
    let dir_part = parts[parts.len() - 2];
    let file_part = parts[parts.len() - 1];

    let src_file = source_media_dir.join(dir_part).join(file_part);
    if !src_file.exists() { return None; }

    let dest_media_images_dir = dest_media_dir.join(format!("media_{}", new_media_id));
    let _ = std::fs::create_dir_all(&dest_media_images_dir);

    let dest_file = dest_media_images_dir.join(file_part);
    if std::fs::copy(&src_file, &dest_file).is_ok() {
        let relative_path = dest_file
            .strip_prefix(dest_storage_dir)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.replace('\\', "/"));
        relative_path
    } else {
        None
    }
}

fn copy_media_image(
    src_full_rel_path: &str,
    src_thumb_rel_path: &str,
    source_media_dir: &std::path::Path,
    dest_media_dir: &std::path::Path,
    new_media_id: i32,
    dest_storage_dir: &std::path::Path,
) -> Option<(String, String)> {
    let norm_full = src_full_rel_path.replace('\\', "/");
    let norm_thumb = src_thumb_rel_path.replace('\\', "/");

    let full_parts: Vec<&str> = norm_full.split('/').collect();
    let thumb_parts: Vec<&str> = norm_thumb.split('/').collect();

    if full_parts.len() < 2 || thumb_parts.len() < 2 { return None; }
    let full_dir = full_parts[full_parts.len() - 2];
    let full_file = full_parts[full_parts.len() - 1];
    let thumb_dir = thumb_parts[thumb_parts.len() - 2];
    let thumb_file = thumb_parts[thumb_parts.len() - 1];

    let src_full = source_media_dir.join(full_dir).join(full_file);
    let src_thumb = source_media_dir.join(thumb_dir).join(thumb_file);

    if !src_full.exists() { return None; }

    let dest_media_images_dir = dest_media_dir.join(format!("media_{}", new_media_id));
    let _ = std::fs::create_dir_all(&dest_media_images_dir);

    let dest_full = dest_media_images_dir.join(full_file);
    let dest_thumb = dest_media_images_dir.join(thumb_file);

    let full_copied = std::fs::copy(&src_full, &dest_full).is_ok();
    let thumb_copied = if src_thumb.exists() {
        std::fs::copy(&src_thumb, &dest_thumb).is_ok()
    } else {
        false
    };

    if full_copied {
        let full_rel = dest_full
            .strip_prefix(dest_storage_dir)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.replace('\\', "/"))
            .unwrap_or_else(|| "".to_string());

        let thumb_rel = if thumb_copied {
            dest_thumb
                .strip_prefix(dest_storage_dir)
                .ok()
                .and_then(|p| p.to_str())
                .map(|s| s.replace('\\', "/"))
                .unwrap_or_else(|| full_rel.clone())
        } else {
            full_rel.clone()
        };

        Some((full_rel, thumb_rel))
    } else {
        None
    }
}

fn migrate_imported_profile_paths(conn: &rusqlite::Connection, new_profile_id: &str) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT photo_path FROM people WHERE photo_path LIKE 'profiles/%' AND photo_path IS NOT NULL LIMIT 1")?;
    let mut rows = stmt.query([])?;
    let mut old_profile_id: Option<String> = None;
    if let Some(row) = rows.next()? {
        let path: String = row.get(0)?;
        old_profile_id = extract_profile_id(&path);
    }

    if old_profile_id.is_none() {
        let mut stmt = conn.prepare("SELECT cover_path FROM media WHERE cover_path LIKE 'profiles/%' AND cover_path IS NOT NULL LIMIT 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            let path: String = row.get(0)?;
            old_profile_id = extract_profile_id(&path);
        }
    }

    if old_profile_id.is_none() {
        let mut stmt = conn.prepare("SELECT full_path FROM media_images WHERE full_path LIKE 'profiles/%' LIMIT 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            let path: String = row.get(0)?;
            old_profile_id = extract_profile_id(&path);
        }
    }

    if let Some(old_id) = old_profile_id {
        if old_id != new_profile_id {
            let old_pattern_fs = format!("profiles/{}/", old_id);
            let new_pattern_fs = format!("profiles/{}/", new_profile_id);
            let old_pattern_bs = format!("profiles\\{}\\", old_id);
            let new_pattern_bs = format!("profiles\\{}\\", new_profile_id);

            for (old_pat, new_pat) in [(&old_pattern_fs, &new_pattern_fs), (&old_pattern_bs, &new_pattern_bs)] {
                conn.execute(
                    "UPDATE media_images
                     SET full_path = REPLACE(full_path, ?1, ?2),
                         thumb_path = REPLACE(thumb_path, ?1, ?2)
                     WHERE full_path LIKE '%' || ?1 || '%'
                        OR thumb_path LIKE '%' || ?1 || '%'",
                    rusqlite::params![old_pat, new_pat],
                )?;

                conn.execute(
                    "UPDATE media
                     SET cover_path = REPLACE(cover_path, ?1, ?2)
                     WHERE cover_path IS NOT NULL
                       AND cover_path LIKE '%' || ?1 || '%'",
                    rusqlite::params![old_pat, new_pat],
                )?;

                conn.execute(
                    "UPDATE people
                     SET photo_path = REPLACE(photo_path, ?1, ?2)
                     WHERE photo_path IS NOT NULL
                       AND photo_path LIKE '%' || ?1 || '%'",
                    rusqlite::params![old_pat, new_pat],
                )?;
            }
        }
    }

    conn.execute(
        "UPDATE notifications SET profile_id = ?1",
        rusqlite::params![new_profile_id],
    )?;

    Ok(())
}

fn extract_profile_id(path: &str) -> Option<String> {
    let normalized = path.replace('\\', "/");
    let parts: Vec<&str> = normalized.split('/').collect();
    if parts.len() >= 2 && parts[0] == "profiles" {
        Some(parts[1].to_string())
    } else {
        None
    }
}

// ── Commands ──

/// Preview a CSV file for import
#[tauri::command]
pub async fn preview_csv_import(
    file_path: String,
    delimiter: Option<String>,
) -> Result<CsvImportPreview, String> {
    let file = std::fs::File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let delimiter_byte = match delimiter {
        Some(d) if !d.is_empty() => d.as_bytes()[0],
        _ => b',',
    };

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delimiter_byte)
        .from_reader(file);
    let headers = rdr.headers()
        .map_err(|e| format!("Erreur lecture en-têtes CSV : {}", e))?;

    let columns: Vec<String> = headers.iter()
        .map(|s| s.to_string())
        .collect();

    let mut all_rows = Vec::new();

    for result in rdr.records() {
        match result {
            Ok(record) => {
                let row: Vec<String> = record.iter()
                    .map(|s| s.to_string())
                    .collect();
                all_rows.push(row);
            }
            Err(e) => {
                return Err(format!("Erreur lecture ligne CSV : {}", e));
            }
        }
    }

    let row_count = all_rows.len();

    Ok(CsvImportPreview {
        columns,
        row_count,
        all_rows,
    })
}

/// Import media from a CSV file
#[tauri::command]
pub async fn import_from_csv(
    state: State<'_, AppState>,
    request: CsvImportRequest,
) -> Result<CsvImportResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let file = std::fs::File::open(&request.file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let delimiter_byte = match &request.delimiter {
        Some(d) if !d.is_empty() => d.as_bytes()[0],
        _ => b',',
    };

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delimiter_byte)
        .from_reader(file);
    let headers = rdr.headers()
        .map_err(|e| format!("Erreur lecture en-têtes CSV : {}", e))?
        .clone();

    let mut imported_media = 0i32;
    let mut created_collections = 0i32;
    let mut created_genres = 0i32;
    let mut errors = Vec::new();

    let get_column_value = |record: &csv::StringRecord, column_name: &str| -> Option<String> {
        if let Some(csv_col) = request.column_mapping.get(column_name) {
            if let Some(idx) = headers.iter().position(|h| h == csv_col) {
                return record.get(idx).map(|s| s.to_string());
            }
        }
        None
    };

    for (row_num, result) in rdr.records().enumerate() {
        let row_num = row_num + 2;

        let record = match result {
            Ok(r) => r,
            Err(e) => {
                errors.push(format!("Ligne {} : erreur lecture : {}", row_num, e));
                continue;
            }
        };

        let title = match get_column_value(&record, "title") {
            Some(t) if !t.trim().is_empty() => t.trim().to_string(),
            _ => {
                errors.push(format!("Ligne {} : titre manquant", row_num));
                continue;
            }
        };

        let collection_name = get_column_value(&record, "collection");
        let collection_id = if let Some(col_name) = collection_name {
            if !col_name.trim().is_empty() {
                let col_id: Option<i64> = conn.query_row(
                    "SELECT id FROM collections WHERE name = ?1",
                    [&col_name.trim()],
                    |r| r.get(0)
                ).ok();

                if let Some(id) = col_id {
                    Some(id as i32)
                } else if request.auto_create_collections {
                    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
                    conn.execute(
                        "INSERT INTO collections (name, color, creator_label, date_label, progression_unit, progression_label, plural_with_s, position, created_at) VALUES (?1, '#6366f1', 'Créé par', 'Sorti le', 'unité', 'Progression', 0, 0, ?2)",
                        [col_name.as_str(), now.as_str()]
                    ).map_err(|e| format!("Ligne {} : erreur création collection : {}", row_num, e))?;

                    let id: i64 = conn.last_insert_rowid();
                    created_collections += 1;
                    Some(id as i32)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        let user_rating = get_column_value(&record, "user_rating")
            .and_then(|s| s.replace(',', ".").parse::<f64>().ok())
            .map(|r| {
                let converted = r / request.rating_scale as f64 * 100.0;
                if request.round_ratings {
                    converted.round()
                } else {
                    converted
                }
            });

        let creator = get_column_value(&record, "creator")
            .filter(|s| !s.trim().is_empty());

        let release_date = get_column_value(&record, "release_date")
            .and_then(|s| parse_date(&s));

        let raw_status = get_column_value(&record, "media_status");
        let media_status = raw_status
            .as_ref()
            .map(|s| {
                let trimmed = s.trim();

                let mapped = if !request.status_mapping.is_empty() {
                    request.status_mapping.get(trimmed).map(|v| v.as_str())
                } else {
                    None
                };

                let mapped = mapped.or_else(|| {
                    let normalized = trimmed.to_uppercase();
                    match normalized.as_str() {
                        "FINI" | "TERMINÉ" | "COMPLETED" => Some("COMPLETED"),
                        "EN COURS" | "ENCOURS" | "ONGOING" => Some("ONGOING"),
                        "À VOIR" | "A VOIR" | "A COMMENCER" | "ACOMMENCER" | "UPCOMING" => Some("UPCOMING"),
                        "ABANDONNÉ" | "ABANDONNE" | "ABANDONED" => Some("ABANDONED"),
                        _ => None
                    }
                });

                mapped
            })
            .flatten();

        let experience_date = get_column_value(&record, "experience_date")
            .and_then(|s| parse_date(&s));

        // Parse experience_entries (new format) or fallback to experience_dates (old format)
        let experience_entries_raw = get_column_value(&record, "experience_entries")
            .filter(|s| !s.trim().is_empty());
        let experience_dates_legacy = get_column_value(&record, "experience_dates")
            .filter(|s| !s.trim().is_empty());

        let synopsis = get_column_value(&record, "synopsis")
            .filter(|s| !s.trim().is_empty());

        let progress_current = get_column_value(&record, "progress_current")
            .and_then(|s| s.replace(',', ".").parse::<f64>().ok())
            .map(|r| r as i32);
        let progress_total = get_column_value(&record, "progress_total")
            .and_then(|s| s.replace(',', ".").parse::<f64>().ok())
            .map(|r| r as i32);

        let is_abandoned = get_column_value(&record, "is_abandoned")
            .map(|s| s.trim().to_lowercase() == "true" || s.trim() == "1")
            .unwrap_or(false);

        let raw_progress_status = get_column_value(&record, "progress_status");

        let progress_status = if let Some(status) = raw_progress_status {
            let normalized = status.trim().to_uppercase();
            match normalized.as_str() {
                "NOT_STARTED" | "NOT STARTED" | "À VOIR" | "A VOIR" => Some("NOT_STARTED".to_string()),
                "IN_PROGRESS" | "IN PROGRESS" | "EN COURS" | "ENCOURS" => Some("IN_PROGRESS".to_string()),
                "COMPLETED" | "FINI" | "TERMINÉ" | "TERMINES" => Some("COMPLETED".to_string()),
                "ABANDONED" | "ABANDONNÉ" | "ABANDONNE" => Some("ABANDONED".to_string()),
                _ => None,
            }
        } else if is_abandoned {
            Some("ABANDONED".to_string())
        } else if let (Some(cur), Some(total)) = (progress_current, progress_total) {
            if total > 0 && cur >= total {
                Some("COMPLETED".to_string())
            } else if cur > 0 {
                Some("IN_PROGRESS".to_string())
            } else {
                Some("NOT_STARTED".to_string())
            }
        } else {
            Some("NOT_STARTED".to_string())
        };

        let replay_count = get_column_value(&record, "replay_count")
            .and_then(|s| s.replace(',', ".").parse::<i32>().ok())
            .unwrap_or(0);

        let positive_points = get_column_value(&record, "positive_points")
            .filter(|s| !s.trim().is_empty());

        let negative_points = get_column_value(&record, "negative_points")
            .filter(|s| !s.trim().is_empty());

        let user_review = get_column_value(&record, "user_review")
            .filter(|s| !s.trim().is_empty());

        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "INSERT INTO media (collection_id, title, creator, release_date, synopsis, user_rating, user_review, progress_current, progress_total, progress_status, replay_count, experience_date, positive_points, negative_points, media_status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            [
                collection_id.map(|i| i.to_string()),
                Some(title),
                creator,
                release_date,
                synopsis,
                user_rating.map(|r| r.to_string()),
                user_review,
                progress_current.map(|r| r.to_string()),
                progress_total.map(|r| r.to_string()),
                progress_status,
                Some(replay_count.to_string()),
                experience_date,
                positive_points,
                negative_points,
                media_status.map(|s| s.to_string()),
                Some(now.clone()),
                Some(now.clone()),
            ]
        ).map_err(|e| {
            errors.push(format!("Ligne {} : erreur création média : {}", row_num, e));
            e
        }).ok();

        let media_id: i64 = conn.last_insert_rowid();

        // Insert experience entries
        if let Some(entries_str) = &experience_entries_raw {
            // New format: JSON objects separated by ||
            for entry_json in entries_str.split("||") {
                let entry_json = entry_json.trim();
                if entry_json.is_empty() { continue; }
                if let Ok(obj) = serde_json::from_str::<serde_json::Value>(entry_json) {
                    let date = obj.get("date").and_then(|v| v.as_str()).filter(|s| !s.is_empty());
                    let version = obj.get("version").and_then(|v| v.as_str()).filter(|s| !s.is_empty());
                    let language = obj.get("language").and_then(|v| v.as_str()).filter(|s| !s.is_empty());
                    let position = obj.get("position").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    conn.execute(
                        "INSERT INTO experience_entries (media_id, date, version, language, position) VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![media_id, date, version, language, position],
                    ).ok();
                }
            }
        } else if let Some(dates_str) = &experience_dates_legacy {
            // Old format: JSON array of date strings
            if let Ok(dates) = serde_json::from_str::<Vec<String>>(dates_str) {
                for (i, date) in dates.iter().enumerate() {
                    if !date.is_empty() {
                        conn.execute(
                            "INSERT INTO experience_entries (media_id, date, version, language, position) VALUES (?1, ?2, NULL, NULL, ?3)",
                            rusqlite::params![media_id, date, i as i32],
                        ).ok();
                    }
                }
            }
        }

        if let Some(genres_str) = get_column_value(&record, "genre_ids") {
            if !genres_str.trim().is_empty() {
                let genre_names: Vec<&str> = genres_str
                    .split(&request.genre_separator)
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                    .collect();

                for genre_name in genre_names {
                    let genre_id: Option<i64> = conn.query_row(
                        "SELECT id FROM genres WHERE name = ?1",
                        [genre_name],
                        |r| r.get(0)
                    ).ok();

                    let genre_id = if let Some(id) = genre_id {
                        id
                    } else if request.auto_create_genres {
                        let now_clone = now.clone();
                        conn.execute(
                            "INSERT INTO genres (name, created_at) VALUES (?1, ?2)",
                            [genre_name, now_clone.as_str()]
                        ).map_err(|e| {
                            errors.push(format!("Row {}: error creating genre '{}' : {}", row_num, genre_name, e));
                            e
                        }).ok();
                        conn.last_insert_rowid()
                    } else {
                        errors.push(format!("Row {}: genre '{}' not found (enable 'Auto-create genres' to create this genre)", row_num, genre_name));
                        continue;
                    };

                    conn.execute(
                        "INSERT INTO media_genres (media_id, genre_id) VALUES (?1, ?2)",
                        [media_id.to_string(), genre_id.to_string()]
                    ).map_err(|e| {
                        errors.push(format!("Row {}: error linking genre '{}' : {}", row_num, genre_name, e));
                        e
                    }).ok();

                    if genre_id == conn.last_insert_rowid() {
                        created_genres += 1;
                    }
                }
            }
        }

        imported_media += 1;
    }

    conn.execute("INSERT INTO media_fts(media_fts) VALUES('rebuild')", [])
        .map_err(|e| format!("Erreur reconstruction index FTS5 : {}", e))?;

    Ok(CsvImportResult {
        imported_media,
        created_collections,
        created_genres,
        errors,
    })
}

/// Import reviews from markdown files
#[tauri::command]
pub async fn import_reviews_from_md(
    state: State<'_, AppState>,
    request: MdImportRequest,
) -> Result<MdImportResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let folder_path = std::path::Path::new(&request.folder_path);
    if !folder_path.exists() {
        return Err("Le dossier n'existe pas".to_string());
    }

    let mut updated_media = 0i32;
    let mut not_found = Vec::new();

    if let Ok(entries) = std::fs::read_dir(folder_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }

            let file_stem = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            let title = file_stem.rsplit_once(' ')
                .map(|(t, _)| t.trim())
                .unwrap_or(file_stem);

            if title.is_empty() {
                continue;
            }

            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Error reading file {}: {}", path.display(), e))?;

            let review = if let Some(aside_end) = content.find("</aside>") {
                content[aside_end + "</aside>".len()..].trim().to_string()
            } else {
                content.lines().skip(1).collect::<Vec<_>>().join("\n").trim().to_string()
            };

            if review.is_empty() {
                continue;
            }

            let media_id: Option<i64> = conn.query_row(
                "SELECT id FROM media WHERE title = ?1 LIMIT 1",
                [&title],
                |r| r.get(0)
            ).ok();

            if let Some(id) = media_id {
                let id_string = id.to_string();
                conn.execute(
                    "UPDATE media SET user_review = ?1 WHERE id = ?2",
                    [&review, &id_string]
                ).map_err(|e| format!("Erreur mise à jour média {}: {}", id, e))?;
                updated_media += 1;
            } else {
                not_found.push(title.to_string());
            }
        }
    }

    Ok(MdImportResult {
        updated_media,
        not_found,
    })
}

/// Import a database from a ZIP file
#[tauri::command]
pub async fn import_database(
    state: State<'_, AppState>,
    source_path: String,
    merge: Option<bool>,
    skip_duplicates: Option<bool>,
) -> Result<ImportResult, String> {
    let merge = merge.unwrap_or(false);
    let skip_duplicates = skip_duplicates.unwrap_or(true);

    let (profile_path, db_path, profile_id, storage_dir) = {
        let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
        let manifest = db::profiles::load_manifest(&storage_dir);
        let profile_id = manifest.active_profile_id.clone();
        (
            db::profiles::profile_dir(&storage_dir, &profile_id),
            db::profiles::profile_db_path(&storage_dir, &profile_id),
            profile_id,
            storage_dir.clone(),
        )
    };

    let file = std::fs::File::open(&source_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Invalid ZIP file: {}", e))?;

    let has_db = (0..archive.len()).any(|i| {
        archive.by_index(i).map(|f| f.name() == "logia.db").unwrap_or(false)
    });
    if !has_db {
        return Err("ZIP file does not contain a valid Logia database.".to_string());
    }

    if !merge {
        let mut conn = state.db.lock().map_err(|e| e.to_string())?;

        {
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
            let _ = conn.execute_batch("PRAGMA journal_mode=DELETE;");
            let temp_conn = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;

            let old_conn = std::mem::replace(&mut *conn, temp_conn);
            std::mem::drop(old_conn);
        }

        let mut imported_images = 0i32;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = file.name().to_string();

            if name == "logia.db" {
                let mut out = std::fs::File::create(&db_path)
                    .map_err(|e| format!("Failed to write database: {}", e))?;
                std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
            } else if (name.starts_with("storage/media/") || name.starts_with("storage/people/")) && !name.ends_with('/') {
                let target = profile_path.join(&name);
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut out = std::fs::File::create(&target).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
                imported_images += 1;
            }
        }

        let new_conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("Failed to reopen database: {}", e))?;
        db::initialize_database(&new_conn).map_err(|e| e.to_string())?;

        if let Err(err) = migrate_imported_profile_paths(&new_conn, &profile_id) {
            warn!("Failed to migrate imported profile paths: {}", err);
        }

        let imported_collections: i32 = new_conn.query_row(
            "SELECT COUNT(*) FROM collections", [], |r| r.get(0)
        ).unwrap_or(0);
        let imported_media: i32 = new_conn.query_row(
            "SELECT COUNT(*) FROM media", [], |r| r.get(0)
        ).unwrap_or(0);

        *conn = new_conn;

        Ok(ImportResult {
            imported_collections,
            imported_media,
            imported_images,
        })
    } else {
        let temp_dir = storage_dir.join("temp_import");
        let _ = std::fs::remove_dir_all(&temp_dir);
        std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = file.name().to_string();

            if name == "logia.db" {
                let target = temp_dir.join("logia.db");
                let mut out = std::fs::File::create(&target).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
            } else if (name.starts_with("storage/media/") || name.starts_with("storage/people/")) && !name.ends_with('/') {
                let target = temp_dir.join(&name);
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut out = std::fs::File::create(&target).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
            }
        }

        let temp_db_path = temp_dir.join("logia.db");
        let temp_media_dir = temp_dir.join("storage/media");
        let temp_people_dir = temp_dir.join("storage/people");

        let mut dest_conn = state.db.lock().map_err(|e| e.to_string())?;

        let result = merge_databases(
            &mut *dest_conn,
            &temp_db_path,
            &temp_media_dir,
            &temp_people_dir,
            &profile_id,
            &storage_dir,
            skip_duplicates,
        );

        let _ = std::fs::remove_dir_all(&temp_dir);

        result
    }
}

/// Merge data from a source profile directly into the active profile
#[tauri::command]
pub async fn merge_profile_data(
    state: State<'_, AppState>,
    source_profile_id: String,
    skip_duplicates: bool,
) -> Result<ImportResult, String> {
    let (dest_profile_id, storage_dir) = {
        let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;
        let manifest = db::profiles::load_manifest(&storage_dir);
        (manifest.active_profile_id.clone(), storage_dir.clone())
    };

    if source_profile_id == dest_profile_id {
        return Err("Cannot merge a profile with itself.".to_string());
    }

    let source_exists = {
        let manifest = db::profiles::load_manifest(&storage_dir);
        manifest.profiles.iter().any(|p| p.id == source_profile_id)
    };
    if !source_exists {
        return Err("Source profile does not exist.".to_string());
    }

    let source_db_path = db::profiles::profile_db_path(&storage_dir, &source_profile_id);
    let source_media_dir = db::profiles::profile_media_dir(&storage_dir, &source_profile_id);
    let source_people_dir = db::profiles::profile_people_dir(&storage_dir, &source_profile_id);

    let mut dest_conn = state.db.lock().map_err(|e| e.to_string())?;

    merge_databases(
        &mut *dest_conn,
        &source_db_path,
        &source_media_dir,
        &source_people_dir,
        &dest_profile_id,
        &storage_dir,
        skip_duplicates,
    )
}

/// Core function to merge databases
pub fn merge_databases(
    dest_conn: &mut rusqlite::Connection,
    source_db_path: &std::path::Path,
    source_media_dir: &std::path::Path,
    source_people_dir: &std::path::Path,
    dest_profile_id: &str,
    dest_storage_dir: &std::path::Path,
    skip_duplicates: bool,
) -> Result<ImportResult, String> {
    let source_conn = rusqlite::Connection::open_with_flags(
        source_db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ).map_err(|e| format!("Failed to open source database: {}", e))?;

    let tx = dest_conn.transaction().map_err(|e| format!("Transaction error: {}", e))?;

    let mut imported_collections = 0;
    let mut imported_media = 0;
    let mut imported_images = 0;

    let mut col_id_map = std::collections::HashMap::<i32, i32>::new();
    let mut genre_id_map = std::collections::HashMap::<i32, i32>::new();
    let mut person_id_map = std::collections::HashMap::<i32, i32>::new();
    let mut media_id_map = std::collections::HashMap::<i32, i32>::new();

    let dest_media_dir = db::profiles::profile_media_dir(dest_storage_dir, dest_profile_id);
    let dest_people_dir = db::profiles::profile_people_dir(dest_storage_dir, dest_profile_id);

    // --- A. COLLECTIONS ---
    {
        let mut stmt = source_conn.prepare(
            "SELECT id, name, icon, color, creator_label, date_label, progression_unit,
                    progression_label, progression_short_label, replay_date_label,
                    duration_label, plural_with_s, consumption_verb, monthly_capacity, position
             FROM collections"
        ).map_err(|e| e.to_string())?;

        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let src_id: i32 = row.get(0).map_err(|e| e.to_string())?;
            let name: String = row.get(1).map_err(|e| e.to_string())?;
            let icon: Option<String> = row.get(2).map_err(|e| e.to_string())?;
            let color: Option<String> = row.get(3).map_err(|e| e.to_string())?;
            let creator_label: Option<String> = row.get(4).map_err(|e| e.to_string())?;
            let date_label: Option<String> = row.get(5).map_err(|e| e.to_string())?;
            let progression_unit: Option<String> = row.get(6).map_err(|e| e.to_string())?;
            let progression_label: Option<String> = row.get(7).map_err(|e| e.to_string())?;
            let progression_short_label: Option<String> = row.get(8).map_err(|e| e.to_string())?;
            let replay_date_label: Option<String> = row.get(9).map_err(|e| e.to_string())?;
            let duration_label: Option<String> = row.get(10).map_err(|e| e.to_string())?;
            let plural_with_s: Option<i32> = row.get(11).map_err(|e| e.to_string())?;
            let consumption_verb: Option<String> = row.get(12).map_err(|e| e.to_string())?;
            let monthly_capacity: Option<i32> = row.get(13).map_err(|e| e.to_string())?;
            let position: i32 = row.get(14).map_err(|e| e.to_string())?;

            let dest_id: Option<i32> = tx.query_row(
                "SELECT id FROM collections WHERE name = ?1",
                [&name],
                |r| r.get(0)
            ).ok();

            if let Some(id) = dest_id {
                col_id_map.insert(src_id, id);
            } else {
                tx.execute(
                    "INSERT INTO collections (name, icon, color, creator_label, date_label, progression_unit,
                                             progression_label, progression_short_label, replay_date_label,
                                             duration_label, plural_with_s, consumption_verb, monthly_capacity, position)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                    rusqlite::params![
                        name, icon, color, creator_label, date_label, progression_unit,
                        progression_label, progression_short_label, replay_date_label,
                        duration_label, plural_with_s, consumption_verb, monthly_capacity, position
                    ]
                ).map_err(|e| e.to_string())?;

                let new_id = tx.last_insert_rowid() as i32;
                col_id_map.insert(src_id, new_id);
                imported_collections += 1;
            }
        }
    }

    // --- B. GENRES ---
    {
        let mut stmt = source_conn.prepare("SELECT id, name, color FROM genres").map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let src_id: i32 = row.get(0).map_err(|e| e.to_string())?;
            let name: String = row.get(1).map_err(|e| e.to_string())?;
            let color: Option<String> = row.get(2).map_err(|e| e.to_string())?;

            let dest_id: Option<i32> = tx.query_row(
                "SELECT id FROM genres WHERE name = ?1",
                [&name],
                |r| r.get(0)
            ).ok();

            if let Some(id) = dest_id {
                genre_id_map.insert(src_id, id);
            } else {
                tx.execute(
                    "INSERT INTO genres (name, color) VALUES (?1, ?2)",
                    rusqlite::params![name, color]
                ).map_err(|e| e.to_string())?;

                let new_id = tx.last_insert_rowid() as i32;
                genre_id_map.insert(src_id, new_id);
            }
        }
    }

    // --- C. PEOPLE ---
    {
        let mut stmt = source_conn.prepare("SELECT id, name, photo_path FROM people").map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let src_id: i32 = row.get(0).map_err(|e| e.to_string())?;
            let name: String = row.get(1).map_err(|e| e.to_string())?;
            let photo_path: Option<String> = row.get(2).map_err(|e| e.to_string())?;

            let dest_id: Option<i32> = tx.query_row(
                "SELECT id FROM people WHERE name = ?1",
                [&name],
                |r| r.get(0)
            ).ok();

            if let Some(id) = dest_id {
                person_id_map.insert(src_id, id);
                if let Some(ref path) = photo_path {
                    let dest_has_photo: Option<String> = tx.query_row(
                        "SELECT photo_path FROM people WHERE id = ?1",
                        [id],
                        |r| r.get(0)
                    ).unwrap_or(None);

                    if dest_has_photo.is_none() {
                        if let Some(new_rel_path) = copy_person_photo(
                            path,
                            source_people_dir,
                            &dest_people_dir,
                            id,
                            dest_storage_dir,
                        ) {
                            tx.execute(
                                "UPDATE people SET photo_path = ?1 WHERE id = ?2",
                                rusqlite::params![new_rel_path, id]
                            ).ok();
                            imported_images += 1;
                        }
                    }
                }
            } else {
                tx.execute(
                    "INSERT INTO people (name) VALUES (?1)",
                    [&name]
                ).map_err(|e| e.to_string())?;

                let new_id = tx.last_insert_rowid() as i32;
                person_id_map.insert(src_id, new_id);

                if let Some(ref path) = photo_path {
                    if let Some(new_rel_path) = copy_person_photo(
                        path,
                        source_people_dir,
                        &dest_people_dir,
                        new_id,
                        dest_storage_dir,
                    ) {
                        tx.execute(
                            "UPDATE people SET photo_path = ?1 WHERE id = ?2",
                            rusqlite::params![new_rel_path, new_id]
                        ).map_err(|e| e.to_string())?;
                        imported_images += 1;
                    }
                }
            }
        }
    }

    // --- D. MEDIA (and its dependents) ---
    {
        let mut stmt = source_conn.prepare(
            "SELECT id, collection_id, title, creator, release_date, synopsis, user_rating, user_review,
                    progress_current, progress_total, progress_status, replay_count, experience_date,
                    created_at, updated_at, cover_path, cover_source_index, positive_points,
                    negative_points, media_status
             FROM media"
        ).map_err(|e| e.to_string())?;

        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let src_id: i32 = row.get(0).map_err(|e| e.to_string())?;
            let src_col_id: i32 = row.get(1).map_err(|e| e.to_string())?;
            let title: String = row.get(2).map_err(|e| e.to_string())?;
            let creator: Option<String> = row.get(3).map_err(|e| e.to_string())?;
            let release_date: Option<String> = row.get(4).map_err(|e| e.to_string())?;
            let synopsis: Option<String> = row.get(5).map_err(|e| e.to_string())?;
            let user_rating: Option<f64> = row.get(6).map_err(|e| e.to_string())?;
            let user_review: Option<String> = row.get(7).map_err(|e| e.to_string())?;
            let progress_current: Option<f64> = row.get(8).map_err(|e| e.to_string())?;
            let progress_total: Option<f64> = row.get(9).map_err(|e| e.to_string())?;
            let progress_status: Option<String> = row.get(10).map_err(|e| e.to_string())?;
            let replay_count: i32 = row.get(11).map_err(|e| e.to_string())?;
            let experience_date: Option<String> = row.get(12).map_err(|e| e.to_string())?;
            let created_at: String = row.get(13).map_err(|e| e.to_string())?;
            let updated_at: String = row.get(14).map_err(|e| e.to_string())?;
            let cover_path: Option<String> = row.get(15).map_err(|e| e.to_string())?;
            let cover_source_index: i32 = row.get(16).map_err(|e| e.to_string())?;
            let positive_points: Option<String> = row.get(17).map_err(|e| e.to_string())?;
            let negative_points: Option<String> = row.get(18).map_err(|e| e.to_string())?;
            let media_status: Option<String> = row.get(19).map_err(|e| e.to_string())?;

            let dest_col_id = match col_id_map.get(&src_col_id) {
                Some(id) => *id,
                None => continue,
            };

            let mut is_duplicate = false;
            let mut dest_media_id = 0;
            if skip_duplicates {
                let clean_creator = creator.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());
                let duplicate_id: Option<i32> = match clean_creator {
                    Some(c) => tx.query_row(
                        "SELECT id FROM media WHERE collection_id = ?1 AND title = ?2 AND creator = ?3",
                        rusqlite::params![dest_col_id, title, c],
                        |r| r.get(0)
                    ).ok(),
                    None => tx.query_row(
                        "SELECT id FROM media WHERE collection_id = ?1 AND title = ?2 AND (creator IS NULL OR creator = '')",
                        rusqlite::params![dest_col_id, title],
                        |r| r.get(0)
                    ).ok(),
                };

                if let Some(id) = duplicate_id {
                    is_duplicate = true;
                    dest_media_id = id;
                }
            }

            if is_duplicate {
                media_id_map.insert(src_id, dest_media_id);
                continue;
            }

            tx.execute(
                "INSERT INTO media (collection_id, title, creator, release_date, synopsis, user_rating, user_review,
                                    progress_current, progress_total, progress_status, replay_count, experience_date,
                                    created_at, updated_at, cover_source_index, positive_points,
                                    negative_points, media_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                         strftime('%Y-%m-%d %H:%M:%S', ?13),
                         strftime('%Y-%m-%d %H:%M:%S', ?14),
                         ?15, ?16, ?17, ?18)",
                rusqlite::params![
                    dest_col_id, title, creator, release_date, synopsis, user_rating, user_review,
                    progress_current, progress_total, progress_status, replay_count, experience_date,
                    created_at, updated_at, cover_source_index, positive_points,
                    negative_points, media_status
                ]
            ).map_err(|e| e.to_string())?;

            let new_media_id = tx.last_insert_rowid() as i32;
            media_id_map.insert(src_id, new_media_id);
            imported_media += 1;

            if let Some(ref path) = cover_path {
                if let Some(new_rel_path) = copy_media_cover(
                    path,
                    source_media_dir,
                    &dest_media_dir,
                    new_media_id,
                    dest_storage_dir,
                ) {
                    tx.execute(
                        "UPDATE media SET cover_path = ?1 WHERE id = ?2",
                        rusqlite::params![new_rel_path, new_media_id]
                    ).map_err(|e| e.to_string())?;
                    imported_images += 1;
                }
            }

            // Media Genres
            {
                // Experience entries
                {
                    let mut stmt_e = source_conn.prepare("SELECT date, version, language, position FROM experience_entries WHERE media_id = ?1 ORDER BY position ASC").map_err(|e| e.to_string())?;
                    let mut rows_e = stmt_e.query([src_id]).map_err(|e| e.to_string())?;
                    while let Some(row_e) = rows_e.next().map_err(|e| e.to_string())? {
                        let date: Option<String> = row_e.get(0).map_err(|e| e.to_string())?;
                        let version: Option<String> = row_e.get(1).map_err(|e| e.to_string())?;
                        let language: Option<String> = row_e.get(2).map_err(|e| e.to_string())?;
                        let position: i32 = row_e.get(3).map_err(|e| e.to_string())?;
                        tx.execute(
                            "INSERT INTO experience_entries (media_id, date, version, language, position) VALUES (?1, ?2, ?3, ?4, ?5)",
                            rusqlite::params![new_media_id, date, version, language, position]
                        ).map_err(|e| e.to_string())?;
                    }
                }

                let mut stmt_g = source_conn.prepare("SELECT genre_id, position FROM media_genres WHERE media_id = ?1").map_err(|e| e.to_string())?;
                let mut rows_g = stmt_g.query([src_id]).map_err(|e| e.to_string())?;
                while let Some(row_g) = rows_g.next().map_err(|e| e.to_string())? {
                    let src_genre_id: i32 = row_g.get(0).map_err(|e| e.to_string())?;
                    let position: i32 = row_g.get(1).map_err(|e| e.to_string())?;

                    if let Some(dest_genre_id) = genre_id_map.get(&src_genre_id) {
                        tx.execute(
                            "INSERT OR IGNORE INTO media_genres (media_id, genre_id, position) VALUES (?1, ?2, ?3)",
                            rusqlite::params![new_media_id, dest_genre_id, position]
                        ).map_err(|e| e.to_string())?;
                    }
                }
            }

            // Media Credits
            {
                let mut stmt_c = source_conn.prepare("SELECT person_id, role, position FROM media_credits WHERE media_id = ?1").map_err(|e| e.to_string())?;
                let mut rows_c = stmt_c.query([src_id]).map_err(|e| e.to_string())?;
                while let Some(row_c) = rows_c.next().map_err(|e| e.to_string())? {
                    let src_person_id: i32 = row_c.get(0).map_err(|e| e.to_string())?;
                    let role: Option<String> = row_c.get(1).map_err(|e| e.to_string())?;
                    let position: i32 = row_c.get(2).map_err(|e| e.to_string())?;

                    if let Some(dest_person_id) = person_id_map.get(&src_person_id) {
                        tx.execute(
                            "INSERT OR IGNORE INTO media_credits (media_id, person_id, role, position) VALUES (?1, ?2, ?3, ?4)",
                            rusqlite::params![new_media_id, dest_person_id, role, position]
                        ).map_err(|e| e.to_string())?;
                    }
                }
            }

            // Media Images
            {
                let mut stmt_i = source_conn.prepare("SELECT id, full_path, thumb_path, position FROM media_images WHERE media_id = ?1").map_err(|e| e.to_string())?;
                let mut rows_i = stmt_i.query([src_id]).map_err(|e| e.to_string())?;
                while let Some(row_i) = rows_i.next().map_err(|e| e.to_string())? {
                    let _src_img_id: i32 = row_i.get(0).map_err(|e| e.to_string())?;
                    let full_path: String = row_i.get(1).map_err(|e| e.to_string())?;
                    let thumb_path: String = row_i.get(2).map_err(|e| e.to_string())?;
                    let position: i32 = row_i.get(3).map_err(|e| e.to_string())?;

                    let copied_paths = copy_media_image(
                        &full_path,
                        &thumb_path,
                        source_media_dir,
                        &dest_media_dir,
                        new_media_id,
                        dest_storage_dir,
                    );

                    if let Some((new_full, new_thumb)) = copied_paths {
                        tx.execute(
                            "INSERT OR IGNORE INTO media_images (media_id, full_path, thumb_path, position) VALUES (?1, ?2, ?3, ?4)",
                            rusqlite::params![new_media_id, new_full, new_thumb, position]
                        ).map_err(|e| e.to_string())?;
                        imported_images += 1;
                    }
                }
            }
        }
    }

    // --- E. OBJECTIVES ---
    {
        let mut stmt = source_conn.prepare(
            "SELECT collection_id, target_count, start_date, end_date, is_active, count_abandoned, created_at FROM objectives"
        ).map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let src_col_id: i32 = row.get(0).map_err(|e| e.to_string())?;
            let target_count: i32 = row.get(1).map_err(|e| e.to_string())?;
            let start_date: String = row.get(2).map_err(|e| e.to_string())?;
            let end_date: String = row.get(3).map_err(|e| e.to_string())?;
            let is_active: i32 = row.get(4).map_err(|e| e.to_string())?;
            let count_abandoned: i32 = row.get(5).map_err(|e| e.to_string())?;
            let created_at: String = row.get(6).map_err(|e| e.to_string())?;

            if let Some(dest_col_id) = col_id_map.get(&src_col_id) {
                let exists: bool = tx.query_row(
                    "SELECT COUNT(*) > 0 FROM objectives WHERE collection_id = ?1 AND start_date = ?2 AND end_date = ?3",
                    rusqlite::params![dest_col_id, start_date, end_date],
                    |r| r.get(0)
                ).unwrap_or(false);

                if !exists {
                    tx.execute(
                        "INSERT INTO objectives (collection_id, target_count, start_date, end_date, is_active, count_abandoned, created_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![dest_col_id, target_count, start_date, end_date, is_active, count_abandoned, created_at]
                    ).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // --- F. REVIEW TEMPLATES ---
    {
        let mut stmt = source_conn.prepare("SELECT name, icon, color, content, is_default FROM review_templates").map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let name: String = row.get(0).map_err(|e| e.to_string())?;
            let icon: String = row.get(1).map_err(|e| e.to_string())?;
            let color: Option<String> = row.get(2).map_err(|e| e.to_string())?;
            let content: String = row.get(3).map_err(|e| e.to_string())?;
            let is_default: i32 = row.get(4).map_err(|e| e.to_string())?;

            let exists: bool = tx.query_row(
                "SELECT COUNT(*) > 0 FROM review_templates WHERE name = ?1",
                [&name],
                |r| r.get(0)
            ).unwrap_or(false);

            if !exists {
                tx.execute(
                    "INSERT INTO review_templates (name, icon, color, content, is_default) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![name, icon, color, content, is_default]
                ).map_err(|e| e.to_string())?;
            }
        }
    }

    tx.commit().map_err(|e| format!("Erreur lors de la validation des modifications : {}", e))?;

    Ok(ImportResult {
        imported_collections,
        imported_media,
        imported_images,
    })
}
