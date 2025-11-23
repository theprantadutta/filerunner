use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{File, FileMetadata, Folder, Project, UploadResponse},
    AppState,
};

pub async fn upload_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>> {
    // Get API key from header
    let api_key = headers
        .get("X-API-Key")
        .and_then(|h| h.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let api_key_uuid = Uuid::parse_str(api_key)
        .map_err(|_| AppError::Unauthorized)?;

    // Get project by API key
    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, is_public, created_at FROM projects WHERE api_key = $1"
    )
    .bind(api_key_uuid)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut folder_path: Option<String> = None;

    // Parse multipart form
    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {}", e)))? {

        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                file_name = field.file_name().map(|s| s.to_string());
                file_data = Some(field.bytes().await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read file: {}", e)))?
                    .to_vec());
            }
            "folder_path" => {
                let text = field.text().await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read folder_path: {}", e)))?;
                if !text.is_empty() {
                    folder_path = Some(text);
                }
            }
            _ => {}
        }
    }

    let file_data = file_data.ok_or(AppError::BadRequest("No file provided".to_string()))?;
    let file_name = file_name.ok_or(AppError::BadRequest("No filename provided".to_string()))?;

    // Check file size
    if file_data.len() > state.config.max_file_size {
        return Err(AppError::BadRequest(format!(
            "File size exceeds maximum of {} bytes",
            state.config.max_file_size
        )));
    }

    // Get or create folder
    let folder_id = if let Some(ref path) = folder_path {
        let folder = sqlx::query_as::<_, Folder>(
            r#"
            INSERT INTO folders (project_id, path, is_public)
            VALUES ($1, $2, $3)
            ON CONFLICT (project_id, path) DO UPDATE SET path = EXCLUDED.path
            RETURNING id, project_id, path, is_public, created_at
            "#,
        )
        .bind(project.id)
        .bind(path)
        .bind(project.is_public)
        .fetch_one(&state.pool)
        .await?;

        Some(folder.id)
    } else {
        None
    };

    // Generate unique stored name
    let file_id = Uuid::new_v4();
    let extension = PathBuf::from(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    let stored_name = if extension.is_empty() {
        file_id.to_string()
    } else {
        format!("{}.{}", file_id, extension)
    };

    // Build file path
    let mut storage_path = PathBuf::from(&state.config.storage_path);
    storage_path.push(project.id.to_string());

    if let Some(ref path) = folder_path {
        for segment in path.split('/') {
            storage_path.push(segment);
        }
    }

    // Create directory if it doesn't exist
    fs::create_dir_all(&storage_path).await
        .map_err(|e| AppError::FileError(format!("Failed to create directory: {}", e)))?;

    storage_path.push(&stored_name);

    // Write file to disk
    let mut file = fs::File::create(&storage_path).await
        .map_err(|e| AppError::FileError(format!("Failed to create file: {}", e)))?;

    file.write_all(&file_data).await
        .map_err(|e| AppError::FileError(format!("Failed to write file: {}", e)))?;

    // Detect MIME type
    let mime_type = mime_guess::from_path(&file_name)
        .first_or_octet_stream()
        .to_string();

    // Save to database
    let file_record = sqlx::query_as::<_, File>(
        r#"
        INSERT INTO files (id, project_id, folder_id, original_name, stored_name, file_path, size, mime_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, project_id, folder_id, original_name, stored_name, file_path, size, mime_type, upload_date
        "#,
    )
    .bind(file_id)
    .bind(project.id)
    .bind(folder_id)
    .bind(&file_name)
    .bind(&stored_name)
    .bind(storage_path.to_str().unwrap())
    .bind(file_data.len() as i64)
    .bind(&mime_type)
    .fetch_one(&state.pool)
    .await?;

    let download_url = format!("/api/files/{}", file_record.id);

    Ok(Json(UploadResponse {
        file_id: file_record.id,
        original_name: file_record.original_name,
        size: file_record.size,
        mime_type: file_record.mime_type,
        download_url,
        folder_path,
    }))
}

pub async fn download_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(file_id): Path<Uuid>,
) -> Result<Response> {
    // Get file from database
    let file = sqlx::query_as::<_, File>(
        "SELECT id, project_id, folder_id, original_name, stored_name, file_path, size, mime_type, upload_date FROM files WHERE id = $1"
    )
    .bind(file_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("File not found".to_string()))?;

    // Get project
    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, is_public, created_at FROM projects WHERE id = $1"
    )
    .bind(file.project_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    // Check access permissions
    if !project.is_public {
        // If folder exists, check folder visibility
        if let Some(folder_id) = file.folder_id {
            let folder = sqlx::query_as::<_, Folder>(
                "SELECT id, project_id, path, is_public, created_at FROM folders WHERE id = $1"
            )
            .bind(folder_id)
            .fetch_optional(&state.pool)
            .await?;

            if let Some(folder) = folder {
                if !folder.is_public {
                    // Require API key
                    let api_key = headers
                        .get("X-API-Key")
                        .and_then(|h| h.to_str().ok())
                        .ok_or(AppError::Unauthorized)?;

                    let api_key_uuid = Uuid::parse_str(api_key)
                        .map_err(|_| AppError::Unauthorized)?;

                    if api_key_uuid != project.api_key {
                        return Err(AppError::Unauthorized);
                    }
                }
            }
        } else {
            // No folder, check project API key
            let api_key = headers
                .get("X-API-Key")
                .and_then(|h| h.to_str().ok())
                .ok_or(AppError::Unauthorized)?;

            let api_key_uuid = Uuid::parse_str(api_key)
                .map_err(|_| AppError::Unauthorized)?;

            if api_key_uuid != project.api_key {
                return Err(AppError::Unauthorized);
            }
        }
    }

    // Read file from disk
    let file_path = PathBuf::from(&file.file_path);
    let file_data = fs::read(&file_path).await
        .map_err(|e| AppError::FileError(format!("Failed to read file: {}", e)))?;

    // Build response with proper headers
    let mut response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, file.mime_type)
        .header(header::CONTENT_LENGTH, file_data.len())
        .header(
            header::CONTENT_DISPOSITION,
            format!("inline; filename=\"{}\"", file.original_name)
        )
        .body(Body::from(file_data))
        .map_err(|e| AppError::InternalError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}

