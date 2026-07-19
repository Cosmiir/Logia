use rusqlite::{Connection, Result, params, OptionalExtension};
use crate::models::{Media, MediaAttachment, MediaDetail, MediaImage, CreateMediaDto, UpdateMediaDto};
use super::genres;

/// Struct encapsulating all possible media filters
#[derive(Debug, Default)]
pub struct MediaFilters {
    pub search_query: Option<String>,
    pub genre_ids: Option<Vec<i64>>,
    pub person_ids: Option<Vec<i64>>,
    pub min_rating: Option<f64>,
    pub max_rating: Option<f64>,
    pub media_statuses: Option<Vec<String>>,
    pub progress_statuses: Option<Vec<String>>,
    pub creators: Option<Vec<String>>,
    pub release_date_from: Option<String>,
    pub release_date_to: Option<String>,
    pub experience_date_from: Option<String>,
    pub experience_date_to: Option<String>,
    pub created_at_from: Option<String>,
    pub created_at_to: Option<String>,
    pub progress_total_min: Option<f64>,
    pub progress_total_max: Option<f64>,
    pub progress_current_min: Option<f64>,
    pub progress_current_max: Option<f64>,
    pub use_fts: bool, // Use FTS5 for search instead of LIKE
}

/// Build WHERE conditions and params from filters
/// Returns: (conditions, params, has_genre_join)
fn build_filter_conditions(
    filters: &MediaFilters,
    collection_id: Option<i64>,
    start_param_idx: usize,
) -> (Vec<String>, Vec<Box<dyn rusqlite::ToSql>>, bool) {
    let mut conditions = vec![];
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    let mut param_idx = start_param_idx;
    let mut has_genre_join = false;

    // Collection filter
    if let Some(cid) = collection_id {
        conditions.push(format!("m.collection_id = ?{}", param_idx));
        params_vec.push(Box::new(cid));
        param_idx += 1;
    }

    // Search filter (FTS or LIKE)
    if let Some(search) = &filters.search_query {
        if !search.is_empty() {
            if filters.use_fts {
                // FTS5 search - we'll handle this separately
                // This is a placeholder that will be replaced with FTS logic
            } else {
                // LIKE search
                let idx1 = param_idx;
                let idx2 = param_idx + 1;
                conditions.push(format!(
                    "(LOWER(m.title) LIKE '%' || LOWER(?{}) || '%' OR LOWER(m.creator) LIKE '%' || LOWER(?{}) || '%')",
                    idx1, idx2
                ));
                params_vec.push(Box::new(search.clone()));
                params_vec.push(Box::new(search.clone()));
                param_idx += 2;
            }
        }
    }

    // Genre filter - note: the JOIN is handled by the caller, we just add the condition
    if let Some(genres) = &filters.genre_ids {
        if !genres.is_empty() {
            has_genre_join = true;
            let placeholders: Vec<String> = genres
                .iter()
                .enumerate()
                .map(|(i, _)| format!("?{}", param_idx + i))
                .collect();
            conditions.push(format!("mg.genre_id IN ({})", placeholders.join(",")));
            for genre_id in genres {
                params_vec.push(Box::new(*genre_id));
            }
            param_idx += genres.len();
        }
    }

    // Person (Credits) filter
    if let Some(people) = &filters.person_ids {
        if !people.is_empty() {
            let placeholders: Vec<String> = people
                .iter()
                .enumerate()
                .map(|(i, _)| format!("?{}", param_idx + i))
                .collect();
            conditions.push(format!("m.id IN (SELECT media_id FROM media_credits WHERE person_id IN ({}))", placeholders.join(",")));
            for person_id in people {
                params_vec.push(Box::new(*person_id));
            }
            param_idx += people.len();
        }
    }

    // Media status filter
    if let Some(statuses) = &filters.media_statuses {
        if !statuses.is_empty() {
            let placeholders: Vec<String> = statuses
                .iter()
                .enumerate()
                .map(|(i, _)| format!("?{}", param_idx + i))
                .collect();
            conditions.push(format!("m.media_status IN ({})", placeholders.join(",")));
            for status in statuses {
                params_vec.push(Box::new(status.clone()));
            }
            param_idx += statuses.len();
        }
    }

    // Progress status filter
    if let Some(statuses) = &filters.progress_statuses {
        if !statuses.is_empty() {
            let placeholders: Vec<String> = statuses
                .iter()
                .enumerate()
                .map(|(i, _)| format!("?{}", param_idx + i))
                .collect();
            conditions.push(format!("m.progress_status IN ({})", placeholders.join(",")));
            for status in statuses {
                params_vec.push(Box::new(status.clone()));
            }
            param_idx += statuses.len();
        }
    }

    // Creator filter
    if let Some(creators) = &filters.creators {
        if !creators.is_empty() {
            let mut creator_conditions = Vec::new();
            for (i, _) in creators.iter().enumerate() {
                let idx = param_idx + i;
                // Matches: exact single value | first in list "name; ..." | middle "...; name; ..." | last "...; name"
                creator_conditions.push(format!(
                    "(LOWER(m.creator) = ?{0} OR LOWER(m.creator) LIKE ?{0} || ';%' OR LOWER(m.creator) LIKE '%; ' || ?{0} || ';%' OR LOWER(m.creator) LIKE '%; ' || ?{0})",
                    idx
                ));
            }
            conditions.push(format!("({})", creator_conditions.join(" OR ")));
            for creator in creators {
                params_vec.push(Box::new(creator.to_lowercase()));
            }
            param_idx += creators.len();
        }
    }

    // Date range filters
    if let Some(from) = &filters.release_date_from {
        if !from.is_empty() {
            conditions.push(format!("m.release_date >= ?{}", param_idx));
            params_vec.push(Box::new(from.clone()));
            param_idx += 1;
        }
    }
    if let Some(to) = &filters.release_date_to {
        if !to.is_empty() {
            conditions.push(format!("m.release_date <= ?{}", param_idx));
            params_vec.push(Box::new(to.clone()));
            param_idx += 1;
        }
    }
    if let Some(from) = &filters.experience_date_from {
        if !from.is_empty() {
            conditions.push(format!("m.experience_date >= ?{}", param_idx));
            params_vec.push(Box::new(from.clone()));
            param_idx += 1;
        }
    }
    if let Some(to) = &filters.experience_date_to {
        if !to.is_empty() {
            conditions.push(format!("m.experience_date <= ?{}", param_idx));
            params_vec.push(Box::new(to.clone()));
            param_idx += 1;
        }
    }
    if let Some(from) = &filters.created_at_from {
        if !from.is_empty() {
            conditions.push(format!("m.created_at >= ?{}", param_idx));
            params_vec.push(Box::new(from.clone()));
            param_idx += 1;
        }
    }
    if let Some(to) = &filters.created_at_to {
        if !to.is_empty() {
            conditions.push(format!("m.created_at <= ?{}", param_idx));
            params_vec.push(Box::new(to.clone()));
            param_idx += 1;
        }
    }

    // Rating filter
    if let Some(min) = filters.min_rating {
        conditions.push(format!("m.user_rating >= ?{}", param_idx));
        params_vec.push(Box::new(min));
        param_idx += 1;
    }
    if let Some(max) = filters.max_rating {
        conditions.push(format!("m.user_rating <= ?{}", param_idx));
        params_vec.push(Box::new(max));
        param_idx += 1;
    }

    // Duration filter
    if let Some(min) = filters.progress_total_min {
        conditions.push(format!("m.progress_total >= ?{}", param_idx));
        params_vec.push(Box::new(min));
        param_idx += 1;
    }
    if let Some(max) = filters.progress_total_max {
        conditions.push(format!("m.progress_total <= ?{}", param_idx));
        params_vec.push(Box::new(max));
        param_idx += 1;
    }

    // Progression filter (progress_current)
    if let Some(min) = filters.progress_current_min {
        conditions.push(format!("m.progress_current >= ?{}", param_idx));
        params_vec.push(Box::new(min));
        param_idx += 1;
    }
    if let Some(max) = filters.progress_current_max {
        conditions.push(format!("m.progress_current <= ?{}", param_idx));
        params_vec.push(Box::new(max));
    }

    (conditions, params_vec, has_genre_join)
}

