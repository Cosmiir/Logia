use rusqlite::{Connection, Result, params};
use crate::models::{ExperienceEntry, ExperienceEntryInput};

pub fn get_by_media_id(conn: &Connection, media_id: i64) -> Result<Vec<ExperienceEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, media_id, date, version, language, position, created_at
         FROM experience_entries
         WHERE media_id = ?1
         ORDER BY position ASC"
    )?;

    let entries = stmt
        .query_map(params![media_id], |row| {
            Ok(ExperienceEntry {
                id: row.get(0)?,
                media_id: row.get(1)?,
                date: row.get(2)?,
                version: row.get(3)?,
                language: row.get(4)?,
                position: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(entries)
}

pub fn replace_for_media(
    conn: &Connection,
    media_id: i64,
    entries: &[ExperienceEntryInput],
) -> Result<()> {
    // Delete all existing entries for this media
    conn.execute(
        "DELETE FROM experience_entries WHERE media_id = ?1",
        params![media_id],
    )?;

    // Insert new entries
    for entry in entries {
        let version: Option<String> = entry.version.as_ref().and_then(|v| {
            let trimmed = v.trim();
            if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
        });
        let language: Option<String> = entry.language.as_ref().and_then(|l| {
            let trimmed = l.trim();
            if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
        });
        let date: Option<String> = entry.date.as_ref().and_then(|d| {
            let trimmed = d.trim();
            if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
        });

        conn.execute(
            "INSERT INTO experience_entries (media_id, date, version, language, position)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![media_id, date, version, language, entry.position],
        )?;
    }

    Ok(())
}