pub async fn list_project_files(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<FileMetadata>>> {

    // Check if project belongs to user
    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, is_public, created_at FROM projects WHERE id = $1 AND user_id = $2"
    )
    .bind(project_id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    // Get all files for this project
    let files = sqlx::query_as::<_, File>(
        "SELECT id, project_id, folder_id, original_name, stored_name, file_path, size, mime_type, upload_date FROM files WHERE project_id = $1 ORDER BY upload_date DESC"
    )
    .bind(project_id)
    .fetch_all(&state.pool)
    .await?;

    let mut file_metadata_list = Vec::new();
    for file in files {
        let folder_path = if let Some(folder_id) = file.folder_id {
            sqlx::query_scalar::<_, String>("SELECT path FROM folders WHERE id = $1")
                .bind(folder_id)
                .fetch_optional(&state.pool)
                .await?
        } else {
            None
        };

        file_metadata_list.push(FileMetadata {
            id: file.id,
            project_id: file.project_id,
            folder_id: file.folder_id,
            folder_path,
            original_name: file.original_name,
            size: file.size,
            mime_type: file.mime_type,
            upload_date: file.upload_date,
            download_url: format!("/api/files/{}", file.id),
        });
    }

    Ok(Json(file_metadata_list))
}

pub async fn delete_file(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(file_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {

    // Get file and check ownership
    let file = sqlx::query_as::<_, File>(
        r#"
        SELECT f.id, f.project_id, f.folder_id, f.original_name, f.stored_name, f.file_path, f.size, f.mime_type, f.upload_date
        FROM files f
        JOIN projects p ON f.project_id = p.id
        WHERE f.id = $1 AND p.user_id = $2
        "#,
    )
    .bind(file_id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("File not found".to_string()))?;

    // Delete file from disk
    let file_path = PathBuf::from(&file.file_path);
    if file_path.exists() {
        fs::remove_file(&file_path).await
            .map_err(|e| AppError::FileError(format!("Failed to delete file: {}", e)))?;
    }

    // Delete from database
    sqlx::query("DELETE FROM files WHERE id = $1")
        .bind(file_id)
        .execute(&state.pool)
        .await?;

    Ok(Json(serde_json::json!({
        "message": "File deleted successfully"
    })))
}
