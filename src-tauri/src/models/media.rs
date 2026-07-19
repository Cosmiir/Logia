use serde::{Deserialize, Serialize};
use std::fmt::{self, Display};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum MediaStatus {
    #[serde(rename = "COMPLETED")]
    Completed,
    #[serde(rename = "ONGOING")]
    Ongoing,
    #[serde(rename = "UPCOMING")]
    Upcoming,
    #[serde(rename = "ABANDONED")]
    Abandoned,
}

impl Display for MediaStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MediaStatus::Completed => write!(f, "COMPLETED"),
            MediaStatus::Ongoing => write!(f, "ONGOING"),
            MediaStatus::Upcoming => write!(f, "UPCOMING"),
            MediaStatus::Abandoned => write!(f, "ABANDONED"),
        }
    }
}

impl FromStr for MediaStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "COMPLETED" | "FINI" | "TERMINÉ" => Ok(MediaStatus::Completed),
            "ONGOING" | "EN COURS" | "ENCOURS" => Ok(MediaStatus::Ongoing),
            "UPCOMING" | "À VOIR" | "A VOIR" | "A COMMENCER" => Ok(MediaStatus::Upcoming),
            "ABANDONED" | "ABANDONNÉ" | "ABANDONNE" => Ok(MediaStatus::Abandoned),
            _ => Err(format!("Invalid media status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum ProgressStatus {
    #[serde(rename = "NOT_STARTED")]
    NotStarted,
    #[serde(rename = "IN_PROGRESS")]
    InProgress,
    #[serde(rename = "ON_HOLD")]
    OnHold,
    #[serde(rename = "COMPLETED")]
    Completed,
    #[serde(rename = "ABANDONED")]
    Abandoned,
}

impl Display for ProgressStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProgressStatus::NotStarted => write!(f, "NOT_STARTED"),
            ProgressStatus::InProgress => write!(f, "IN_PROGRESS"),
            ProgressStatus::OnHold    => write!(f, "ON_HOLD"),
            ProgressStatus::Completed => write!(f, "COMPLETED"),
            ProgressStatus::Abandoned => write!(f, "ABANDONED"),
        }
    }
}

impl FromStr for ProgressStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "NOT_STARTED" | "\u{c0} COMMENCER" | "A COMMENCER" => Ok(ProgressStatus::NotStarted),
            "IN_PROGRESS" | "EN COURS" | "ENCOURS" => Ok(ProgressStatus::InProgress),
            "ON_HOLD" | "EN PAUSE" | "PAUSE" | "HOLD" => Ok(ProgressStatus::OnHold),
            "COMPLETED" | "FINI" | "TERMIN\u{c9}" => Ok(ProgressStatus::Completed),
            "ABANDONED" | "ABANDONN\u{c9}" | "ABANDONNE" => Ok(ProgressStatus::Abandoned),
            _ => Err(format!("Invalid progress status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Media {
    pub id: i64,
    pub collection_id: Option<i64>,
    pub title: String,
    pub creator: Option<String>,
    pub release_date: Option<String>,
    pub synopsis: Option<String>,
    pub user_rating: Option<f64>,
    pub user_review: Option<String>,
    pub progress_current: Option<f64>,
    pub progress_total: Option<f64>,
    pub progress_status: Option<String>,
    pub replay_count: Option<i32>,
    pub experience_date: Option<String>,
    pub experience_dates: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub cover_image: Option<String>,
    pub cover_source_index: Option<i64>,
    pub positive_points: Option<String>,
    pub negative_points: Option<String>,
    pub media_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaListItem {
    #[serde(flatten)]
    pub media: Media,
    pub genres: Vec<super::Genre>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaDetail {
    #[serde(flatten)]
    pub media: Media,
    pub images: Vec<MediaImage>,
    pub attachments: Vec<MediaAttachment>,
    pub genres: Vec<super::Genre>,
    pub credits: Vec<super::MediaCredit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaImage {
    pub id: i64,
    pub media_id: i64,
    pub full_path: String,
    pub thumb_path: String,
    pub position: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAttachment {
    pub id: i64,
    pub media_id: i64,
    pub original_name: String,
    pub stored_path: String,
    pub size_bytes: i64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMediaDto {
    pub collection_id: i64,
    pub title: String,
    pub creator: Option<String>,
    pub release_date: Option<String>,
    pub synopsis: Option<String>,
    pub user_rating: Option<f64>,
    pub user_review: Option<String>,
    pub progress_current: Option<f64>,
    pub progress_total: Option<f64>,
    pub progress_status: Option<String>,
    pub replay_count: Option<i32>,
    pub experience_date: Option<String>,
    pub experience_dates: Option<String>,
    pub positive_points: Option<String>,
    pub negative_points: Option<String>,
    pub media_status: Option<String>,
    pub genre_ids: Option<Vec<i64>>,
    pub credits: Option<Vec<super::MediaCreditInput>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMediaDto {
    pub media_id: i64,
    pub collection_id: Option<i64>,
    pub title: Option<String>,
    pub creator: Option<String>,
    pub release_date: Option<String>,
    pub synopsis: Option<String>,
    pub user_rating: Option<f64>,
    pub user_review: Option<String>,
    pub progress_current: Option<f64>,
    pub progress_total: Option<f64>,
    pub progress_status: Option<String>,
    pub replay_count: Option<i32>,
    pub experience_date: Option<String>,
    pub experience_dates: Option<String>,
    pub positive_points: Option<String>,
    pub negative_points: Option<String>,
    pub media_status: Option<String>,
    pub genre_ids: Option<Vec<i64>>,
    pub credits: Option<Vec<super::MediaCreditInput>>,
}
