use rusqlite::{Connection, Result, params};
use std::collections::HashMap;

/// Get all settings as a HashMap
pub fn get_all(conn: &Connection) -> Result<HashMap<String, String>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let settings = stmt
        .query_map(params![], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            Ok((key, value))
        })?
        .collect::<Result<HashMap<String, String>>>()?;
    Ok(settings)
}
