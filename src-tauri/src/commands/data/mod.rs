use serde::{Serialize, Deserialize};
use std::collections::HashMap;

mod storage;
mod export;
mod import;

pub use storage::*;
pub use export::*;
pub use import::*;

// ── Shared types ──

#[derive(Debug, Serialize)]
pub struct StorageInfo {
    pub db_size_bytes: u64,
    pub images_size_bytes: u64,
    pub attachments_size_bytes: u64,
    pub total_size_bytes: u64,
    pub total_media: i32,
    pub total_images: i32,
    pub total_attachments: i32,
}

#[derive(Debug, Serialize)]
pub struct DuplicateDetail {
    pub media_id: i64,
    pub media_title: String,
    pub removed_count: u32,
}

#[derive(Debug, Serialize)]
pub struct CleanupReport {
    pub removed_dirs: u32,
    pub freed_bytes: u64,
    pub removed_duplicates: u32,
    pub duplicate_details: Vec<DuplicateDetail>,
}

#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub path: String,
    pub size_bytes: u64,
    pub exported_media: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CsvExportRequest {
    pub destination_path: String,
    pub columns: Vec<String>,
    pub collection_ids: Option<Vec<i64>>,
    pub format: String,
    pub rating_scale: u8,
    pub delimiter: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CsvExportResult {
    pub path: String,
    pub exported_media: i32,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported_collections: i32,
    pub imported_media: i32,
    pub imported_images: i32,
}

#[derive(Debug, Serialize)]
pub struct CsvImportPreview {
    pub columns: Vec<String>,
    pub row_count: usize,
    pub all_rows: Vec<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct CsvImportRequest {
    pub file_path: String,
    pub column_mapping: HashMap<String, String>,
    #[serde(default)]
    pub status_mapping: HashMap<String, String>,
    pub rating_scale: u8,
    pub auto_create_collections: bool,
    pub auto_create_genres: bool,
    #[serde(default)]
    #[allow(dead_code)]
    pub date_format: Option<String>,
    #[serde(default = "default_genre_separator")]
    pub genre_separator: String,
    #[serde(default = "default_round_ratings")]
    pub round_ratings: bool,
    #[serde(default)]
    pub delimiter: Option<String>,
}

fn default_genre_separator() -> String {
    ",".to_string()
}

fn default_round_ratings() -> bool {
    true
}

#[derive(Debug, Serialize)]
pub struct CsvImportResult {
    pub imported_media: i32,
    pub created_collections: i32,
    pub created_genres: i32,
    pub errors: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct MdImportRequest {
    pub folder_path: String,
}

#[derive(Debug, Serialize)]
pub struct MdImportResult {
    pub updated_media: i32,
    pub not_found: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AppStatus {
    pub storage_missing: bool,
    pub storage_path: String,
    pub has_config: bool,
}
