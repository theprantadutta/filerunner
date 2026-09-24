use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, Query, State, multipart::MultipartError},
    http::{HeaderMap, HeaderValue, Method, Request, StatusCode, header},
    response::Response,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::path::{Path as FsPath, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tower::ServiceExt;
use tower_http::services::ServeFile;
use uuid::Uuid;

use crate::{
    AppState,
    error::{AppError, Result},
    middleware::{AuthUser, OptionalAuthUser},
    models::{File, FileMetadata, Folder, Project, UploadResponse},
    utils::{create_download_token, verify_download_token},
};

/// Folder paths are relative, slash-separated, and limited to safe characters
fn validate_folder_path(path: &str) -> Result<()> {
    if path.contains("..")
        || path.starts_with('/')
        || path.starts_with('\\')
        || path.contains("//")
        || path.contains("\\\\")
        || path.contains('\0')
    {
        return Err(AppError::BadRequest(
            "Invalid folder path: path traversal not allowed".to_string(),
        ));
    }
    if !path
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '/' || c == '.')
    {
        return Err(AppError::BadRequest(
            "Invalid folder path: contains invalid characters".to_string(),
        ));
    }
    if path.starts_with('.') || path.contains("/.") {
        return Err(AppError::BadRequest(
            "Invalid folder path: hidden folders not allowed".to_string(),
        ));
    }
    Ok(())
}

fn multipart_error(e: MultipartError) -> AppError {
    if e.status() == StatusCode::PAYLOAD_TOO_LARGE {
        AppError::PayloadTooLarge("File is larger than the upload limit".to_string())
    } else {
        AppError::BadRequest(format!("Invalid upload: {e}"))
    }
}

/// A file being received. Deleted on drop unless it was moved into place.
struct TempUpload {
    path: PathBuf,
    size: u64,
}

impl Drop for TempUpload {
    fn drop(&mut self) {
        // Already renamed into storage on success, so this only cleans up failures
        let _ = std::fs::remove_file(&self.path);
    }
}

/// Remove directories left empty, from `dir` up to (not including) the project's own folder
async fn remove_empty_dirs(mut dir: PathBuf, project_dir: &FsPath) {
    while dir.starts_with(project_dir) && dir != project_dir {
        // remove_dir only succeeds on empty directories, so this stops at the first one in use
        if fs::remove_dir(&dir).await.is_err() {
            break;
        }
        if !dir.pop() {
            break;
        }
    }
}

fn folder_dir(storage_path: &str, project_id: Uuid, folder_path: &str) -> (PathBuf, PathBuf) {
    let project_dir = PathBuf::from(storage_path).join(project_id.to_string());
    let mut dir = project_dir.clone();
    for segment in folder_path.split('/').filter(|s| !s.is_empty()) {
        dir.push(segment);
    }
    (dir, project_dir)
}

/// After files are deleted, drop folders that no longer hold any file, from the
/// database and from disk. Best effort: failures are logged, never returned.
pub(crate) async fn prune_empty_folders(state: &AppState, folder_ids: &[Uuid]) {
    if folder_ids.is_empty() {
        return;
    }
    let emptied = sqlx::query_as::<_, (Uuid, String)>(
        r#"
        DELETE FROM folders f
        WHERE f.id = ANY($1)
          AND NOT EXISTS (SELECT 1 FROM files WHERE folder_id = f.id)
        RETURNING f.project_id, f.path
        "#,
    )
    .bind(folder_ids)
    .fetch_all(&state.pool)
    .await;

    match emptied {
        Ok(rows) => {
            for (project_id, path) in rows {
                let (dir, project_dir) = folder_dir(&state.config.storage_path, project_id, &path);
                remove_empty_dirs(dir, &project_dir).await;
            }
        }
        Err(e) => tracing::warn!("Could not prune empty folders: {e}"),
    }
}

