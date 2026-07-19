use rusqlite::{Connection, Result, params, OptionalExtension};
use crate::models::{Collection, CreateCollectionDto, UpdateCollectionDto};

pub fn get_all(conn: &Connection) -> Result<Vec<Collection>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, creator_label, date_label, progression_unit, progression_label, progression_short_label, replay_date_label, duration_label, plural_with_s, consumption_verb, monthly_capacity, position, created_at 
         FROM collections 
         ORDER BY position ASC"
    )?;

    let collections = stmt.query_map([], |row| {
        Ok(Collection {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            creator_label: row.get(4)?,
            date_label: row.get(5)?,
            progression_unit: row.get(6)?,
            progression_label: row.get(7)?,
            progression_short_label: row.get(8)?,
            replay_date_label: row.get(9)?,
            duration_label: row.get(10)?,
            plural_with_s: row.get::<_, Option<bool>>(11)?.unwrap_or(false),
            consumption_verb: row.get(12)?,
            monthly_capacity: row.get(13)?,
            position: row.get(14)?,
            created_at: row.get(15)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(collections)
}

pub fn get_by_id(conn: &Connection, collection_id: i64) -> Result<Option<Collection>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, creator_label, date_label, progression_unit, progression_label, progression_short_label, replay_date_label, duration_label, plural_with_s, consumption_verb, monthly_capacity, position, created_at 
         FROM collections 
         WHERE id = ?1"
    )?;

    let collection = stmt.query_row(params![collection_id], |row| {
        Ok(Collection {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            creator_label: row.get(4)?,
            date_label: row.get(5)?,
            progression_unit: row.get(6)?,
            progression_label: row.get(7)?,
            progression_short_label: row.get(8)?,
            replay_date_label: row.get(9)?,
            duration_label: row.get(10)?,
            plural_with_s: row.get::<_, Option<bool>>(11)?.unwrap_or(false),
            consumption_verb: row.get(12)?,
            monthly_capacity: row.get(13)?,
            position: row.get(14)?,
            created_at: row.get(15)?,
        })
    }).optional()?;

    Ok(collection)
}

pub fn insert(conn: &Connection, dto: CreateCollectionDto) -> Result<i64> {
    let color = dto.color.unwrap_or_else(|| "#8B5CF6".to_string());
    let creator_label = dto.creator_label.unwrap_or_else(|| "Creator".to_string());
    let date_label = dto.date_label.unwrap_or_else(|| "Experience date".to_string());
    let progression_unit = dto.progression_unit.unwrap_or_else(|| "percent".to_string());
    let progression_label = dto.progression_label.unwrap_or_else(|| "Episode".to_string());

    // Get max position
    let max_position: i32 = conn.query_row(
        "SELECT COALESCE(MAX(position), -1) FROM collections",
        [],
        |row| row.get(0)
    )?;

    let progression_short_label = dto.progression_short_label;
    let replay_date_label = dto.replay_date_label;
    let duration_label = dto.duration_label;

    let plural_with_s = dto.plural_with_s.unwrap_or(false);
    let consumption_verb = dto.consumption_verb;
    let monthly_capacity = dto.monthly_capacity;
    conn.execute(
        "INSERT INTO collections (name, icon, color, creator_label, date_label, progression_unit, progression_label, progression_short_label, replay_date_label, duration_label, plural_with_s, consumption_verb, monthly_capacity, position) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![dto.name, dto.icon, color, creator_label, date_label, progression_unit, progression_label, progression_short_label, replay_date_label, duration_label, plural_with_s, consumption_verb, monthly_capacity, max_position + 1],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn update(conn: &Connection, dto: UpdateCollectionDto) -> Result<()> {
    let mut updates = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(name) = dto.name {
        updates.push("name = ?");
        params.push(Box::new(name));
    }
    if let Some(icon) = dto.icon {
        updates.push("icon = ?");
        params.push(Box::new(icon));
    }
    if let Some(color) = dto.color {
        updates.push("color = ?");
        params.push(Box::new(color));
    }
    if let Some(creator_label) = dto.creator_label {
        updates.push("creator_label = ?");
        params.push(Box::new(creator_label));
    }
    if let Some(date_label) = dto.date_label {
        updates.push("date_label = ?");
        params.push(Box::new(date_label));
    }
    if let Some(progression_unit) = dto.progression_unit {
        updates.push("progression_unit = ?");
        params.push(Box::new(progression_unit));
    }
    if let Some(progression_label) = dto.progression_label {
        updates.push("progression_label = ?");
        params.push(Box::new(progression_label));
    }
    if let Some(progression_short_label) = dto.progression_short_label {
        updates.push("progression_short_label = ?");
        params.push(Box::new(progression_short_label));
    }
    if let Some(replay_date_label) = dto.replay_date_label {
        updates.push("replay_date_label = ?");
        params.push(Box::new(replay_date_label));
    }
    if let Some(duration_label) = dto.duration_label {
        updates.push("duration_label = ?");
        params.push(Box::new(duration_label));
    }
    if let Some(plural_with_s) = dto.plural_with_s {
        updates.push("plural_with_s = ?");
        params.push(Box::new(plural_with_s));
    }
    if let Some(consumption_verb) = dto.consumption_verb {
        updates.push("consumption_verb = ?");
        params.push(Box::new(consumption_verb));
    }
    if let Some(monthly_capacity) = dto.monthly_capacity {
        updates.push("monthly_capacity = ?");
        params.push(Box::new(monthly_capacity));
    }

    if updates.is_empty() {
        return Ok(());
    }

    params.push(Box::new(dto.collection_id));

    let query = format!(
        "UPDATE collections SET {} WHERE id = ?",
        updates.join(", ")
    );

    conn.execute(&query, rusqlite::params_from_iter(params.iter()))?;

    Ok(())
}

pub fn delete(conn: &Connection, collection_id: i64) -> Result<()> {
    conn.execute("DELETE FROM collections WHERE id = ?1", params![collection_id])?;
    Ok(())
}

/// Get all media IDs in a collection (for cleanup)
pub fn get_media_ids(conn: &Connection, collection_id: i64) -> Result<Vec<i64>> {
    let mut stmt = conn.prepare("SELECT id FROM media WHERE collection_id = ?1")?;
    let ids = stmt.query_map(params![collection_id], |row| row.get(0))?
        .collect::<Result<Vec<i64>>>()?;
    Ok(ids)
}

/// Delete collection and all its media
/// CASCADE on FK handles deleting media, media_genres, media_images, objectives
pub fn delete_with_media(conn: &Connection, collection_id: i64) -> Result<Vec<i64>> {
    let media_ids = get_media_ids(conn, collection_id)?;
    conn.execute("DELETE FROM collections WHERE id = ?1", params![collection_id])?;
    Ok(media_ids)
}

/// Delete collection and set media collection_id to NULL (unlink — media stays in "TOUS")
pub fn delete_and_unlink_media(conn: &Connection, collection_id: i64) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE media SET collection_id = NULL WHERE collection_id = ?1",
        params![collection_id],
    )?;
    tx.execute("DELETE FROM collections WHERE id = ?1", params![collection_id])?;
    tx.commit()?;
    Ok(())
}

/// Delete collection and transfer its media to another collection
pub fn delete_and_transfer_media(conn: &Connection, collection_id: i64, target_collection_id: i64) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE media SET collection_id = ?1 WHERE collection_id = ?2",
        params![target_collection_id, collection_id],
    )?;
    tx.execute("DELETE FROM collections WHERE id = ?1", params![collection_id])?;
    tx.commit()?;
    Ok(())
}

pub fn reorder(conn: &Connection, collection_ids: Vec<i64>) -> Result<()> {
    let tx = conn.unchecked_transaction()?;

    for (index, id) in collection_ids.iter().enumerate() {
        tx.execute(
            "UPDATE collections SET position = ?1 WHERE id = ?2",
            params![index as i32, id],
        )?;
    }

    tx.commit()?;
    Ok(())
}
