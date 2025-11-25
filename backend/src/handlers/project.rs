use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{CreateProjectRequest, Project, ProjectResponse, UpdateProjectRequest},
    AppState,
};

pub async fn create_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<Json<Project>> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let is_public = payload.is_public.unwrap_or(false);

    let project = sqlx::query_as::<_, Project>(
        r#"
        INSERT INTO projects (user_id, name, is_public)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, name, api_key, is_public, created_at
        "#,
    )
    .bind(auth_user.id)
    .bind(&payload.name)
    .bind(is_public)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(project))
}

pub async fn list_projects(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<Vec<ProjectResponse>>> {
    // Single query with LEFT JOIN to avoid N+1 problem
    let projects = sqlx::query_as::<_, ProjectResponse>(
        r#"
        SELECT
            p.id,
            p.name,
            p.api_key,
            p.is_public,
            p.created_at,
            COUNT(f.id)::bigint as file_count,
            COALESCE(SUM(f.size), 0)::bigint as total_size
        FROM projects p
        LEFT JOIN files f ON f.project_id = p.id
        WHERE p.user_id = $1
        GROUP BY p.id, p.name, p.api_key, p.is_public, p.created_at
        ORDER BY p.created_at DESC
        "#,
    )
    .bind(auth_user.id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(projects))
}

pub async fn get_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ProjectResponse>> {
    let project = sqlx::query_as::<_, Project>(
        r#"
        SELECT id, user_id, name, api_key, is_public, created_at
        FROM projects
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    let stats = sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
        r#"
        SELECT COUNT(*)::bigint, COALESCE(SUM(size), 0)::bigint
        FROM files
        WHERE project_id = $1
        "#,
    )
    .bind(project.id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(ProjectResponse {
        id: project.id,
        name: project.name,
        api_key: project.api_key,
        is_public: project.is_public,
        created_at: project.created_at,
        file_count: stats.0,
        total_size: stats.1,
    }))
}

pub async fn update_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<Project>> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check if project exists and belongs to user
    let existing = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, is_public, created_at FROM projects WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    let name = payload.name.unwrap_or(existing.name);
    let is_public = payload.is_public.unwrap_or(existing.is_public);

    let project = sqlx::query_as::<_, Project>(
        r#"
        UPDATE projects
        SET name = $1, is_public = $2
        WHERE id = $3
        RETURNING id, user_id, name, api_key, is_public, created_at
        "#,
    )
    .bind(&name)
    .bind(is_public)
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(project))
}

pub async fn delete_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM projects WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth_user.id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Project not found".to_string()));
    }

    Ok(Json(serde_json::json!({
        "message": "Project deleted successfully"
    })))
}

pub async fn regenerate_api_key(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>> {
    let project = sqlx::query_as::<_, Project>(
        r#"
        UPDATE projects
        SET api_key = gen_random_uuid()
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, name, api_key, is_public, created_at
        "#,
    )
    .bind(id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    Ok(Json(project))
}