pub fn get_media(
    conn: &Connection,
    collection_id: Option<i64>,
    search_query: Option<&str>,
    genre_ids: Option<&[i64]>,
    person_ids: Option<&[i64]>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    sort_criteria: &[SortCriterion],
    limit: Option<i64>,
    offset: Option<i64>,
    // Additional filters
    media_statuses: Option<&[String]>,
    progress_statuses: Option<&[String]>,
    creators: Option<&[String]>,
    release_date_from: Option<&str>,
    release_date_to: Option<&str>,
    experience_date_from: Option<&str>,
    experience_date_to: Option<&str>,
    created_at_from: Option<&str>,
    created_at_to: Option<&str>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<Vec<Media>> {
    // Check if we should use FTS5
    let fts_query: Option<String> = if let Some(query) = search_query {
        if !query.is_empty() {
            Some(format!("{}*", query.replace('"', "\"")))
        } else {
            None
        }
    } else {
        None
    };

    let filters = MediaFilters {
        search_query: if fts_query.is_some() { None } else { search_query.map(|s| s.to_string()) },
        genre_ids: genre_ids.map(|g| g.to_vec()),
        person_ids: person_ids.map(|p| p.to_vec()),
        min_rating,
        max_rating,
        media_statuses: media_statuses.map(|w| w.to_vec()),
        progress_statuses: progress_statuses.map(|p| p.to_vec()),
        creators: creators.map(|c| c.to_vec()),
        release_date_from: release_date_from.map(|s| s.to_string()),
        release_date_to: release_date_to.map(|s| s.to_string()),
        experience_date_from: experience_date_from.map(|s| s.to_string()),
        experience_date_to: experience_date_to.map(|s| s.to_string()),
        created_at_from: created_at_from.map(|s| s.to_string()),
        created_at_to: created_at_to.map(|s| s.to_string()),
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
        use_fts: false,
    };

    // Build conditions with appropriate start index
    let start_idx = if fts_query.is_some() { 2 } else { 1 };
    let (conditions, mut params_vec, has_genre_join) = build_filter_conditions(&filters, collection_id, start_idx);

    let mut query = String::from(
        "SELECT DISTINCT m.id, m.collection_id, m.title, m.creator, m.release_date, 
         m.synopsis, m.user_rating, m.user_review, 
         m.progress_current, m.progress_total, m.progress_status, m.replay_count, m.experience_date, 
         m.experience_dates, m.created_at, m.updated_at,
         COALESCE(m.cover_path, first_img.thumb_path) as cover_image,
         m.cover_source_index, m.positive_points, m.negative_points, m.media_status
         FROM media m
         LEFT JOIN media_images first_img ON first_img.id = (
           SELECT id FROM media_images WHERE media_id = m.id ORDER BY position ASC LIMIT 1
         )"
    );

    // Add FTS join if needed
    if fts_query.is_some() {
        query.push_str(" INNER JOIN (SELECT rowid, bm25(media_fts, 10.0, 5.0, 1.0) as bm25_score FROM media_fts WHERE media_fts MATCH ?1 ORDER BY bm25_score ASC LIMIT 1000) fts ON m.id = fts.rowid");
    }

    // Add genre join if needed
    if has_genre_join {
        query.push_str(" INNER JOIN media_genres mg ON m.id = mg.media_id");
    }

    // Build WHERE conditions
    let mut all_conditions = Vec::new();
    
    // Add FTS query parameter if available
    if let Some(ref fq) = fts_query {
        let mut new_params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(fq.clone())];
        new_params.extend(params_vec);
        params_vec = new_params;
    }
    
    all_conditions.extend(conditions);

    if !all_conditions.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&all_conditions.join(" AND "));
    }

    // Sorting — prepend BM25 relevance when searching
    query.push_str(&build_order_by(sort_criteria, fts_query.is_some()));

    // Pagination
    if let Some(lim) = limit {
        query.push_str(&format!(" LIMIT {}", lim));
        if let Some(off) = offset {
            query.push_str(&format!(" OFFSET {}", off));
        }
    }

    let mut stmt = conn.prepare(&query)?;
    let media = stmt.query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
        Ok(Media {
            id: row.get(0)?,
            collection_id: row.get(1)?,
            title: row.get(2)?,
            creator: row.get(3)?,
            release_date: row.get(4)?,
            synopsis: row.get(5)?,
            user_rating: row.get(6)?,
            user_review: row.get(7)?,
            progress_current: row.get(8)?,
            progress_total: row.get(9)?,
            progress_status: row.get(10)?,
            replay_count: row.get(11)?,
            experience_date: row.get(12)?,
            experience_dates: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
            cover_image: row.get(16)?,
            cover_source_index: row.get(17)?,
            positive_points: row.get(18)?,
            negative_points: row.get(19)?,
            media_status: row.get(20)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(media)
}

/// Get only media IDs with filters and sorting (lightweight — no joins for images/genres)
/// Used for cross-page range selection to avoid fetching full media objects.
pub fn get_media_ids(
    conn: &Connection,
    collection_id: Option<i64>,
    search_query: Option<&str>,
    genre_ids: Option<&[i64]>,
    person_ids: Option<&[i64]>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    sort_criteria: &[SortCriterion],
    media_statuses: Option<&[String]>,
    progress_statuses: Option<&[String]>,
    creators: Option<&[String]>,
    release_date_from: Option<&str>,
    release_date_to: Option<&str>,
    experience_date_from: Option<&str>,
    experience_date_to: Option<&str>,
    created_at_from: Option<&str>,
    created_at_to: Option<&str>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<Vec<i64>> {
    let fts_query: Option<String> = if let Some(query) = search_query {
        if !query.is_empty() {
            Some(format!("{}*", query.replace('"', "\"")))
        } else {
            None
        }
    } else {
        None
    };

    let filters = MediaFilters {
        search_query: if fts_query.is_some() { None } else { search_query.map(|s| s.to_string()) },
        genre_ids: genre_ids.map(|g| g.to_vec()),
        person_ids: person_ids.map(|p| p.to_vec()),
        min_rating,
        max_rating,
        media_statuses: media_statuses.map(|w| w.to_vec()),
        progress_statuses: progress_statuses.map(|p| p.to_vec()),
        creators: creators.map(|c| c.to_vec()),
        release_date_from: release_date_from.map(|s| s.to_string()),
        release_date_to: release_date_to.map(|s| s.to_string()),
        experience_date_from: experience_date_from.map(|s| s.to_string()),
        experience_date_to: experience_date_to.map(|s| s.to_string()),
        created_at_from: created_at_from.map(|s| s.to_string()),
        created_at_to: created_at_to.map(|s| s.to_string()),
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
        use_fts: false,
    };

    let start_idx = if fts_query.is_some() { 2 } else { 1 };
    let (conditions, mut params_vec, has_genre_join) = build_filter_conditions(&filters, collection_id, start_idx);

    let mut query = String::from("SELECT DISTINCT m.id FROM media m");

    if fts_query.is_some() {
        query.push_str(" INNER JOIN (SELECT rowid, bm25(media_fts, 10.0, 5.0, 1.0) as bm25_score FROM media_fts WHERE media_fts MATCH ?1 ORDER BY bm25_score ASC LIMIT 1000) fts ON m.id = fts.rowid");
    }

    if has_genre_join {
        query.push_str(" INNER JOIN media_genres mg ON m.id = mg.media_id");
    }

    let mut all_conditions = Vec::new();

    if let Some(ref fq) = fts_query {
        let mut new_params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(fq.clone())];
        new_params.extend(params_vec);
        params_vec = new_params;
    }

    all_conditions.extend(conditions);

    if !all_conditions.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&all_conditions.join(" AND "));
    }

    query.push_str(&build_order_by(sort_criteria, fts_query.is_some()));

    let mut stmt = conn.prepare(&query)?;
    let ids = stmt.query_map(rusqlite::params_from_iter(params_vec.iter()), |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ids)
}

