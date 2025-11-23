use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct File {
    pub id: Uuid,
    pub project_id: Uuid,
    pub folder_id: Option<Uuid>,
    pub original_name: String,
    pub stored_name: String,
    pub file_path: String,
    pub size: i64,
    pub mime_type: String,
    pub upload_date: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct FileMetadata {
    pub id: Uuid,
    pub project_id: Uuid,
    pub folder_id: Option<Uuid>,
    pub folder_path: Option<String>,
    pub original_name: String,
    pub size: i64,
    pub mime_type: String,
    pub upload_date: DateTime<Utc>,
    pub download_url: String,
}

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub file_id: Uuid,
    pub original_name: String,
    pub size: i64,
    pub mime_type: String,
    pub download_url: String,
    pub folder_path: Option<String>,
}
