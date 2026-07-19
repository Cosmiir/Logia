use tauri::State;
use crate::AppState;
use crate::db;
use super::*;

fn translate_progress(s: &str) -> &str {
    match s {
        "NOT_STARTED" => "À voir",
        "IN_PROGRESS" => "En cours",
        "COMPLETED"   => "Terminé",
        "ABANDONED"   => "Abandonné",
        other         => other,
    }
}

fn translate_media_status(s: &str) -> &str {
    match s {
        "UPCOMING"  => "À venir",
        "ONGOING"   => "En cours",
        "COMPLETED" => "Terminé",
        "ABANDONED" => "Abandonné",
        other       => other,
    }
}

fn add_media_dir_without_attachments<W: std::io::Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    dir: &std::path::Path,
    prefix: &str,
    options: zip::write::FileOptions,
) -> Result<(), String> {
    if !dir.exists() { return Ok(()); }

    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let name = format!("{}/{}", prefix, entry.file_name().to_string_lossy());

        if path.is_file() {
            let data = std::fs::read(&path).map_err(|e| e.to_string())?;
            zip.start_file(&name, options).map_err(|e| e.to_string())?;
            std::io::Write::write_all(zip, &data).map_err(|e| e.to_string())?;
        } else if path.is_dir() {
            if entry.file_name() == "attachments" {
                continue;
            }
            add_media_dir_without_attachments(zip, &path, &name, options)?;
        }
    }
    Ok(())
}

fn add_dir_to_zip<W: std::io::Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    dir: &std::path::Path,
    prefix: &str,
    options: zip::write::FileOptions,
) -> Result<(), String> {
    if !dir.exists() { return Ok(()); }

    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let name = format!("{}/{}", prefix, entry.file_name().to_string_lossy());

        if path.is_file() {
            let data = std::fs::read(&path).map_err(|e| e.to_string())?;
            zip.start_file(&name, options).map_err(|e| e.to_string())?;
            std::io::Write::write_all(zip, &data).map_err(|e| e.to_string())?;
        } else if path.is_dir() {
            add_dir_to_zip(zip, &path, &name, options)?;
        }
    }
    Ok(())
}