// Helper struct for multi-column sorting
#[derive(serde::Deserialize)]
pub struct SortCriterion {
    pub field: String,
    pub order: String, // "asc" or "desc"
}

// Build ORDER BY clause from multiple criteria
fn build_order_by(criteria: &[SortCriterion], prepend_relevance: bool) -> String {
    let relevance_prefix = if prepend_relevance {
        "fts.bm25_score ASC"
    } else {
        ""
    };

    if criteria.is_empty() {
        if prepend_relevance {
            return " ORDER BY fts.bm25_score ASC, m.created_at DESC".to_string();
        }
        return " ORDER BY m.created_at DESC".to_string();
    }

    let columns: Vec<String> = criteria.iter().map(|c| {
        let col = match c.field.as_str() {
            "title" => "m.title COLLATE NOCASE",
            "experience_date" => "m.experience_date",
            "rating" => "m.user_rating",
            "release_date" => "m.release_date",
            "media_status" => "m.media_status",
            "progress_status" => "m.progress_status",
            "progress" => "m.progress_current",
            "creator" => "m.creator COLLATE NOCASE",
            "created_at" => "m.created_at",
            "updated_at" => "m.updated_at",
            _ => "m.created_at",
        };
        let order = if c.order.to_lowercase() == "asc" { "ASC" } else { "DESC" };
        format!("{} {}", col, order)
    }).collect();

    if prepend_relevance {
        format!(" ORDER BY {}, {}", relevance_prefix, columns.join(", "))
    } else {
        format!(" ORDER BY {}", columns.join(", "))
    }
}

