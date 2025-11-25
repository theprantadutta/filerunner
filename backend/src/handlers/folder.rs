use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{CreateFolderRequest, Folder, FolderResponse, Project, UpdateFolderVisibilityRequest},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListFoldersQuery {
    project_id: Uuid,
}

pub async fn create_folder(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<CreateFolderRequest>,
) -> Result<Json<Folder>> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check if project belongs to user
    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, is_public, created_at FROM projects WHERE id = $1 AND user_id = $2"
    )
    .bind(payload.project_id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    let is_public = payload.is_public.unwrap_or(project.is_public);

    let folder = sqlx::query_as::<_, Folder>(
        r#"
        INSERT INTO folders (project_id, path, is_public)
        VALUES ($1, $2, $3)
        ON CONFLICT (project_id, path) DO UPDATE SET is_public = EXCLUDED.is_public
        RETURNING id, project_id, path, is_public, created_at
        "#,
    )
    .bind(payload.project_id)
    .bind(&payload.path)
    .bind(is_public)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(folder))
}

pub async fn list_folders(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListFoldersQuery>,
) -> Result<Json<Vec<FolderResponse>>> {
    // Check if project belongs to user
    let _project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, is_public, created_at FROM projects WHERE id = $1 AND user_id = $2"
    )
    .bind(query.project_id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    let folders = sqlx::query_as::<_, Folder>(
        "SELECT id, project_id, path, is_public, created_at FROM folders WHERE project_id = $1 ORDER BY path"
    )
    .bind(query.project_id)
    .fetch_all(&state.pool)
    .await?;

    let mut folder_responses = Vec::new();
    for folder in folders {
        let stats = sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
            r#"
            SELECT COUNT(*), COALESCE(SUM(size), 0)
            FROM files
            WHERE folder_id = $1
            "#,
        )
        .bind(folder.id)
        .fetch_one(&state.pool)
        .await?;

        folder_responses.push(FolderResponse {
            id: folder.id,
            project_id: folder.project_id,
            path: folder.path,
            is_public: folder.is_public,
            created_at: folder.created_at,
            file_count: stats.0,
            total_size: stats.1,
        });
    }

    Ok(Json(folder_responses))
}

pub async fn update_folder_visibility(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(folder_id): Path<Uuid>,
    Json(payload): Json<UpdateFolderVisibilityRequest>,
) -> Result<Json<Folder>> {
    // Check if folder's project belongs to user
    let _folder = sqlx::query_as::<_, Folder>(
        r#"
        SELECT f.id, f.project_id, f.path, f.is_public, f.created_at
        FROM folders f
        JOIN projects p ON f.project_id = p.id
        WHERE f.id = $1 AND p.user_id = $2
        "#,
    )
    .bind(folder_id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Folder not found".to_string()))?;

    let updated_folder = sqlx::query_as::<_, Folder>(
        r#"
        UPDATE folders
        SET is_public = $1
        WHERE id = $2
        RETURNING id, project_id, path, is_public, created_at
        "#,
    )
    .bind(payload.is_public)
    .bind(folder_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(updated_folder))
}
