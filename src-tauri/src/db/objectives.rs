use rusqlite::{Connection, Result, params};
use crate::models::{Objective, CreateObjectiveDto, UpdateObjectiveDto};

/// Get all objectives with their current progress computed from media table.
/// Optimized: uses 2 queries instead of N subqueries (one per objective)
/// Note: Date filtering is done côté Rust to handle per-objective date ranges
pub fn get_all(conn: &Connection) -> Result<Vec<Objective>> {
    // Query 1: Get all objectives without counts
    let mut stmt = conn.prepare(
        "SELECT o.id, o.collection_id, o.target_count, o.start_date, o.end_date,
                o.is_active, o.count_abandoned, o.created_at
         FROM objectives o
         ORDER BY o.is_active DESC, o.end_date ASC"
    )?;

    let objectives: Vec<(Objective, i64, String, String)> = stmt.query_map([], |row| {
        let collection_id: i64 = row.get(1)?;
        let start_date: String = row.get(3)?;
        let end_date: String = row.get(4)?;
        Ok((
            Objective {
                id: row.get(0)?,
                collection_id,
                target_count: row.get(2)?,
                start_date: start_date.clone(),
                end_date: end_date.clone(),
                is_active: row.get::<_, Option<bool>>(5)?.unwrap_or(true),
                count_abandoned: row.get::<_, Option<bool>>(6)?.unwrap_or(false),
                created_at: row.get(7)?,
                current_count: 0, // Will be filled after filtering by date
            },
            collection_id,
            start_date,
            end_date,
        ))
    })?.collect::<Result<Vec<_>>>()?;

    if objectives.is_empty() {
        return Ok(vec![]);
    }

    // Query 2: Get all media with dates for the collections we need
    let collection_ids: Vec<i64> = {
        let unique: std::collections::HashSet<i64> = objectives.iter().map(|(_, cid, _, _)| *cid).collect();
        unique.into_iter().collect()
    };
    let placeholders = collection_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    
    let media_sql = format!(
        "SELECT collection_id, experience_date, progress_status
         FROM media
         WHERE collection_id IN ({})
           AND experience_date IS NOT NULL
           AND progress_status IN ('COMPLETED', 'ABANDONED')",
        placeholders
    );

    let mut media_stmt = conn.prepare(&media_sql)?;
    let media_data: Vec<(i64, String, Option<String>)> = media_stmt
        .query_map(rusqlite::params_from_iter(collection_ids.iter()), |row| {
            Ok((
                row.get::<_, i64>(0)?,              // collection_id
                row.get::<_, String>(1)?,           // experience_date
                row.get::<_, Option<String>>(2)?,   // progress_status
            ))
        })?.collect::<Result<Vec<_>>>()?;

    // Group media by collection_id for efficient lookup
    let mut media_by_collection: std::collections::HashMap<i64, Vec<(String, Option<String>)>> = std::collections::HashMap::new();
    for (cid, date, progress_status) in media_data {
        media_by_collection.entry(cid).or_default().push((date, progress_status));
    }

    // Calculate counts for each objective with date filtering
    let result: Vec<Objective> = objectives
        .into_iter()
        .map(|(mut obj, cid, start_date, end_date)| {
            if let Some(media_list) = media_by_collection.get(&cid) {
                let count = media_list.iter().filter(|(date, progress_status)| {
                    // Check date range
                    let in_range = date >= &start_date && date <= &end_date;
                    // Check completion criteria based on progress_status
                    let count_this = match progress_status.as_deref() {
                        Some("COMPLETED") => true,
                        Some("ABANDONED") => obj.count_abandoned,
                        _ => false,
                    };
                    in_range && count_this
                }).count() as i32;
                obj.current_count = count;
            }
            obj
        })
        .collect();

    Ok(result)
}

pub fn insert(conn: &Connection, dto: CreateObjectiveDto) -> Result<i64> {
    conn.execute(
        "INSERT INTO objectives (collection_id, target_count, start_date, end_date, count_abandoned)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![dto.collection_id, dto.target_count, dto.start_date, dto.end_date, dto.count_abandoned.unwrap_or(false)],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn update(conn: &Connection, dto: UpdateObjectiveDto) -> Result<()> {
    let mut updates = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(target_count) = dto.target_count {
        updates.push("target_count = ?");
        params_vec.push(Box::new(target_count));
    }
    if let Some(start_date) = dto.start_date {
        updates.push("start_date = ?");
        params_vec.push(Box::new(start_date));
    }
    if let Some(end_date) = dto.end_date {
        updates.push("end_date = ?");
        params_vec.push(Box::new(end_date));
    }
    if let Some(is_active) = dto.is_active {
        updates.push("is_active = ?");
        params_vec.push(Box::new(is_active));
    }
    if let Some(count_abandoned) = dto.count_abandoned {
        updates.push("count_abandoned = ?");
        params_vec.push(Box::new(count_abandoned));
    }

    if updates.is_empty() {
        return Ok(());
    }

    params_vec.push(Box::new(dto.objective_id));

    let query = format!(
        "UPDATE objectives SET {} WHERE id = ?",
        updates.join(", ")
    );

    conn.execute(&query, rusqlite::params_from_iter(params_vec.iter()))?;

    Ok(())
}

pub fn delete(conn: &Connection, objective_id: i64) -> Result<()> {
    conn.execute("DELETE FROM objectives WHERE id = ?1", params![objective_id])?;
    Ok(())
}
