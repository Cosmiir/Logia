use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Person {
    pub id: i64,
    pub name: String,
    pub photo_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaCredit {
    pub person_id: i64,
    pub name: String,
    pub photo_path: Option<String>,
    pub role: Option<String>,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaCreditInput {
    pub person_id: i64,
    pub role: Option<String>,
    pub position: i32,
}