// Count functions for pagination
pub fn count_media(
    conn: &Connection,
    collection_id: Option<i64>,
    search_query: Option<&str>,
    genre_ids: Option<&[i64]>,
    person_ids: Option<&[i64]>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    media_statuses: Option<&[String]>,
    progress_statuses: Option<&[String]>,
    creators: Option<&[String]>,
    release_date_from: Option<&str>,
    release_date_to: Option<&str>,
    experience_date_from: Option<&str>,
    experience_date_to: Option<&str>,
    created_at_from: Option<&str>,
    created_at_to: Option<&str>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<i64> {
    // Use FTS5 for search (same logic as get_media)
    let fts_query: Option<String> = if let Some(query) = search_query {
        if !query.is_empty() {
            Some(format!("{}*", query.replace('"', "\"")))
        } else {
            None
        }
    } else {
        None
    };

    let filters = MediaFilters {
        search_query: if fts_query.is_some() { None } else { search_query.map(|s| s.to_string()) },
        genre_ids: genre_ids.map(|g| g.to_vec()),
        person_ids: person_ids.map(|p| p.to_vec()),
        min_rating,
        max_rating,
        media_statuses: media_statuses.map(|w| w.to_vec()),
        progress_statuses: progress_statuses.map(|p| p.to_vec()),
        creators: creators.map(|c| c.to_vec()),
        release_date_from: release_date_from.map(|s| s.to_string()),
        release_date_to: release_date_to.map(|s| s.to_string()),
        experience_date_from: experience_date_from.map(|s| s.to_string()),
        experience_date_to: experience_date_to.map(|s| s.to_string()),
        created_at_from: created_at_from.map(|s| s.to_string()),
        created_at_to: created_at_to.map(|s| s.to_string()),
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
        use_fts: false,
    };

    let start_idx = if fts_query.is_some() { 2 } else { 1 };
    let (conditions, mut params_vec, has_genre_join) = build_filter_conditions(&filters, collection_id, start_idx);

    let mut query = String::from("SELECT COUNT(DISTINCT m.id) FROM media m");

    // Add FTS join if needed
    if fts_query.is_some() {
        query.push_str(" INNER JOIN (SELECT rowid FROM media_fts WHERE media_fts MATCH ?1 LIMIT 1000) fts ON m.id = fts.rowid");
    }

    // Add genre join if needed
    if has_genre_join {
        query.push_str(" INNER JOIN media_genres mg ON m.id = mg.media_id");
    }

    // Build WHERE conditions
    let mut all_conditions = Vec::new();

    // Add FTS query parameter if available
    if let Some(ref fq) = fts_query {
        let mut new_params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(fq.clone())];
        new_params.extend(params_vec);
        params_vec = new_params;
    }

    all_conditions.extend(conditions);

    if !all_conditions.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&all_conditions.join(" AND "));
    }

    let count: i64 = conn.query_row(&query, rusqlite::params_from_iter(params_vec.iter()), |row| row.get(0))?;
    Ok(count)
}

