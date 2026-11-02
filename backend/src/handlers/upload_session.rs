//! Chunked uploads: start a session, send the file as numbered chunks (in any order,
//! in parallel, retried as often as needed), then complete it.
//!
//! Every request stays far below proxy body caps (Cloudflare rejects bodies over
//! 100 MB and gives up on requests that take longer than 100 s), and a dropped
//! connection costs one chunk instead of the whole file.

use axum::{
    Json,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use http_body_util::BodyExt;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::SeekFrom;
use std::path::{Path as FsPath, PathBuf};
use tokio::fs;
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use uuid::Uuid;

use super::file::{
    TempUpload, project_for_upload_key, store_upload, upload_temp_dir, validate_folder_path,
};
use crate::{
    AppState,
    error::{AppError, Result},
    models::UploadResponse,
};

/// Bytes per chunk. Small enough to finish well inside a proxy's 100 s timeout on a slow
/// connection (about a minute at 1 Mbit/s) and cheap to resend after a dropped packet.
pub const CHUNK_SIZE: u64 = 8 * 1024 * 1024;

/// Room over CHUNK_SIZE for the request body limit on chunk routes
pub const CHUNK_BODY_LIMIT: usize = CHUNK_SIZE as usize + 64 * 1024;

/// Sessions with no chunk for this long are abandoned and deleted
const ABANDONED_AFTER_HOURS: i32 = 24;

const FILE_PREFIX: &str = "chunked-";

#[derive(Deserialize)]
pub struct StartUploadRequest {
    pub file_name: String,
    /// Total size of the file in bytes
    pub size: i64,
    pub folder_path: Option<String>,
}

#[derive(Serialize)]
pub struct UploadSessionResponse {
    pub upload_id: Uuid,
    pub chunk_size: i64,
    pub chunk_count: i32,
    /// Chunk indexes the server already has, ascending
    pub received_chunks: Vec<i32>,
}

#[derive(sqlx::FromRow)]
struct UploadSession {
    id: Uuid,
    file_name: String,
    folder_path: Option<String>,
    total_size: i64,
    chunk_size: i64,
    chunk_count: i32,
}

fn session_file(dir: &FsPath, id: Uuid) -> PathBuf {
    dir.join(format!("{FILE_PREFIX}{id}"))
}

/// How many chunks a file of `size` bytes splits into
fn chunk_count(size: u64, chunk_size: u64) -> u64 {
    size.div_ceil(chunk_size)
}

/// Exact byte length chunk `index` must have: full chunks, except a shorter last one
fn expected_chunk_len(total: u64, chunk_size: u64, index: u64) -> u64 {
    let start = index * chunk_size;
    total.saturating_sub(start).min(chunk_size)
}

/// A session belonging to the project whose key made the request. Someone else's
/// session id reads as not found, never as forbidden.
async fn find_session(state: &AppState, project_id: Uuid, id: Uuid) -> Result<UploadSession> {
    sqlx::query_as::<_, UploadSession>(
        r#"
        SELECT id, file_name, folder_path, total_size, chunk_size, chunk_count
        FROM upload_sessions
        WHERE id = $1 AND project_id = $2
        "#,
    )
    .bind(id)
    .bind(project_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Upload not found or expired".to_string()))
}

async fn received_chunks(state: &AppState, id: Uuid) -> Result<Vec<i32>> {
    Ok(sqlx::query_scalar::<_, i32>(
        "SELECT chunk_index FROM upload_chunks WHERE session_id = $1 ORDER BY chunk_index",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await?)
}

/// POST /api/uploads - start a chunked upload
pub async fn start_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<StartUploadRequest>,
) -> Result<(StatusCode, Json<UploadSessionResponse>)> {
    let project = project_for_upload_key(&state, &headers).await?;

    let file_name = request.file_name.trim().to_string();
    if file_name.is_empty() || file_name.chars().count() > 500 {
        return Err(AppError::BadRequest(
            "file_name must be 1 to 500 characters".to_string(),
        ));
    }
    if request.size < 0 {
        return Err(AppError::BadRequest(
            "size must not be negative".to_string(),
        ));
    }
    let size = request.size as u64;
    let max_size = state.config.max_file_size as u64;
    if size > max_size {
        return Err(AppError::PayloadTooLarge(format!(
            "File is larger than the {max_size}-byte upload limit"
        )));
    }
    let folder_path = request.folder_path.filter(|p| !p.is_empty());
    if let Some(ref path) = folder_path {
        validate_folder_path(path)?;
    }

    let chunks = i32::try_from(chunk_count(size, CHUNK_SIZE))
        .map_err(|_| AppError::PayloadTooLarge("File has too many chunks".to_string()))?;

    // The row first, then the file: a session file with no row is always an orphan,
    // which is what lets the pruner delete those safely.
    let id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO upload_sessions (project_id, file_name, folder_path, total_size, chunk_size, chunk_count)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
    )
    .bind(project.id)
    .bind(&file_name)
    .bind(&folder_path)
    .bind(size as i64)
    .bind(CHUNK_SIZE as i64)
    .bind(chunks)
    .fetch_one(&state.pool)
    .await?;

    let created = async {
        let path = session_file(&upload_temp_dir(&state).await?, id);
        let file = fs::File::create(&path)
            .await
            .map_err(|e| AppError::FileError(format!("Failed to prepare upload: {e}")))?;
        // Full length up front (sparse), so chunks can land at their offsets in any order
        file.set_len(size)
            .await
            .map_err(|e| AppError::FileError(format!("Failed to prepare upload: {e}")))
    }
    .await;
    if let Err(e) = created {
        let _ = sqlx::query("DELETE FROM upload_sessions WHERE id = $1")
            .bind(id)
            .execute(&state.pool)
            .await;
        return Err(e);
    }

    tracing::info!(
        "Started chunked upload {id}: {file_name} ({size} bytes, {chunks} chunks) to project {}",
        project.id
    );

    Ok((
        StatusCode::CREATED,
        Json(UploadSessionResponse {
            upload_id: id,
            chunk_size: CHUNK_SIZE as i64,
            chunk_count: chunks,
            received_chunks: Vec::new(),
        }),
    ))
}

/// GET /api/uploads/{id} - which chunks have arrived, for resuming
pub async fn upload_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<UploadSessionResponse>> {
    let project = project_for_upload_key(&state, &headers).await?;
    let session = find_session(&state, project.id, id).await?;
    Ok(Json(UploadSessionResponse {
        upload_id: session.id,
        chunk_size: session.chunk_size,
        chunk_count: session.chunk_count,
        received_chunks: received_chunks(&state, session.id).await?,
    }))
}

/// PUT /api/uploads/{id}/chunks/{index} - one chunk, as the raw request body
pub async fn upload_chunk(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, index)): Path<(Uuid, i32)>,
    body: Body,
) -> Result<StatusCode> {
    let project = project_for_upload_key(&state, &headers).await?;
    let session = find_session(&state, project.id, id).await?;

    if index < 0 || index >= session.chunk_count {
        return Err(AppError::BadRequest(format!(
            "Chunk index must be 0 to {}",
            session.chunk_count - 1
        )));
    }
    let chunk_size = session.chunk_size as u64;
    let expected = expected_chunk_len(session.total_size as u64, chunk_size, index as u64);

    // Unmark first: if this is a resend of a chunk that already arrived and it breaks off
    // halfway, the half-overwritten bytes must not still count as received.
    sqlx::query("DELETE FROM upload_chunks WHERE session_id = $1 AND chunk_index = $2")
        .bind(session.id)
        .bind(index)
        .execute(&state.pool)
        .await?;

    let path = session_file(&upload_temp_dir(&state).await?, session.id);
    let mut out = fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .await
        .map_err(|_| AppError::NotFound("Upload not found or expired".to_string()))?;
    out.seek(SeekFrom::Start(index as u64 * chunk_size))
        .await
        .map_err(|e| AppError::FileError(format!("Failed to write chunk: {e}")))?;

    // Streamed to disk; nothing beyond one network frame is held in memory
    let mut body = body;
    let mut written: u64 = 0;
    while let Some(frame) = body.frame().await {
        let frame = frame.map_err(|e| AppError::BadRequest(format!("Chunk interrupted: {e}")))?;
        if let Ok(data) = frame.into_data() {
            written += data.len() as u64;
            if written > expected {
                return Err(AppError::BadRequest(format!(
                    "Chunk {index} must be {expected} bytes"
                )));
            }
            out.write_all(&data)
                .await
                .map_err(|e| AppError::FileError(format!("Failed to write chunk: {e}")))?;
        }
    }
    if written != expected {
        return Err(AppError::BadRequest(format!(
            "Chunk {index} must be {expected} bytes, got {written}"
        )));
    }
    out.flush()
        .await
        .map_err(|e| AppError::FileError(format!("Failed to write chunk: {e}")))?;

    sqlx::query(
        "INSERT INTO upload_chunks (session_id, chunk_index) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(session.id)
    .bind(index)
    .execute(&state.pool)
    .await?;
    sqlx::query("UPDATE upload_sessions SET updated_at = NOW() WHERE id = $1")
        .bind(session.id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/uploads/{id}/complete - assemble and store the file once every chunk is in
pub async fn complete_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<UploadResponse>> {
    let project = project_for_upload_key(&state, &headers).await?;
    let session = find_session(&state, project.id, id).await?;

    let received: HashSet<i32> = received_chunks(&state, session.id)
        .await?
        .into_iter()
        .collect();
    let missing: Vec<i32> = (0..session.chunk_count)
        .filter(|i| !received.contains(i))
        .collect();
    if !missing.is_empty() {
        let shown: Vec<String> = missing.iter().take(20).map(|i| i.to_string()).collect();
        return Err(AppError::BadRequest(format!(
            "{} of {} chunks missing: {}{}",
            missing.len(),
            session.chunk_count,
            shown.join(", "),
            if missing.len() > shown.len() {
                ", ..."
            } else {
                ""
            }
        )));
    }

    // Claim the session: of two completes racing, only the one that deletes the row
    // goes on, so a file is never stored twice.
    let claimed = sqlx::query("DELETE FROM upload_sessions WHERE id = $1 AND project_id = $2")
        .bind(session.id)
        .bind(project.id)
        .execute(&state.pool)
        .await?
        .rows_affected();
    if claimed == 0 {
        return Err(AppError::NotFound(
            "Upload not found or already completed".to_string(),
        ));
    }

    // From here the temp file is deleted on any failure (TempUpload's drop)
    let upload = TempUpload {
        path: session_file(&upload_temp_dir(&state).await?, session.id),
        size: session.total_size as u64,
    };
    let on_disk = fs::metadata(&upload.path)
        .await
        .map_err(|e| AppError::FileError(format!("Upload data is missing: {e}")))?
        .len();
    if on_disk != upload.size {
        return Err(AppError::FileError(format!(
            "Upload data is {on_disk} bytes, expected {}",
            upload.size
        )));
    }

    let response = store_upload(
        &state,
        project.id,
        upload,
        session.file_name,
        session.folder_path,
    )
    .await?;

    tracing::info!(
        "Completed chunked upload {} as file {}",
        session.id,
        response.file_id
    );
    Ok(Json(response))
}

/// DELETE /api/uploads/{id} - abandon an upload and free its space
pub async fn abort_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let project = project_for_upload_key(&state, &headers).await?;
    let deleted = sqlx::query("DELETE FROM upload_sessions WHERE id = $1 AND project_id = $2")
        .bind(id)
        .bind(project.id)
        .execute(&state.pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(AppError::NotFound(
            "Upload not found or expired".to_string(),
        ));
    }

    let path = session_file(&upload_temp_dir(&state).await?, id);
    if let Err(e) = fs::remove_file(&path).await
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!("Could not remove aborted upload {}: {e}", path.display());
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Delete sessions idle for a day, and session files whose row is gone (abandoned, or
/// their project was deleted). Best effort: failures are logged, never returned.
pub async fn prune_abandoned_uploads(state: &AppState) {
    let expired = sqlx::query(
        "DELETE FROM upload_sessions WHERE updated_at < NOW() - make_interval(hours => $1)",
    )
    .bind(ABANDONED_AFTER_HOURS)
    .execute(&state.pool)
    .await;
    if let Err(e) = expired {
        tracing::warn!("Could not prune abandoned uploads: {e}");
        return;
    }

    let dir = PathBuf::from(&state.config.storage_path).join(".uploads");
    let Ok(mut entries) = fs::read_dir(&dir).await else {
        return;
    };
    // Listed before the rows are read, and rows are created before their files, so a
    // file found here without a row really has none
    let mut on_disk: Vec<(Uuid, PathBuf)> = Vec::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name();
        if let Some(id) = name
            .to_str()
            .and_then(|n| n.strip_prefix(FILE_PREFIX))
            .and_then(|id| Uuid::parse_str(id).ok())
        {
            on_disk.push((id, entry.path()));
        }
    }
    if on_disk.is_empty() {
        return;
    }

    let ids: Vec<Uuid> = on_disk.iter().map(|(id, _)| *id).collect();
    let live: HashSet<Uuid> =
        match sqlx::query_scalar::<_, Uuid>("SELECT id FROM upload_sessions WHERE id = ANY($1)")
            .bind(&ids)
            .fetch_all(&state.pool)
            .await
        {
            Ok(rows) => rows.into_iter().collect(),
            Err(e) => {
                tracing::warn!("Could not check upload sessions: {e}");
                return;
            }
        };

    let mut removed = 0;
    for (id, path) in on_disk {
        if !live.contains(&id) && fs::remove_file(&path).await.is_ok() {
            removed += 1;
        }
    }
    if removed > 0 {
        tracing::info!("Removed {removed} abandoned upload file(s)");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIB: u64 = 1024 * 1024;

    #[test]
    fn chunk_count_rounds_up() {
        assert_eq!(chunk_count(0, 8 * MIB), 0);
        assert_eq!(chunk_count(1, 8 * MIB), 1);
        assert_eq!(chunk_count(8 * MIB, 8 * MIB), 1);
        assert_eq!(chunk_count(8 * MIB + 1, 8 * MIB), 2);
        assert_eq!(chunk_count(500 * MIB, 8 * MIB), 63);
    }

    #[test]
    fn last_chunk_is_the_remainder() {
        let total = 20 * MIB + 5;
        assert_eq!(expected_chunk_len(total, 8 * MIB, 0), 8 * MIB);
        assert_eq!(expected_chunk_len(total, 8 * MIB, 1), 8 * MIB);
        assert_eq!(expected_chunk_len(total, 8 * MIB, 2), 4 * MIB + 5);
    }

    #[test]
    fn exact_multiple_has_no_short_chunk() {
        assert_eq!(expected_chunk_len(16 * MIB, 8 * MIB, 1), 8 * MIB);
    }

    #[test]
    fn chunk_body_limit_fits_a_chunk_and_stays_under_proxy_caps() {
        assert!(CHUNK_BODY_LIMIT as u64 > CHUNK_SIZE);
        // Cloudflare rejects request bodies over 100 MB
        assert!((CHUNK_BODY_LIMIT as u64) < 100 * 1000 * 1000);
    }
}
