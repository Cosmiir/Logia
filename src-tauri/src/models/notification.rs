use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: i64,
    pub profile_id: String,
    #[serde(rename = "type")]
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub data: Option<String>,
    pub is_read: bool,
    pub created_at: String,
    pub related_entity_type: Option<String>,
    pub related_entity_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNotificationDto {
    pub profile_id: String,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub data: Option<String>,
    pub related_entity_type: Option<String>,
    pub related_entity_id: Option<i64>,
}