pub fn get_distinct_creators(
    conn: &Connection,
    collection_id: Option<i64>,
    search_query: Option<&str>,
    genre_ids: Option<&[i64]>,
    person_ids: Option<&[i64]>,
    min_rating: Option<f64>,
    max_rating: Option<f64>,
    media_statuses: Option<&[String]>,
    progress_statuses: Option<&[String]>,
    release_date_from: Option<&str>,
    release_date_to: Option<&str>,
    experience_date_from: Option<&str>,
    experience_date_to: Option<&str>,
    created_at_from: Option<&str>,
    created_at_to: Option<&str>,
    progress_total_min: Option<f64>,
    progress_total_max: Option<f64>,
    progress_current_min: Option<f64>,
    progress_current_max: Option<f64>,
) -> Result<Vec<String>> {
    let fts_query: Option<String> = if let Some(query) = search_query {
        if !query.is_empty() {
            Some(format!("{}*", query.replace('"', "\"")))
        } else {
            None
        }
    } else {
        None
    };

    let filters = MediaFilters {
        search_query: if fts_query.is_some() { None } else { search_query.map(|s| s.to_string()) },
        genre_ids: genre_ids.map(|g| g.to_vec()),
        person_ids: person_ids.map(|p| p.to_vec()),
        min_rating,
        max_rating,
        media_statuses: media_statuses.map(|w| w.to_vec()),
        progress_statuses: progress_statuses.map(|p| p.to_vec()),
        creators: None,
        release_date_from: release_date_from.map(|s| s.to_string()),
        release_date_to: release_date_to.map(|s| s.to_string()),
        experience_date_from: experience_date_from.map(|s| s.to_string()),
        experience_date_to: experience_date_to.map(|s| s.to_string()),
        created_at_from: created_at_from.map(|s| s.to_string()),
        created_at_to: created_at_to.map(|s| s.to_string()),
        progress_total_min,
        progress_total_max,
        progress_current_min,
        progress_current_max,
        use_fts: false,
    };

    let start_idx = if fts_query.is_some() { 2 } else { 1 };
    let (conditions, mut params_vec, has_genre_join) = build_filter_conditions(&filters, collection_id, start_idx);

    let mut query = String::from("SELECT DISTINCT m.creator FROM media m");
    // Add FTS join if needed
    if fts_query.is_some() {
        query.push_str(" INNER JOIN (SELECT rowid FROM media_fts WHERE media_fts MATCH ?1 LIMIT 1000) fts ON m.id = fts.rowid");
    }
    if has_genre_join {
        query.push_str(" INNER JOIN media_genres mg ON m.id = mg.media_id");
    }

    let mut all_conditions = vec!["m.creator IS NOT NULL".to_string(), "TRIM(m.creator) != ''".to_string()];

    if let Some(ref fq) = fts_query {
        let mut new_params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(fq.clone())];
        new_params.extend(params_vec);
        params_vec = new_params;
    }
    all_conditions.extend(conditions);

    query.push_str(" WHERE ");
    query.push_str(&all_conditions.join(" AND "));
    query.push_str(" ORDER BY m.creator COLLATE NOCASE ASC");

    let mut stmt = conn.prepare(&query)?;
    let creators = stmt
        .query_map(rusqlite::params_from_iter(params_vec.iter()), |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(creators)
}

