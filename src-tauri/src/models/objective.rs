use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Objective {
    pub id: i64,
    pub collection_id: i64,
    pub target_count: i32,
    pub start_date: String,
    pub end_date: String,
    pub is_active: bool,
    pub count_abandoned: bool,
    pub current_count: i32,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateObjectiveDto {
    pub collection_id: i64,
    pub target_count: i32,
    pub start_date: String,
    pub end_date: String,
    pub count_abandoned: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateObjectiveDto {
    pub objective_id: i64,
    pub target_count: Option<i32>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub is_active: Option<bool>,
    pub count_abandoned: Option<bool>,
}