/// Delete a folder, every folder nested under it, and all their files, from the
/// database and from disk. Returns how many files were deleted.
pub(crate) async fn delete_folder_tree(
    state: &AppState,
    project_id: Uuid,
    folder_path: &str,
) -> Result<u64> {
    validate_folder_path(folder_path)?;
    let folder_path = folder_path.trim_end_matches('/');

    // starts_with rather than LIKE: folder names may contain "_", a LIKE wildcard
    let files = sqlx::query_as::<_, File>(
        r#"
        SELECT f.id, f.project_id, f.folder_id, f.original_name, f.stored_name, f.file_path,
               f.size, f.mime_type, f.upload_date
        FROM files f
        JOIN folders fol ON fol.id = f.folder_id
        WHERE fol.project_id = $1
          AND (fol.path = $2 OR starts_with(fol.path, $2 || '/'))
        "#,
    )
    .bind(project_id)
    .bind(folder_path)
    .fetch_all(&state.pool)
    .await?;

    for file in &files {
        if let Err(e) = fs::remove_file(&file.file_path).await
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!("Failed to delete file {}: {e}", file.file_path);
        }
    }

    let ids: Vec<Uuid> = files.iter().map(|f| f.id).collect();
    sqlx::query("DELETE FROM files WHERE id = ANY($1)")
        .bind(&ids)
        .execute(&state.pool)
        .await?;
    sqlx::query(
        "DELETE FROM folders WHERE project_id = $1 AND (path = $2 OR starts_with(path, $2 || '/'))",
    )
    .bind(project_id)
    .bind(folder_path)
    .execute(&state.pool)
    .await?;

    // Every file under this directory had a database row, so the whole tree can go
    let (dir, project_dir) = folder_dir(&state.config.storage_path, project_id, folder_path);
    if fs::try_exists(&dir).await.unwrap_or(false)
        && let Err(e) = fs::remove_dir_all(&dir).await
    {
        tracing::warn!("Failed to remove folder directory {}: {e}", dir.display());
    }
    if let Some(parent) = dir.parent() {
        remove_empty_dirs(parent.to_path_buf(), &project_dir).await;
    }

    Ok(files.len() as u64)
}

#[derive(Deserialize)]
pub struct FolderQuery {
    pub path: String,
}

/// Delete a folder and everything in it, from the dashboard (JWT, project owner)
pub async fn delete_project_folder(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(query): Query<FolderQuery>,
) -> Result<Json<serde_json::Value>> {
    let owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND user_id = $2)",
    )
    .bind(project_id)
    .bind(auth_user.id)
    .fetch_one(&state.pool)
    .await?;
    if !owned {
        return Err(AppError::NotFound("Project not found".to_string()));
    }

    let deleted_count = delete_folder_tree(&state, project_id, &query.path).await?;

    Ok(Json(serde_json::json!({
        "message": "Folder deleted",
        "deleted_count": deleted_count
    })))
}

