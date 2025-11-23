use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Folder {
    pub id: Uuid,
    pub project_id: Uuid,
    pub path: String,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFolderRequest {
    pub project_id: Uuid,
    #[validate(length(min = 1, max = 500, message = "Folder path must be between 1 and 500 characters"))]
    pub path: String,
    pub is_public: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFolderVisibilityRequest {
    pub is_public: bool,
}

#[derive(Debug, Serialize)]
pub struct FolderResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub path: String,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub file_count: Option<i64>,
    pub total_size: Option<i64>,
}
