use rusqlite::{Connection, Result, params};
use crate::models::Genre;

pub fn search(conn: &Connection, query: &str) -> Result<Vec<Genre>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, created_at 
         FROM genres 
         WHERE name LIKE ?1 
         ORDER BY name ASC 
         LIMIT 20"
    )?;

    let pattern = format!("{}%", query);
    let genres = stmt.query_map(params![pattern], |row| {
        Ok(Genre {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            created_at: row.get(3)?,
            position: None,
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(genres)
}

pub fn get_all(conn: &Connection) -> Result<Vec<Genre>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, created_at 
         FROM genres 
         ORDER BY name ASC"
    )?;

    let genres = stmt.query_map([], |row| {
        Ok(Genre {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            created_at: row.get(3)?,
            position: None,
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(genres)
}

pub fn insert(conn: &Connection, name: &str, color: Option<&str>) -> Result<i64> {
    let color = color.unwrap_or("#8B5CF6");
    conn.execute(
        "INSERT INTO genres (name, color) VALUES (?1, ?2)",
        params![name, color],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn update_color(conn: &Connection, genre_id: i64, color: &str) -> Result<()> {
    conn.execute(
        "UPDATE genres SET color = ?1 WHERE id = ?2",
        params![color, genre_id],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, genre_id: i64) -> Result<()> {
    // CASCADE on FK handles media_genres cleanup automatically
    conn.execute("DELETE FROM genres WHERE id = ?1", params![genre_id])?;
    Ok(())
}

pub fn get_by_media_id(conn: &Connection, media_id: i64) -> Result<Vec<Genre>> {
    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, g.color, g.created_at, mg.position
         FROM genres g
         INNER JOIN media_genres mg ON g.id = mg.genre_id
         WHERE mg.media_id = ?1
         ORDER BY mg.position ASC"
    )?;

    let genres = stmt.query_map(params![media_id], |row| {
        Ok(Genre {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            created_at: row.get(3)?,
            position: Some(row.get(4)?),
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(genres)
}

pub fn get_by_media_ids(conn: &Connection, media_ids: &[i64]) -> Result<std::collections::HashMap<i64, Vec<Genre>>> {
    if media_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    let placeholders = media_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT mg.media_id, g.id, g.name, g.color, g.created_at, mg.position
         FROM genres g
         INNER JOIN media_genres mg ON g.id = mg.genre_id
         WHERE mg.media_id IN ({})
         ORDER BY mg.media_id, mg.position ASC",
        placeholders
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(media_ids.iter()), |row| {
        Ok((
            row.get::<_, i64>(0)?,
            Genre {
                id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
                position: Some(row.get(5)?),
            },
        ))
    })?;
    let mut map: std::collections::HashMap<i64, Vec<Genre>> = std::collections::HashMap::new();
    for row in rows {
        let (media_id, genre) = row?;
        map.entry(media_id).or_default().push(genre);
    }
    Ok(map)
}

pub fn link_to_media(conn: &Connection, media_id: i64, genre_ids: &[i64]) -> Result<()> {
    conn.execute("DELETE FROM media_genres WHERE media_id = ?1", params![media_id])?;
    let mut stmt = conn.prepare(
        "INSERT INTO media_genres (media_id, genre_id, position) VALUES (?1, ?2, ?3)"
    )?;
    for (position, genre_id) in genre_ids.iter().enumerate() {
        if *genre_id > 0 {
            stmt.execute(params![media_id, genre_id, position as i32])?;
        }
    }
    Ok(())
}