pub async fn upload_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>> {
    // Only the full-access key can upload; the read key is download-only
    let api_key = headers
        .get("X-API-Key")
        .and_then(|h| h.to_str().ok())
        .ok_or(AppError::Unauthorized)?;
    let api_key_uuid = Uuid::parse_str(api_key).map_err(|_| AppError::Unauthorized)?;

    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, read_key, is_public, created_at FROM projects WHERE api_key = $1",
    )
    .bind(api_key_uuid)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    // Stream the file to a temporary path inside the storage volume, then move it into place.
    // Nothing is held in memory beyond one chunk, whatever the file size.
    let upload_dir = PathBuf::from(&state.config.storage_path).join(".uploads");
    fs::create_dir_all(&upload_dir)
        .await
        .map_err(|e| AppError::FileError(format!("Failed to prepare upload: {e}")))?;

    let max_size = state.config.max_file_size as u64;
    let mut upload: Option<TempUpload> = None;
    let mut file_name: Option<String> = None;
    let mut folder_path: Option<String> = None;

    while let Some(mut field) = multipart.next_field().await.map_err(multipart_error)? {
        match field.name().unwrap_or("") {
            "file" => {
                if upload.is_some() {
                    return Err(AppError::BadRequest(
                        "Send one file per upload request".to_string(),
                    ));
                }
                file_name = field.file_name().map(|s| s.to_string());

                let mut temp = TempUpload {
                    path: upload_dir.join(Uuid::new_v4().to_string()),
                    size: 0,
                };
                let mut out = fs::File::create(&temp.path)
                    .await
                    .map_err(|e| AppError::FileError(format!("Failed to create file: {e}")))?;

                while let Some(chunk) = field.chunk().await.map_err(multipart_error)? {
                    temp.size += chunk.len() as u64;
                    if temp.size > max_size {
                        return Err(AppError::PayloadTooLarge(format!(
                            "File is larger than the {max_size}-byte upload limit"
                        )));
                    }
                    out.write_all(&chunk)
                        .await
                        .map_err(|e| AppError::FileError(format!("Failed to write file: {e}")))?;
                }
                out.flush()
                    .await
                    .map_err(|e| AppError::FileError(format!("Failed to write file: {e}")))?;
                upload = Some(temp);
            }
            "folder_path" => {
                let text = field.text().await.map_err(multipart_error)?;
                if !text.is_empty() {
                    folder_path = Some(text);
                }
            }
            _ => {}
        }
    }

    let upload = upload.ok_or(AppError::BadRequest("No file provided".to_string()))?;
    let file_name = file_name.ok_or(AppError::BadRequest("No filename provided".to_string()))?;
    if let Some(ref path) = folder_path {
        validate_folder_path(path)?;
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
        // Folders are private unless made public explicitly; the project setting covers the rest
        .bind(false)
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
        format!("{file_id}.{extension}")
    };

    let mut storage_path = PathBuf::from(&state.config.storage_path);
    storage_path.push(project.id.to_string());
    if let Some(ref path) = folder_path {
        for segment in path.split('/') {
            storage_path.push(segment);
        }
    }
    fs::create_dir_all(&storage_path)
        .await
        .map_err(|e| AppError::FileError(format!("Failed to create directory: {e}")))?;
    storage_path.push(&stored_name);

    fs::rename(&upload.path, &storage_path)
        .await
        .map_err(|e| AppError::FileError(format!("Failed to store file: {e}")))?;
    let size = upload.size as i64;
    drop(upload);

    let mime_type = mime_guess::from_path(&file_name)
        .first_or_octet_stream()
        .to_string();

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
    .bind(storage_path.to_string_lossy().as_ref())
    .bind(size)
    .bind(&mime_type)
    .fetch_one(&state.pool)
    .await;

    let file_record = match file_record {
        Ok(record) => record,
        Err(e) => {
            // Don't leave an orphaned file behind when the database insert fails
            let _ = fs::remove_file(&storage_path).await;
            return Err(e.into());
        }
    };

    Ok(Json(UploadResponse {
        file_id: file_record.id,
        original_name: file_record.original_name,
        size: file_record.size,
        mime_type: file_record.mime_type,
        download_url: format!("/api/files/{}", file_record.id),
        folder_path,
    }))
}

#[derive(Deserialize)]
pub struct DownloadQuery {
    /// Project key (full or read-only). Prefer the X-API-Key header: URLs get logged.
    pub api_key: Option<String>,
    /// Signed, expiring token for this one file (issued to the project owner)
    pub token: Option<String>,
    pub download: Option<bool>,
}

/// How long signed download links stay valid
const DOWNLOAD_LINK_TTL_SECONDS: i64 = 2 * 60 * 60;

/// Served with types that browsers can execute script in (HTML, XHTML, SVG, XML). The sandbox
/// renders them as inert documents so an uploaded page can't act as this site.
const ACTIVE_CONTENT_CSP: &str = "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'";

fn is_active_content(mime_type: &str) -> bool {
    let mime = mime_type.to_ascii_lowercase();
    mime.contains("html") || mime.contains("xml") || mime.contains("svg")
}

