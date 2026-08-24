use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiSearchResult {
    pub provider: String,
    pub provider_id: String,
    pub title: String,
    pub year: Option<String>,
    pub creator: Option<String>,
    pub thumbnail_b64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiImage {
    pub url: String,
    pub thumbnail_b64: Option<String>,
    /// Image category hint from the provider: "poster", "backdrop", etc.
    /// `None` for providers that don't distinguish image kinds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCredit {
    pub name: String,
    pub role: Option<String>,
    pub photo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMediaDetail {
    pub provider: String,
    pub provider_id: String,
    pub title: String,
    pub release_date: Option<String>,
    pub creator: Option<String>,
    pub media_status: Option<String>,
    pub synopsis: Option<String>,
    pub duration: Option<f64>,
    pub genres: Vec<String>,
    pub credits: Vec<ApiCredit>,
    pub images: Vec<ApiImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub label: String,
    pub media_type: String,
    pub needs_key: bool,
    pub key_setting: Option<String>,
    pub available: bool,
    pub doc_url: String,
}