/// Search media using FTS5 (Full-Text Search)
/// Returns a list of media IDs matching the search query
#[allow(dead_code)]
pub fn search_fts(
    conn: &Connection,
    query: &str,
    limit: Option<i64>,
) -> Result<Vec<i64>> {
    let sql = "SELECT rowid FROM media_fts WHERE media_fts MATCH ?1 LIMIT ?2";
    let mut stmt = conn.prepare(sql)?;
    let ids = stmt
        .query_map(params![query, limit.unwrap_or(100)], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ids)
}

pub fn get_by_id(conn: &Connection, media_id: i64) -> Result<Option<MediaDetail>> {
    let mut stmt = conn.prepare(
        "SELECT media.id, media.collection_id, media.title, media.creator, media.release_date, media.synopsis,
         media.user_rating, media.user_review, media.progress_current,
         media.progress_total, media.progress_status, media.replay_count, media.experience_date, media.experience_dates, media.created_at, media.updated_at,
         COALESCE(media.cover_path, first_img.thumb_path) as cover_image,
         media.cover_source_index, media.positive_points, media.negative_points, media.media_status
         FROM media
         LEFT JOIN media_images first_img ON first_img.id = (
           SELECT id FROM media_images WHERE media_id = media.id ORDER BY position ASC LIMIT 1
         )
         WHERE media.id = ?1"
    )?;

    let media = stmt.query_row(params![media_id], |row| {
        Ok(Media {
            id: row.get(0)?,
            collection_id: row.get(1)?,
            title: row.get(2)?,
            creator: row.get(3)?,
            release_date: row.get(4)?,
            synopsis: row.get(5)?,
            user_rating: row.get(6)?,
            user_review: row.get(7)?,
            progress_current: row.get(8)?,
            progress_total: row.get(9)?,
            progress_status: row.get(10)?,
            replay_count: row.get(11)?,
            experience_date: row.get(12)?,
            experience_dates: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
            cover_image: row.get(16)?,
            cover_source_index: row.get(17)?,
            positive_points: row.get(18)?,
            negative_points: row.get(19)?,
            media_status: row.get(20)?,
        })
    }).optional()?;

    if let Some(media) = media {
        let images = get_images(conn, media_id)?;
        let attachments = get_attachments(conn, media_id)?;
        let media_genres = genres::get_by_media_id(conn, media_id)?;
        let media_credits = super::people::get_by_media_id(conn, media_id)?;
        Ok(Some(MediaDetail { media, images, attachments, genres: media_genres, credits: media_credits }))
    } else {
        Ok(None)
    }
}