/// RFC 6266 Content-Disposition: an ASCII fallback plus the exact UTF-8 name in `filename*`
fn content_disposition(disposition: &str, file_name: &str) -> String {
    let fallback: String = file_name
        .chars()
        .map(|c| {
            if (c.is_ascii_graphic() && c != '"' && c != '\\') || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let encoded: String = file_name
        .bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b"!#$&+-.^_`|~".contains(&b) {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect();
    format!("{disposition}; filename=\"{fallback}\"; filename*=UTF-8''{encoded}")
}

pub async fn download_file(
    State(state): State<AppState>,
    method: Method,
    headers: HeaderMap,
    Path(file_id): Path<Uuid>,
    Query(query): Query<DownloadQuery>,
) -> Result<Response> {
    let file = sqlx::query_as::<_, File>(
        "SELECT id, project_id, folder_id, original_name, stored_name, file_path, size, mime_type, upload_date FROM files WHERE id = $1"
    )
    .bind(file_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("File not found".to_string()))?;

    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, read_key, is_public, created_at FROM projects WHERE id = $1",
    )
    .bind(file.project_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    // Access is denied unless one of these grants it
    let has_valid_token = query
        .token
        .as_deref()
        .is_some_and(|t| verify_download_token(t, &state.config.jwt_secret, file.id));
    let has_key = headers
        .get("X-API-Key")
        .and_then(|h| h.to_str().ok())
        .or(query.api_key.as_deref())
        .and_then(|key| Uuid::parse_str(key).ok())
        .is_some_and(|key| key == project.api_key || key == project.read_key);

    let public_folder = if project.is_public || has_valid_token || has_key {
        false
    } else if let Some(folder_id) = file.folder_id {
        // A folder made public explicitly shares its files from a private project
        sqlx::query_scalar::<_, bool>("SELECT is_public FROM folders WHERE id = $1")
            .bind(folder_id)
            .fetch_optional(&state.pool)
            .await?
            .unwrap_or(false)
    } else {
        false
    };
    let is_public = project.is_public || public_folder;

    if !(is_public || has_valid_token || has_key) {
        return Err(AppError::Unauthorized);
    }

    // Files never change after upload, so the ID is a stable validator
    let etag = HeaderValue::from_str(&format!("\"{}\"", file.id))
        .map_err(|e| AppError::InternalError(e.to_string()))?;
    let cache_control = HeaderValue::from_static(if is_public {
        "public, max-age=86400"
    } else {
        "private, max-age=3600"
    });

    if headers
        .get(header::IF_NONE_MATCH)
        .is_some_and(|value| value == etag || value == "*")
    {
        return Response::builder()
            .status(StatusCode::NOT_MODIFIED)
            .header(header::ETAG, etag)
            .header(header::CACHE_CONTROL, cache_control)
            .body(Body::empty())
            .map_err(|e| AppError::InternalError(format!("Failed to build response: {e}")));
    }

    // ServeFile streams from disk and handles Range, If-Modified-Since and HEAD
    let mut forwarded = Request::new(Body::empty());
    *forwarded.method_mut() = method;
    *forwarded.headers_mut() = headers;
    let served = match ServeFile::new(FsPath::new(&file.file_path))
        .oneshot(forwarded)
        .await
    {
        Ok(response) => response,
        Err(never) => match never {},
    };

    if served.status() == StatusCode::NOT_FOUND {
        tracing::error!("File {} is missing on disk at {}", file.id, file.file_path);
        return Err(AppError::NotFound("File content not found".to_string()));
    }

    let (mut parts, body) = served.into_parts();
    let headers = &mut parts.headers;
    if parts.status.is_success() {
        headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_str(&file.mime_type)
                .unwrap_or(HeaderValue::from_static("application/octet-stream")),
        );
    }
    // Use "attachment" if download=true, otherwise "inline" for browser preview
    let disposition = if query.download.unwrap_or(false) {
        "attachment"
    } else {
        "inline"
    };
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&content_disposition(disposition, &file.original_name))
            .map_err(|e| AppError::InternalError(e.to_string()))?,
    );
    if is_active_content(&file.mime_type) {
        headers.insert(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(ACTIVE_CONTENT_CSP),
        );
    }
    headers.insert(header::ETAG, etag);
    headers.insert(header::CACHE_CONTROL, cache_control);

    Ok(Response::from_parts(parts, Body::new(body)))
}

