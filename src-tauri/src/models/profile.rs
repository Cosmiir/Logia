use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub avatar_id: String,
    pub custom_avatar_data_url: Option<String>,
    #[serde(default)]
    pub custom_avatars: Vec<String>,
    pub password_hash: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProfileDto {
    pub name: String,
    pub avatar_id: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProfileDto {
    pub id: String,
    pub name: Option<String>,
    pub avatar_id: Option<String>,
    pub custom_avatar_data_url: Option<String>,
    pub remove_custom_avatar: Option<String>,
    pub password: Option<String>,
    pub remove_password: Option<bool>,
}