pub fn insert(conn: &Connection, dto: CreateMediaDto) -> Result<i64> {
    conn.execute(
        "INSERT INTO media (collection_id, title, creator, release_date, synopsis,
         user_rating, user_review, progress_current,
         progress_total, progress_status, replay_count, experience_date, experience_dates, positive_points, negative_points, media_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            dto.collection_id,
            dto.title,
            dto.creator,
            dto.release_date,
            dto.synopsis,
            dto.user_rating,
            dto.user_review,
            dto.progress_current,
            dto.progress_total,
            dto.progress_status,
            dto.replay_count.unwrap_or(0),
            dto.experience_date,
            dto.experience_dates,
            dto.positive_points,
            dto.negative_points,
            dto.media_status,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update(conn: &Connection, dto: UpdateMediaDto) -> Result<()> {
    let mut updates = vec![];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(collection_id) = dto.collection_id {
        updates.push("collection_id = ?");
        params.push(Box::new(collection_id));
    }
    if let Some(title) = dto.title {
        updates.push("title = ?");
        params.push(Box::new(title));
    }
    if let Some(creator) = dto.creator {
        updates.push("creator = ?");
        params.push(Box::new(creator));
    }
    if let Some(release_date) = dto.release_date {
        updates.push("release_date = ?");
        params.push(Box::new(release_date));
    }
    if let Some(synopsis) = dto.synopsis {
        updates.push("synopsis = ?");
        let val: Option<String> = if synopsis.trim().is_empty() { None } else { Some(synopsis) };
        params.push(Box::new(val));
    }
    if let Some(user_rating) = dto.user_rating {
        updates.push("user_rating = ?");
        params.push(Box::new(user_rating));
    }
    if let Some(user_review) = dto.user_review {
        updates.push("user_review = ?");
        let val: Option<String> = if user_review.trim().is_empty() { None } else { Some(user_review) };
        params.push(Box::new(val));
    }
    if let Some(progress_current) = dto.progress_current {
        updates.push("progress_current = ?");
        params.push(Box::new(progress_current));
    }
    if let Some(progress_total) = dto.progress_total {
        updates.push("progress_total = ?");
        params.push(Box::new(progress_total));
    }
    if let Some(progress_status) = dto.progress_status {
        updates.push("progress_status = ?");
        params.push(Box::new(progress_status));
    }
    if let Some(replay_count) = dto.replay_count {
        updates.push("replay_count = ?");
        params.push(Box::new(replay_count));
    }
    if let Some(experience_date) = dto.experience_date {
        updates.push("experience_date = ?");
        params.push(Box::new(experience_date));
    }
    if let Some(experience_dates) = dto.experience_dates {
        updates.push("experience_dates = ?");
        params.push(Box::new(experience_dates));
    }
    if let Some(media_status) = dto.media_status {
        updates.push("media_status = ?");
        params.push(Box::new(media_status));
    }
    if let Some(positive_points) = dto.positive_points {
        updates.push("positive_points = ?");
        let val: Option<String> = if positive_points.trim().is_empty() { None } else { Some(positive_points) };
        params.push(Box::new(val));
    }
    if let Some(negative_points) = dto.negative_points {
        updates.push("negative_points = ?");
        let val: Option<String> = if negative_points.trim().is_empty() { None } else { Some(negative_points) };
        params.push(Box::new(val));
    }

    if updates.is_empty() {
        return Ok(());
    }

    // Set updated_at explicitly (avoids double FTS trigger from the DB trigger approach)
    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(Box::new(dto.media_id));

    let query = format!("UPDATE media SET {} WHERE id = ?", updates.join(", "));
    conn.execute(&query, rusqlite::params_from_iter(params.iter()))?;

    Ok(())
}

pub fn delete(conn: &Connection, media_id: i64) -> Result<()> {
    conn.execute("DELETE FROM media WHERE id = ?1", params![media_id])?;
    Ok(())
}

// Image-related functions
pub fn insert_image(
    conn: &Connection,
    media_id: i64,
    full_path: &str,
    thumb_path: &str,
    position: i32,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO media_images (media_id, full_path, thumb_path, position) VALUES (?1, ?2, ?3, ?4)",
        params![media_id, full_path, thumb_path, position],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_images(conn: &Connection, media_id: i64) -> Result<Vec<MediaImage>> {
    let mut stmt = conn.prepare(
        "SELECT id, media_id, full_path, thumb_path, position, created_at 
         FROM media_images WHERE media_id = ?1 ORDER BY position ASC"
    )?;
    
    let images = stmt.query_map(params![media_id], |row| {
        Ok(MediaImage {
            id: row.get(0)?,
            media_id: row.get(1)?,
            full_path: row.get(2)?,
            thumb_path: row.get(3)?,
            position: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(images)
}

pub fn get_image_by_id(conn: &Connection, image_id: i64) -> Result<Option<MediaImage>> {
    let mut stmt = conn.prepare(
        "SELECT id, media_id, full_path, thumb_path, position, created_at 
         FROM media_images WHERE id = ?1"
    )?;
    
    let image = stmt.query_row(params![image_id], |row| {
        Ok(MediaImage {
            id: row.get(0)?,
            media_id: row.get(1)?,
            full_path: row.get(2)?,
            thumb_path: row.get(3)?,
            position: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).optional()?;

    Ok(image)
}

pub fn delete_image(conn: &Connection, image_id: i64) -> Result<()> {
    conn.execute("DELETE FROM media_images WHERE id = ?1", params![image_id])?;
    Ok(())
}

pub fn set_cover_path(
    conn: &Connection,
    media_id: i64,
    cover_path: &str,
    cover_source_index: Option<i64>,
) -> Result<()> {
    conn.execute(
        "UPDATE media SET cover_path = ?1, cover_source_index = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![cover_path, cover_source_index, media_id],
    )?;
    Ok(())
}

/// Clear cover path and source index when all images are deleted
pub fn clear_cover_path(conn: &Connection, media_id: i64) -> Result<()> {
    conn.execute(
        "UPDATE media SET cover_path = NULL, cover_source_index = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![media_id],
    )?;
    Ok(())
}

/// Update positions of multiple images at once
pub fn update_image_positions(conn: &mut Connection, updates: &[(i64, i32)]) -> Result<()> {
    let tx = conn.transaction()?;
    // Passer par des positions temporaires négatives pour éviter les conflits UNIQUE
    for (image_id, _) in updates {
        tx.execute(
            "UPDATE media_images SET position = -id WHERE id = ?1",
            params![image_id],
        )?;
    }
    // Puis appliquer les vraies positions
    for (image_id, position) in updates {
        tx.execute(
            "UPDATE media_images SET position = ?1 WHERE id = ?2",
            params![position, image_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Get similar media from the same collection, sorted by number of common genres
/// Uses LEFT JOIN to include all media from collection, sorted by common genres count DESC
pub fn get_similar_media(
    conn: &Connection,
    media_id: i64,
    collection_id: i64,
    limit: i64,
) -> Result<Vec<Media>> {
    let genre_ids: Vec<i64> = {
        let mut stmt = conn.prepare(
            "SELECT genre_id FROM media_genres WHERE media_id = ?1 AND position < 9 ORDER BY position ASC"
        )?;
        let result = stmt.query_map(params![media_id], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        result
    };

    if genre_ids.is_empty() {
        return Ok(vec![]);
    }

    let matching_genre_ids = genre_ids;

    let placeholders = matching_genre_ids.iter().enumerate()
        .map(|(i, _)| format!("?{}", i + 3))
        .collect::<Vec<_>>()
        .join(",");
    let limit_idx = matching_genre_ids.len() + 3;
    let sql = format!(
        "SELECT m.id, m.collection_id, m.title, m.creator, m.release_date,
                m.synopsis, m.user_rating, m.user_review,
                m.progress_current, m.progress_total, m.progress_status,
                m.replay_count, m.experience_date, m.experience_dates,
                m.created_at, m.updated_at,
                COALESCE(m.cover_path, first_img.thumb_path) as cover_image,
                m.cover_source_index, m.positive_points, m.negative_points, m.media_status,
                COUNT(mg2.genre_id) as common_genre_count
         FROM media m
         LEFT JOIN media_images first_img ON first_img.id = (
           SELECT id FROM media_images WHERE media_id = m.id ORDER BY position ASC LIMIT 1
         )
         LEFT JOIN media_genres mg2 ON mg2.media_id = m.id AND mg2.position < 9 AND mg2.genre_id IN ({})
         WHERE m.collection_id = ?1 AND m.id != ?2
         GROUP BY m.id
         HAVING common_genre_count > 0
         ORDER BY common_genre_count DESC, m.created_at DESC
         LIMIT ?{}",
        placeholders, limit_idx
    );

    let mut all_params: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(collection_id),
        Box::new(media_id),
    ];
    for id in &matching_genre_ids {
        all_params.push(Box::new(*id));
    }
    all_params.push(Box::new(limit));

    let mut stmt = conn.prepare(&sql)?;
    let result = stmt.query_map(rusqlite::params_from_iter(all_params.iter()), map_media_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(result)
}

/// Get the min and max progress_current values for a collection
/// Returns (min, max) tuple, or (0.0, 0.0) if no media with progress_current exists
pub fn get_progress_current_range(conn: &Connection, collection_id: i64) -> Result<(f64, f64)> {
    let (min, max): (Option<f64>, Option<f64>) = conn.query_row(
        "SELECT MIN(progress_current), MAX(progress_current) FROM media WHERE collection_id = ?1 AND progress_current IS NOT NULL",
        params![collection_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    Ok((min.unwrap_or(0.0), max.unwrap_or(0.0)))
}

fn map_media_row(row: &rusqlite::Row) -> rusqlite::Result<Media> {
    Ok(Media {
        id: row.get(0)?,
        collection_id: row.get(1)?,
        title: row.get(2)?,
        creator: row.get(3)?,
        release_date: row.get(4)?,
        synopsis: row.get(5)?,
        user_rating: row.get(6)?,
        user_review: row.get(7)?,
        progress_current: row.get(8)?,
        progress_total: row.get(9)?,
        progress_status: row.get(10)?,
        replay_count: row.get(11)?,
        experience_date: row.get(12)?,
        experience_dates: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        cover_image: row.get(16)?,
        cover_source_index: row.get(17)?,
        positive_points: row.get(18)?,
        negative_points: row.get(19)?,
        media_status: row.get(20)?,
    })
}

pub fn insert_attachment(
    conn: &Connection,
    media_id: i64,
    original_name: &str,
    stored_path: &str,
    size_bytes: i64,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO media_attachments (media_id, original_name, stored_path, size_bytes) VALUES (?1, ?2, ?3, ?4)",
        params![media_id, original_name, stored_path, size_bytes],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_attachments(conn: &Connection, media_id: i64) -> Result<Vec<MediaAttachment>> {
    let mut stmt = conn.prepare(
        "SELECT id, media_id, original_name, stored_path, size_bytes, created_at
         FROM media_attachments WHERE media_id = ?1 ORDER BY created_at ASC, id ASC"
    )?;

    let attachments = stmt.query_map(params![media_id], |row| {
        Ok(MediaAttachment {
            id: row.get(0)?,
            media_id: row.get(1)?,
            original_name: row.get(2)?,
            stored_path: row.get(3)?,
            size_bytes: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(attachments)
}

pub fn get_attachment_by_id(conn: &Connection, attachment_id: i64) -> Result<Option<MediaAttachment>> {
    let mut stmt = conn.prepare(
        "SELECT id, media_id, original_name, stored_path, size_bytes, created_at
         FROM media_attachments WHERE id = ?1"
    )?;

    let attachment = stmt.query_row(params![attachment_id], |row| {
        Ok(MediaAttachment {
            id: row.get(0)?,
            media_id: row.get(1)?,
            original_name: row.get(2)?,
            stored_path: row.get(3)?,
            size_bytes: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).optional()?;

    Ok(attachment)
}

pub fn delete_attachment(conn: &Connection, attachment_id: i64) -> Result<()> {
    conn.execute("DELETE FROM media_attachments WHERE id = ?1", params![attachment_id])?;
    Ok(())
}