#[derive(Deserialize)]
pub struct RecentQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RecentFile {
    pub id: Uuid,
    pub project_id: Uuid,
    pub project_name: String,
    pub project_is_public: bool,
    pub folder_path: Option<String>,
    pub original_name: String,
    pub size: i64,
    pub mime_type: String,
    pub upload_date: chrono::DateTime<chrono::Utc>,
    pub download_url: String,
    #[sqlx(skip)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_url: Option<String>,
}

/// Latest uploads across all of the user's projects (for the dashboard)
pub async fn recent_files(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<RecentQuery>,
) -> Result<Json<Vec<RecentFile>>> {
    let limit = query.limit.unwrap_or(12).clamp(1, 50);
    let files = sqlx::query_as::<_, RecentFile>(
        r#"
        SELECT
            f.id,
            f.project_id,
            p.name AS project_name,
            p.is_public AS project_is_public,
            fol.path AS folder_path,
            f.original_name,
            f.size,
            f.mime_type,
            f.upload_date,
            '/api/files/' || f.id::text AS download_url
        FROM files f
        JOIN projects p ON p.id = f.project_id
        LEFT JOIN folders fol ON fol.id = f.folder_id
        WHERE p.user_id = $1
        ORDER BY f.upload_date DESC
        LIMIT $2
        "#,
    )
    .bind(auth_user.id)
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;

    let files = files
        .into_iter()
        .map(|mut file| {
            if !file.project_is_public {
                let token = create_download_token(
                    file.id,
                    &state.config.jwt_secret,
                    DOWNLOAD_LINK_TTL_SECONDS,
                )?;
                file.access_url = Some(format!("{}?token={token}", file.download_url));
            }
            Ok(file)
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(Json(files))
}

pub async fn list_project_files(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<FileMetadata>>> {
    // Check if project belongs to user
    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, read_key, is_public, created_at FROM projects WHERE id = $1 AND user_id = $2"
    )
    .bind(project_id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    // Get all files with folder paths in a single query (avoid N+1)
    let files = sqlx::query_as::<_, FileMetadata>(
        r#"
        SELECT
            f.id,
            f.project_id,
            f.folder_id,
            fol.path as folder_path,
            f.original_name,
            f.size,
            f.mime_type,
            f.upload_date,
            '/api/files/' || f.id::text as download_url
        FROM files f
        LEFT JOIN folders fol ON fol.id = f.folder_id
        WHERE f.project_id = $1
        ORDER BY f.upload_date DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(&state.pool)
    .await?;

    // Private files get a short-lived signed link so the dashboard never puts the API key in URLs
    let files = if project.is_public {
        files
    } else {
        files
            .into_iter()
            .map(|mut file| {
                let token = create_download_token(
                    file.id,
                    &state.config.jwt_secret,
                    DOWNLOAD_LINK_TTL_SECONDS,
                )?;
                file.access_url = Some(format!("{}?token={token}", file.download_url));
                Ok(file)
            })
            .collect::<Result<Vec<_>>>()?
    };

    Ok(Json(files))
}

/// Delete a single file - supports both JWT and API key authentication
/// - JWT: User must own the project containing the file
/// - API Key: Must match the project's API key
pub async fn delete_file(
    State(state): State<AppState>,
    optional_auth: OptionalAuthUser,
    headers: HeaderMap,
    Path(file_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Get file first
    let file = sqlx::query_as::<_, File>(
        "SELECT id, project_id, folder_id, original_name, stored_name, file_path, size, mime_type, upload_date FROM files WHERE id = $1"
    )
    .bind(file_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("File not found".to_string()))?;

    // Get project
    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, read_key, is_public, created_at FROM projects WHERE id = $1",
    )
    .bind(file.project_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound("Project not found".to_string()))?;

    // Check authorization - either JWT (user owns project) or API key
    let authorized = if let Some(ref user) = optional_auth.0 {
        // JWT auth - check user owns the project
        project.user_id == user.id
    } else {
        // Try API key auth
        if let Some(api_key) = headers.get("X-API-Key").and_then(|h| h.to_str().ok()) {
            if let Ok(api_key_uuid) = Uuid::parse_str(api_key) {
                api_key_uuid == project.api_key
            } else {
                false
            }
        } else {
            false
        }
    };

    if !authorized {
        return Err(AppError::Unauthorized);
    }

    // Delete file from disk
    let file_path = PathBuf::from(&file.file_path);
    if file_path.exists() {
        fs::remove_file(&file_path)
            .await
            .map_err(|e| AppError::FileError(format!("Failed to delete file: {e}")))?;
    }

    // Delete from database
    sqlx::query("DELETE FROM files WHERE id = $1")
        .bind(file_id)
        .execute(&state.pool)
        .await?;

    if let Some(folder_id) = file.folder_id {
        prune_empty_folders(&state, &[folder_id]).await;
    }

    Ok(Json(serde_json::json!({
        "message": "File deleted successfully"
    })))
}

#[derive(serde::Deserialize)]
pub struct DeleteFolderFilesRequest {
    pub folder_path: String,
}

/// Delete all files in a folder using API key authentication
/// This endpoint is useful for cleanup operations from external services
pub async fn delete_folder_files(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<DeleteFolderFilesRequest>,
) -> Result<Json<serde_json::Value>> {
    // Get API key from header
    let api_key = headers
        .get("X-API-Key")
        .and_then(|h| h.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let api_key_uuid = Uuid::parse_str(api_key).map_err(|_| AppError::Unauthorized)?;

    // Get project by API key
    let project = sqlx::query_as::<_, Project>(
        "SELECT id, user_id, name, api_key, read_key, is_public, created_at FROM projects WHERE api_key = $1",
    )
    .bind(api_key_uuid)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    // Includes nested folders, so no file is left behind on disk or in the database
    let deleted_count = delete_folder_tree(&state, project.id, &payload.folder_path).await?;

    Ok(Json(serde_json::json!({
        "message": "Folder files deleted successfully",
        "deleted_count": deleted_count
    })))
}

#[derive(serde::Deserialize)]
pub struct BulkDeleteRequest {
    pub file_ids: Vec<Uuid>,
}

/// Bulk delete multiple files by their IDs
/// Supports both JWT and API key authentication:
/// - JWT: User must own the projects containing the files
/// - API Key: All files must belong to the same project, and API key must match
pub async fn bulk_delete_files(
    State(state): State<AppState>,
    optional_auth: OptionalAuthUser,
    headers: HeaderMap,
    Json(payload): Json<BulkDeleteRequest>,
) -> Result<Json<serde_json::Value>> {
    if payload.file_ids.is_empty() {
        return Ok(Json(serde_json::json!({
            "message": "No files to delete",
            "deleted_count": 0
        })));
    }

    // Get all files first (without auth filter)
    let all_files = sqlx::query_as::<_, File>(
        "SELECT id, project_id, folder_id, original_name, stored_name, file_path, size, mime_type, upload_date FROM files WHERE id = ANY($1)"
    )
    .bind(&payload.file_ids)
    .fetch_all(&state.pool)
    .await?;

    if all_files.is_empty() {
        return Err(AppError::NotFound("No files found".to_string()));
    }

    // Determine which files the user is authorized to delete
    let authorized_files: Vec<File> = if let Some(ref user) = optional_auth.0 {
        // JWT auth - get files from projects owned by user
        sqlx::query_as::<_, File>(
            r#"
            SELECT f.id, f.project_id, f.folder_id, f.original_name, f.stored_name, f.file_path, f.size, f.mime_type, f.upload_date
            FROM files f
            JOIN projects p ON f.project_id = p.id
            WHERE f.id = ANY($1) AND p.user_id = $2
            "#,
        )
        .bind(&payload.file_ids)
        .bind(user.id)
        .fetch_all(&state.pool)
        .await?
    } else {
        // Try API key auth
        let api_key = headers
            .get("X-API-Key")
            .and_then(|h| h.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let api_key_uuid = Uuid::parse_str(api_key).map_err(|_| AppError::Unauthorized)?;

        // Get project by API key
        let project = sqlx::query_as::<_, Project>(
            "SELECT id, user_id, name, api_key, read_key, is_public, created_at FROM projects WHERE api_key = $1"
        )
        .bind(api_key_uuid)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::Unauthorized)?;

        // For API key auth, all files must belong to this project
        let files_in_project: Vec<File> = all_files
            .into_iter()
            .filter(|f| f.project_id == project.id)
            .collect();

        // Check if all requested files belong to this project
        if files_in_project.len() != payload.file_ids.len() {
            return Err(AppError::BadRequest(
                "With API key auth, all files must belong to the same project".to_string(),
            ));
        }

        files_in_project
    };

    if authorized_files.is_empty() {
        return Err(AppError::NotFound(
            "No files found or you don't have permission to delete them".to_string(),
        ));
    }

    let mut deleted_count = 0;

    // Delete each file from disk
    for file in &authorized_files {
        let file_path = PathBuf::from(&file.file_path);
        if file_path.exists()
            && let Err(e) = fs::remove_file(&file_path).await
        {
            tracing::warn!("Failed to delete file {}: {}", file_path.display(), e);
        }
        deleted_count += 1;
    }

    // Delete from database
    let file_ids: Vec<Uuid> = authorized_files.iter().map(|f| f.id).collect();
    sqlx::query("DELETE FROM files WHERE id = ANY($1)")
        .bind(&file_ids)
        .execute(&state.pool)
        .await?;

    let mut folder_ids: Vec<Uuid> = authorized_files
        .iter()
        .filter_map(|f| f.folder_id)
        .collect();
    folder_ids.sort();
    folder_ids.dedup();
    prune_empty_folders(&state, &folder_ids).await;

    Ok(Json(serde_json::json!({
        "message": "Files deleted successfully",
        "deleted_count": deleted_count
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_disposition_ascii_name() {
        assert_eq!(
            content_disposition("inline", "report.pdf"),
            "inline; filename=\"report.pdf\"; filename*=UTF-8''report.pdf"
        );
    }

    #[test]
    fn content_disposition_unicode_and_quotes() {
        let header = content_disposition("attachment", "résumé \"final\".pdf");
        assert!(header.starts_with("attachment; filename=\"r_sum_ _final_.pdf\";"));
        assert!(header.ends_with("filename*=UTF-8''r%C3%A9sum%C3%A9%20%22final%22.pdf"));
        // Header values must be plain visible ASCII
        assert!(header.bytes().all(|b| (0x20..0x7f).contains(&b)));
    }

    #[test]
    fn content_disposition_strips_control_characters() {
        let header = content_disposition("inline", "a\r\nb.txt");
        assert!(!header.contains('\r') && !header.contains('\n'));
    }

    #[test]
    fn folder_paths_accept_normal_nesting() {
        for path in ["images", "images/avatars", "2026/09-report", "a.b/c_d"] {
            assert!(validate_folder_path(path).is_ok(), "{path}");
        }
    }

    #[test]
    fn folder_paths_reject_traversal_and_hidden() {
        for path in [
            "../x",
            "a/../../b",
            "/abs",
            r"\abs",
            "a//b",
            ".git",
            "a/.env",
            r"a\b",
            "a b",
            "a\0b",
        ] {
            assert!(validate_folder_path(path).is_err(), "{path:?}");
        }
    }

    #[test]
    fn active_content_detection() {
        for mime in [
            "text/html",
            "application/xhtml+xml",
            "image/svg+xml",
            "text/xml",
        ] {
            assert!(is_active_content(mime), "{mime}");
        }
        for mime in ["image/png", "application/pdf", "video/mp4", "text/plain"] {
            assert!(!is_active_content(mime), "{mime}");
        }
    }
}
