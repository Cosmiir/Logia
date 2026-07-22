use rusqlite::{Connection, Result, params};
use crate::models::{Person, MediaCredit, MediaCreditInput};

pub fn get_all(conn: &Connection) -> Result<Vec<Person>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, photo_path, created_at 
         FROM people 
         ORDER BY name ASC"
    )?;

    let people = stmt.query_map([], |row| {
        Ok(Person {
            id: row.get(0)?,
            name: row.get(1)?,
            photo_path: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(people)
}

pub fn search(conn: &Connection, query: &str) -> Result<Vec<Person>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, photo_path, created_at 
         FROM people 
         WHERE name LIKE ?1 
         ORDER BY name ASC 
         LIMIT 20"
    )?;

    let pattern = format!("{}%", query);
    let people = stmt.query_map(params![pattern], |row| {
        Ok(Person {
            id: row.get(0)?,
            name: row.get(1)?,
            photo_path: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(people)
}

pub fn insert(conn: &Connection, name: &str, photo_path: Option<&str>) -> Result<i64> {
    conn.execute(
        "INSERT INTO people (name, photo_path) VALUES (?1, ?2)",
        params![name, photo_path],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, name: &str, photo_path: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE people SET name = ?1, photo_path = ?2 WHERE id = ?3",
        params![name, photo_path, id],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    // CASCADE on foreign key in sqlite handles cleanup in media_credits automatically
    conn.execute("DELETE FROM people WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_by_media_id(conn: &Connection, media_id: i64) -> Result<Vec<MediaCredit>> {
    let mut stmt = conn.prepare(
        "SELECT mc.person_id, p.name, p.photo_path, mc.role, mc.position
         FROM media_credits mc
         INNER JOIN people p ON mc.person_id = p.id
         WHERE mc.media_id = ?1
         ORDER BY mc.position ASC"
    )?;

    let credits = stmt.query_map(params![media_id], |row| {
        Ok(MediaCredit {
            person_id: row.get(0)?,
            name: row.get(1)?,
            photo_path: row.get(2)?,
            role: row.get(3)?,
            position: row.get(4)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(credits)
}

pub fn link_to_media(conn: &Connection, media_id: i64, credits: &[MediaCreditInput]) -> Result<()> {
    conn.execute("DELETE FROM media_credits WHERE media_id = ?1", params![media_id])?;
    let mut stmt = conn.prepare(
        "INSERT INTO media_credits (media_id, person_id, role, position) VALUES (?1, ?2, ?3, ?4)"
    )?;
    for (idx, credit) in credits.iter().enumerate() {
        stmt.execute(params![
            media_id,
            credit.person_id,
            credit.role,
            idx as i32 // Keep sequential ordering
        ])?;
    }
    Ok(())
}

pub fn get_unique_roles(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT role 
         FROM media_credits 
         WHERE role IS NOT NULL AND role != '' 
         ORDER BY role ASC"
    )?;

    let roles = stmt.query_map([], |row| row.get(0))?
        .collect::<Result<Vec<String>>>()?;

    Ok(roles)
}

