use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub icon: Option<String>,
    pub color: String,
    pub creator_label: String,
    pub date_label: String,
    pub progression_unit: String,
    pub progression_label: String,
    pub progression_short_label: Option<String>,
    pub replay_date_label: Option<String>,
    pub duration_label: Option<String>,
    pub plural_with_s: bool,
    pub consumption_verb: Option<String>,
    pub monthly_capacity: Option<i32>,
    pub position: i32,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCollectionDto {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub creator_label: Option<String>,
    pub date_label: Option<String>,
    pub progression_unit: Option<String>,
    pub progression_label: Option<String>,
    pub progression_short_label: Option<String>,
    pub replay_date_label: Option<String>,
    pub duration_label: Option<String>,
    pub plural_with_s: Option<bool>,
    pub consumption_verb: Option<String>,
    pub monthly_capacity: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCollectionDto {
    pub collection_id: i64,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub creator_label: Option<String>,
    pub date_label: Option<String>,
    pub progression_unit: Option<String>,
    pub progression_label: Option<String>,
    pub progression_short_label: Option<String>,
    pub replay_date_label: Option<String>,
    pub duration_label: Option<String>,
    pub plural_with_s: Option<bool>,
    pub consumption_verb: Option<String>,
    pub monthly_capacity: Option<i32>,
}