/// Export the database (and optionally images) to a ZIP file
#[tauri::command]
pub async fn export_database(
    state: State<'_, AppState>,
    destination_path: String,
    include_images: bool,
    include_attachments: bool,
) -> Result<ExportResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let storage_dir = state.storage_dir.lock().map_err(|e| e.to_string())?;

    let manifest = db::profiles::load_manifest(&storage_dir);
    let profile_id = &manifest.active_profile_id;

    let db_path = db::profiles::profile_db_path(&storage_dir, profile_id);
    let media_dir = db::profiles::profile_media_dir(&storage_dir, profile_id);
    let people_dir = db::profiles::profile_people_dir(&storage_dir, profile_id);

    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").map_err(|e| e.to_string())?;

    let file = std::fs::File::create(&destination_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let db_data = std::fs::read(&db_path)
        .map_err(|e| format!("Failed to read database: {}", e))?;
    zip.start_file("logia.db", options).map_err(|e| e.to_string())?;
    std::io::Write::write_all(&mut zip, &db_data).map_err(|e| e.to_string())?;

    if include_images {
        if media_dir.exists() {
            if include_attachments {
                add_dir_to_zip(&mut zip, &media_dir, "storage/media", options)?;
            } else {
                add_media_dir_without_attachments(&mut zip, &media_dir, "storage/media", options)?;
            }
        }
        if people_dir.exists() {
            add_dir_to_zip(&mut zip, &people_dir, "storage/people", options)?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;

    let size = std::fs::metadata(&destination_path).map(|m| m.len()).unwrap_or(0);

    let exported_media = if include_images {
        Some(conn.query_row("SELECT COUNT(*) FROM media", [], |r| r.get(0)).unwrap_or(0))
    } else {
        None
    };

    Ok(ExportResult { path: destination_path, size_bytes: size, exported_media })
}

/// Export media data to CSV, TSV or Markdown with column selection
#[tauri::command]
pub async fn export_to_csv_or_markdown(
    state: State<'_, AppState>,
    request: CsvExportRequest,
) -> Result<CsvExportResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let where_clause = if let Some(ref ids) = request.collection_ids {
        if ids.is_empty() {
            String::new()
        } else {
            let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
            format!("WHERE m.collection_id IN ({})", placeholders.join(", "))
        }
    } else {
        String::new()
    };

    let query = format!(
        "SELECT m.id, m.collection_id, m.title, m.creator, m.release_date, m.synopsis,
                m.user_rating, m.user_review, m.progress_current, m.progress_total,
                m.progress_status, m.replay_count, m.experience_date,
                (SELECT GROUP_CONCAT(json_object('date', COALESCE(date,''), 'version', COALESCE(version,''), 'language', COALESCE(language,''), 'position', position), '||')
                 FROM experience_entries WHERE media_id = m.id ORDER BY position ASC) as experience_entries,
                m.positive_points, m.negative_points, m.media_status, m.created_at, m.updated_at,
                c.name as collection_name,
                GROUP_CONCAT(g.name, ', ') as genre_names
         FROM media m
         LEFT JOIN collections c ON m.collection_id = c.id
         LEFT JOIN media_genres mg ON m.id = mg.media_id
         LEFT JOIN genres g ON mg.genre_id = g.id
         {}
         GROUP BY m.id
         ORDER BY c.name, m.title",
        where_clause
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let (delimiter, is_markdown) = match request.format.as_str() {
        "markdown" => ("|".to_string(), true),
        "tsv" => ("\t".to_string(), false),
        _ => {
            let d = request.delimiter.clone().unwrap_or_else(|| ";".to_string());
            (d, false)
        }
    };

    let all_columns: Vec<(&str, &str)> = vec![
        ("id", "ID"),
        ("collection", "Collection"),
        ("title", "Title"),
        ("creator", "Creator"),
        ("release_date", "Release date"),
        ("synopsis", "Synopsis"),
        ("user_rating", "Rating"),
        ("user_review", "Review"),
        ("progress_current", "Current progress"),
        ("progress_total", "Total progress"),
        ("progress_status", "Progress status"),
        ("replay_count", "Replays"),
        ("experience_date", "Experience date"),
        ("experience_entries", "Experience entries"),
        ("positive_points", "Positive points"),
        ("negative_points", "Negative points"),
        ("media_status", "Media status"),
        ("genre_ids", "Genres"),
        ("created_at", "Created"),
        ("updated_at", "Updated"),
    ];

    let selected: Vec<(&str, &str)> = all_columns.iter()
        .filter(|(key, _)| request.columns.contains(&key.to_string()))
        .cloned()
        .collect();

    if selected.is_empty() {
        return Err("No columns selected".to_string());
    }

    let convert_rating = |raw: Option<f64>| -> String {
        match raw {
            None => String::new(),
            Some(r) => {
                let converted = r * request.rating_scale as f64 / 100.0;
                if converted.fract() == 0.0 {
                    format!("{:.0}", converted)
                } else {
                    format!("{:.1}", converted)
                }
            }
        }
    };

    let escape_cell = |val: &str, delim: &str, md: bool| -> String {
        if md {
            val.replace('|', "\\|").replace('\n', " ")
        } else if delim == "," {
            if val.contains(',') || val.contains('"') || val.contains('\n') {
                format!("\"{}\"", val.replace('"', "\"\""))
            } else {
                val.to_string()
            }
        } else {
            val.replace(delim, " ").replace('\n', " ")
        }
    };

    let mut output = String::new();

    let headers: Vec<String> = selected.iter()
        .map(|(_, label)| {
            if is_markdown {
                escape_cell(label, &delimiter, true)
            } else {
                escape_cell(label, &delimiter, false)
            }
        })
        .collect();

    if is_markdown {
        output.push_str(&format!("| {} |\n", headers.join(" | ")));
        let separators: Vec<String> = selected.iter().map(|_| "---".to_string()).collect();
        output.push_str(&format!("| {} |\n", separators.join(" | ")));
    } else {
        output.push_str(&headers.join(&delimiter));
        output.push('\n');
    }

    let mut exported_media = 0i32;

    let row_data: Vec<Vec<Option<String>>> = if let Some(ref ids) = request.collection_ids {
        if !ids.is_empty() {
            let params: Vec<rusqlite::types::Value> = ids.iter()
                .map(|id| rusqlite::types::Value::Integer(*id))
                .collect();
            stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
                Ok(vec![
                    row.get::<_, Option<i64>>(0).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<i64>>(1).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<String>>(2).ok().flatten(),
                    row.get::<_, Option<String>>(3).ok().flatten(),
                    row.get::<_, Option<String>>(4).ok().flatten(),
                    row.get::<_, Option<String>>(5).ok().flatten(),
                    row.get::<_, Option<f64>>(6).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<String>>(7).ok().flatten(),
                    row.get::<_, Option<i64>>(8).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<i64>>(9).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<String>>(10).ok().flatten(),
                    row.get::<_, Option<i64>>(11).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<String>>(12).ok().flatten(),
                    row.get::<_, Option<String>>(13).ok().flatten(),
                    row.get::<_, Option<String>>(14).ok().flatten(),
                    row.get::<_, Option<String>>(15).ok().flatten(),
                    row.get::<_, Option<String>>(16).ok().flatten(),
                    row.get::<_, Option<String>>(17).ok().flatten(),
                    row.get::<_, Option<String>>(18).ok().flatten(),
                    row.get::<_, Option<String>>(19).ok().flatten(),
                    row.get::<_, Option<String>>(20).ok().flatten(),
                ])
            }).map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
        } else {
            stmt.query_map([], |row| {
                Ok(vec![
                    row.get::<_, Option<i64>>(0).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<i64>>(1).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<String>>(2).ok().flatten(),
                    row.get::<_, Option<String>>(3).ok().flatten(),
                    row.get::<_, Option<String>>(4).ok().flatten(),
                    row.get::<_, Option<String>>(5).ok().flatten(),
                    row.get::<_, Option<f64>>(6).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<String>>(7).ok().flatten(),
                    row.get::<_, Option<i64>>(8).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<i64>>(9).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<String>>(10).ok().flatten(),
                    row.get::<_, Option<i64>>(11).ok().flatten().map(|v| v.to_string()),
                    row.get::<_, Option<String>>(12).ok().flatten(),
                    row.get::<_, Option<String>>(13).ok().flatten(),
                    row.get::<_, Option<String>>(14).ok().flatten(),
                    row.get::<_, Option<String>>(15).ok().flatten(),
                    row.get::<_, Option<String>>(16).ok().flatten(),
                    row.get::<_, Option<String>>(17).ok().flatten(),
                    row.get::<_, Option<String>>(18).ok().flatten(),
                    row.get::<_, Option<String>>(19).ok().flatten(),
                    row.get::<_, Option<String>>(20).ok().flatten(),
                ])
            }).map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
        }
    } else {
        stmt.query_map([], |row| {
            Ok(vec![
                row.get::<_, Option<i64>>(0).ok().flatten().map(|v| v.to_string()),
                row.get::<_, Option<i64>>(1).ok().flatten().map(|v| v.to_string()),
                row.get::<_, Option<String>>(2).ok().flatten(),
                row.get::<_, Option<String>>(3).ok().flatten(),
                row.get::<_, Option<String>>(4).ok().flatten(),
                row.get::<_, Option<String>>(5).ok().flatten(),
                row.get::<_, Option<f64>>(6).ok().flatten().map(|v| v.to_string()),
                row.get::<_, Option<String>>(7).ok().flatten(),
                row.get::<_, Option<i64>>(8).ok().flatten().map(|v| v.to_string()),
                row.get::<_, Option<i64>>(9).ok().flatten().map(|v| v.to_string()),
                row.get::<_, Option<String>>(10).ok().flatten(),
                row.get::<_, Option<i64>>(11).ok().flatten().map(|v| v.to_string()),
                row.get::<_, Option<String>>(12).ok().flatten(),
                row.get::<_, Option<String>>(13).ok().flatten(),
                row.get::<_, Option<String>>(14).ok().flatten(),
                row.get::<_, Option<String>>(15).ok().flatten(),
                row.get::<_, Option<String>>(16).ok().flatten(),
                row.get::<_, Option<String>>(17).ok().flatten(),
                row.get::<_, Option<String>>(18).ok().flatten(),
                row.get::<_, Option<String>>(19).ok().flatten(),
                row.get::<_, Option<String>>(20).ok().flatten(),
            ])
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    };

    for row in &row_data {
        let get_col = |key: &str| -> String {
            match key {
                "id"               => row[0].clone().unwrap_or_default(),
                "collection"       => row[19].clone().unwrap_or_default(),
                "title"            => row[2].clone().unwrap_or_default(),
                "creator"          => row[3].clone().unwrap_or_default(),
                "release_date"     => row[4].clone().unwrap_or_default(),
                "synopsis"         => row[5].clone().unwrap_or_default(),
                "user_rating"      => {
                    let raw = row[6].as_ref().and_then(|s| s.parse::<f64>().ok());
                    convert_rating(raw)
                }
                "user_review"      => row[7].clone().unwrap_or_default(),
                "progress_current" => row[8].clone().unwrap_or_default(),
                "progress_total"   => row[9].clone().unwrap_or_default(),
                "progress_status"  => row[10].as_ref().map(|s| translate_progress(s).to_string()).unwrap_or_default(),
                "replay_count"     => row[11].clone().unwrap_or_default(),
                "experience_date"  => row[12].clone().unwrap_or_default(),
                "experience_entries" => row[13].clone().unwrap_or_default(),
                "positive_points"  => row[14].clone().unwrap_or_default(),
                "negative_points"  => row[15].clone().unwrap_or_default(),
                "media_status"     => row[16].as_ref().map(|s| translate_media_status(s).to_string()).unwrap_or_default(),
                "genre_ids"        => row[20].clone().unwrap_or_default(),
                "created_at"       => row[17].clone().unwrap_or_default(),
                "updated_at"       => row[18].clone().unwrap_or_default(),
                _ => String::new(),
            }
        };

        let cells: Vec<String> = selected.iter()
            .map(|(key, _)| {
                let val = get_col(key);
                escape_cell(&val, &delimiter, is_markdown)
            })
            .collect();

        if is_markdown {
            output.push_str(&format!("| {} |\n", cells.join(" | ")));
        } else {
            output.push_str(&cells.join(&delimiter));
            output.push('\n');
        }
        exported_media += 1;
    }

    std::fs::write(&request.destination_path, output.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;

    let size = std::fs::metadata(&request.destination_path).map(|m| m.len()).unwrap_or(0);

    Ok(CsvExportResult {
        path: request.destination_path,
        exported_media,
        size_bytes: size,
    })
}
