use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceEntry {
    pub id: i64,
    pub media_id: i64,
    pub date: Option<String>,
    pub version: Option<String>,
    pub language: Option<String>,
    pub position: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExperienceEntryInput {
    pub date: Option<String>,
    pub version: Option<String>,
    pub language: Option<String>,
    pub position: i32,
}
