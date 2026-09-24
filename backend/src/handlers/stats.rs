use axum::{Json, extract::State};
use chrono::NaiveDate;
use serde::Serialize;
use sqlx::FromRow;

use crate::{AppState, error::Result, middleware::AuthUser};

#[derive(Debug, Serialize, FromRow)]
pub struct CategoryStat {
    pub category: String,
    pub files: i64,
    pub size: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DailyUploads {
    pub day: NaiveDate,
    pub files: i64,
    pub size: i64,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub total_projects: i64,
    pub total_files: i64,
    pub total_size: i64,
    pub by_category: Vec<CategoryStat>,
    /// One entry per day for the last 30 days, oldest first, including empty days
    pub daily_uploads: Vec<DailyUploads>,
}

/// Account-wide totals for the dashboard overview
pub async fn get_stats(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<StatsResponse>> {
    let (total_projects, total_files, total_size) = sqlx::query_as::<_, (i64, i64, i64)>(
        r#"
        SELECT
            (SELECT COUNT(*) FROM projects WHERE user_id = $1)::bigint,
            COUNT(f.id)::bigint,
            COALESCE(SUM(f.size), 0)::bigint
        FROM files f
        JOIN projects p ON p.id = f.project_id
        WHERE p.user_id = $1
        "#,
    )
    .bind(auth_user.id)
    .fetch_one(&state.pool)
    .await?;

    // Groups MIME types into the categories the dashboard charts use
    let by_category = sqlx::query_as::<_, CategoryStat>(
        r#"
        SELECT
            CASE
                WHEN f.mime_type LIKE 'image/%' THEN 'images'
                WHEN f.mime_type LIKE 'video/%' THEN 'video'
                WHEN f.mime_type LIKE 'audio/%' THEN 'audio'
                WHEN f.mime_type ~ '(zip|rar|tar|gzip|7z|compressed)' THEN 'archives'
                WHEN f.mime_type = 'application/pdf'
                  OR f.mime_type LIKE 'text/%'
                  OR f.mime_type ~ '(document|msword|spreadsheet|presentation|excel|powerpoint)'
                    THEN 'documents'
                WHEN f.mime_type ~ '(javascript|json|xml|html|css)' THEN 'code'
                ELSE 'other'
            END AS category,
            COUNT(*)::bigint AS files,
            COALESCE(SUM(f.size), 0)::bigint AS size
        FROM files f
        JOIN projects p ON p.id = f.project_id
        WHERE p.user_id = $1
        GROUP BY 1
        ORDER BY size DESC
        "#,
    )
    .bind(auth_user.id)
    .fetch_all(&state.pool)
    .await?;

    let daily_uploads = sqlx::query_as::<_, DailyUploads>(
        r#"
        SELECT d.day::date AS day,
               COUNT(f.id)::bigint AS files,
               COALESCE(SUM(f.size), 0)::bigint AS size
        FROM generate_series(
            (NOW() AT TIME ZONE 'UTC')::date - 29,
            (NOW() AT TIME ZONE 'UTC')::date,
            INTERVAL '1 day'
        ) AS d(day)
        LEFT JOIN files f
          ON (f.upload_date AT TIME ZONE 'UTC')::date = d.day::date
         AND f.project_id IN (SELECT id FROM projects WHERE user_id = $1)
        GROUP BY d.day
        ORDER BY d.day
        "#,
    )
    .bind(auth_user.id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(StatsResponse {
        total_projects,
        total_files,
        total_size,
        by_category,
        daily_uploads,
    }))
}
