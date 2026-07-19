use rusqlite::{Connection, Result, params};
use crate::models::review_template::{ReviewTemplate, CreateReviewTemplateDto, UpdateReviewTemplateDto};

pub fn get_all(conn: &Connection) -> Result<Vec<ReviewTemplate>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, content, is_default, created_at, updated_at 
         FROM review_templates 
         ORDER BY name ASC"
    )?;

    let templates = stmt.query_map([], |row| {
        Ok(ReviewTemplate {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            content: row.get(4)?,
            is_default: row.get::<_, i64>(5)? != 0,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(templates)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<ReviewTemplate>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, content, is_default, created_at, updated_at 
         FROM review_templates 
         WHERE id = ?1"
    )?;

    let template = stmt.query_row(params![id], |row| {
        Ok(ReviewTemplate {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            content: row.get(4)?,
            is_default: row.get::<_, i64>(5)? != 0,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    });

    match template {
        Ok(t) => Ok(Some(t)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn insert(conn: &Connection, dto: &CreateReviewTemplateDto) -> Result<i64> {
    let color = dto.color.as_deref().unwrap_or("#8B5CF6");
    conn.execute(
        "INSERT INTO review_templates (name, icon, color, content, is_default) 
         VALUES (?1, ?2, ?3, ?4, 0)",
        params![&dto.name, &dto.icon, color, &dto.content],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn update(conn: &Connection, dto: &UpdateReviewTemplateDto) -> Result<bool> {
    let existing = get_by_id(conn, dto.template_id)?;
    if existing.is_none() {
        return Ok(false);
    }

    let existing = existing.unwrap();
    let name = dto.name.as_ref().unwrap_or(&existing.name);
    let icon = dto.icon.as_ref().unwrap_or(&existing.icon);
    let color = dto.color.as_ref().unwrap_or(&existing.color);
    let content = dto.content.as_ref().unwrap_or(&existing.content);

    conn.execute(
        "UPDATE review_templates 
         SET name = ?1, icon = ?2, color = ?3, content = ?4, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?5",
        params![name, icon, color, content, dto.template_id],
    )?;

    Ok(conn.changes() > 0)
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool> {
    conn.execute(
        "DELETE FROM review_templates WHERE id = ?1",
        params![id],
    )?;

    Ok(conn.changes() > 0)
}

pub fn insert_defaults(conn: &Connection) -> Result<()> {
    // Check if table already has templates (migration case)
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM review_templates",
        [],
        |row| row.get(0),
    )?;
    
    if count > 0 {
        return Ok(()); // Templates already exist, skip
    }

    let defaults = [
        (
            "Video Game",
            "gamepad-2",
            "#8B5CF6",
            vec![
                "# {title}",
                "",
                "---",
                "",
                "### Gameplay",
                "",
                "",
                "",
                "---",
                "",
                "### Graphics & Art Direction",
                "",
                "",
                "",
                "---",
                "",
                "### Difficulty & Feel",
                "",
                "",
                "",
                "---",
                "",
                "### Verdict",
                "",
                "",
            ].join("\n"),
        ),
        (
            "Movie / TV Show",
            "clapperboard",
            "#EF4444",
            vec![
                "# {title}",
                "",
                "---",
                "",
                "### Story & Plot",
                "",
                "",
                "",
                "---",
                "",
                "### Direction",
                "",
                "",
                "",
                "---",
                "",
                "### Acting",
                "",
                "",
                "",
                "---",
                "",
                "### Verdict",
                "",
                "",
            ].join("\n"),
        ),
        (
            "Manga / Comic",
            "book-open",
            "#F59E0B",
            vec![
                "# {title}",
                "",
                "---",
                "",
                "### Story & Plot",
                "",
                "",
                "",
                "---",
                "",
                "### Art & Visual Direction",
                "",
                "",
                "",
                "---",
                "",
                "### Pacing & Readability",
                "",
                "",
                "",
                "---",
                "",
                "### Verdict",
                "",
                "",
            ].join("\n"),
        ),
        (
            "Book",
            "book-marked",
            "#10B981",
            vec![
                "# {title}",
                "",
                "---",
                "",
                "### Story & World",
                "",
                "",
                "",
                "---",
                "",
                "### Writing Style",
                "",
                "",
                "",
                "---",
                "",
                "### Characters",
                "",
                "",
                "",
                "---",
                "",
                "### Verdict",
                "",
                "",
            ].join("\n"),
        ),
        (
            "Music / Album",
            "music",
            "#EC4899",
            vec![
                "# {title}",
                "",
                "---",
                "",
                "### Vibe & Musical Direction",
                "",
                "",
                "",
                "---",
                "",
                "### Standout Tracks",
                "",
                "",
                "",
                "---",
                "",
                "### Verdict",
                "",
                "",
            ].join("\n"),
        ),
    ];

    let mut stmt = conn.prepare(
        "INSERT INTO review_templates (name, icon, color, content, is_default) 
         VALUES (?1, ?2, ?3, ?4, 1)"
    )?;

    for (name, icon, color, content) in &defaults {
        stmt.execute(params![name, icon, color, content])?;
    }

    Ok(())
}
