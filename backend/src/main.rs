mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod utils;

use axum::extract::DefaultBodyLimit;
use axum::http::HeaderValue;
use axum::http::{Method, header};
use axum::{
    Router, middleware as axum_middleware,
    routing::{delete, get, post, put},
};
use sqlx::PgPool;
use std::io::IsTerminal;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;
use handlers::{
    auth::{
        change_password, delete_account, ensure_admin_user, get_current_user, login, logout,
        logout_all, prune_expired_sessions, refresh_token, register,
    },
    file::{
        bulk_delete_files, delete_file, delete_folder_files, delete_project_folder, download_file,
        list_project_files, recent_files, upload_file,
    },
    folder::{create_folder, list_folders, update_folder_visibility},
    project::{
        create_project, delete_project, empty_project, get_project, list_projects,
        regenerate_api_key, regenerate_read_key, update_project,
    },
    stats::get_stats,
    upload_session::{
        CHUNK_BODY_LIMIT, abort_upload, complete_upload, prune_abandoned_uploads, start_upload,
        upload_chunk, upload_status,
    },
};
use middleware::rate_limit::{RateLimit, rate_limit};
use middleware::{optional_auth, require_auth};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Logging: RUST_LOG if set, otherwise app events and one line per request at info.
    // Colours only on a terminal, so `docker compose logs` stays plain text.
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,sqlx=warn,tower_http=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer().with_ansi(std::io::stdout().is_terminal()))
        .init();

    // Load configuration
    let config = Config::from_env()?;
    tracing::info!("Configuration loaded");

    // Create database pool
    let pool = db::create_pool(
        &config.database_url,
        config.db_min_connections,
        config.db_max_connections,
    )
    .await?;
    tracing::info!(
        "Database connection pool established (min: {}, max: {})",
        config.db_min_connections,
        config.db_max_connections
    );

    // Run migrations
    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Migrations completed");

    // Ensure admin user exists
    ensure_admin_user(&pool, &config.admin_email, &config.admin_password).await?;

    // Create storage directory if it doesn't exist
    tokio::fs::create_dir_all(&config.storage_path).await?;
    tracing::info!("Storage directory ready: {}", config.storage_path);

    // Drop expired sessions now and every hour after
    let prune_pool = pool.clone();
    tokio::spawn(async move {
        let mut every_hour = tokio::time::interval(std::time::Duration::from_secs(60 * 60));
        loop {
            every_hour.tick().await;
            prune_expired_sessions(&prune_pool).await;
        }
    });

    let app_state = AppState {
        pool,
        config: Arc::new(config.clone()),
    };

    // Clear out chunked uploads nobody finished, now and every hour after
    let prune_state = app_state.clone();
    tokio::spawn(async move {
        let mut every_hour = tokio::time::interval(Duration::from_secs(60 * 60));
        loop {
            every_hour.tick().await;
            prune_abandoned_uploads(&prune_state).await;
        }
    });

    // Configure CORS with specific methods and headers for security
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .cors_origins
                .iter()
                .map(|origin| origin.parse().unwrap())
                .collect::<Vec<_>>(),
        )
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::HeaderName::from_static("x-api-key"),
            header::RANGE,
        ]);

    // Rate limits are per client IP. Forwarded headers count only when the request comes
    // from a private address (Traefik, or another container), so nobody can pick their own
    // address by sending X-Forwarded-For; see middleware::client_ip.

    // Auth: bursts of 10, then one attempt every 5 seconds
    let auth_rate_limit = RateLimit::new(Duration::from_secs(5), 10, false);

    // Uploads: bursts of 30, then one per second. Services on the private network calling
    // directly (an app's backend storing files for all of its users) are not limited.
    let upload_rate_limit = RateLimit::new(Duration::from_secs(1), 30, true);

    // Forget clients with a full budget again, once a minute
    let (auth_prune, upload_prune) = (auth_rate_limit.clone(), upload_rate_limit.clone());
    tokio::spawn(async move {
        let mut every_minute = tokio::time::interval(Duration::from_secs(60));
        loop {
            every_minute.tick().await;
            auth_prune.prune();
            upload_prune.prune();
        }
    });

    // Room for the multipart envelope around a file of the maximum size
    let upload_body_limit = config.max_file_size + 1024 * 1024;

    // Auth routes with rate limiting (public - no JWT required)
    let auth_routes = Router::new()
        // New dual-token endpoints
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/refresh", post(refresh_token))
        .layer(axum_middleware::from_fn_with_state(
            auth_rate_limit,
            rate_limit,
        ));

    // Upload routes with rate limiting (API key based); body size follows MAX_FILE_SIZE.
    // Starting a chunked upload counts as one upload here; its chunks are limited below.
    let upload_routes = Router::new()
        .route("/api/upload", post(upload_file))
        .route("/api/uploads", post(start_upload))
        .route("/api/folders/delete", post(delete_folder_files))
        .layer(DefaultBodyLimit::max(upload_body_limit))
        .layer(RequestBodyLimitLayer::new(upload_body_limit))
        .layer(axum_middleware::from_fn_with_state(
            upload_rate_limit,
            rate_limit,
        ));

    // Chunks of a started upload (API key based). Not rate limited: a 500 MB file is 63
    // chunks, and each needs a session the key's own project started. One chunk per request.
    let chunk_routes = Router::new()
        .route("/api/uploads/{id}", get(upload_status).delete(abort_upload))
        .route("/api/uploads/{id}/chunks/{index}", put(upload_chunk))
        .route("/api/uploads/{id}/complete", post(complete_upload))
        .layer(DefaultBodyLimit::max(CHUNK_BODY_LIMIT))
        .layer(RequestBodyLimitLayer::new(CHUNK_BODY_LIMIT));

    // Protected routes (require authentication)
    let protected_routes = Router::new()
        // Auth routes (protected)
        .route("/api/auth/me", get(get_current_user))
        .route("/api/auth/change-password", put(change_password))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/logout-all", post(logout_all))
        .route("/api/auth/account", delete(delete_account))
        // Project routes (protected)
        .route("/api/projects", post(create_project))
        .route("/api/projects", get(list_projects))
        .route("/api/projects/{id}", get(get_project))
        .route("/api/projects/{id}", put(update_project))
        .route("/api/projects/{id}", delete(delete_project))
        .route(
            "/api/projects/{id}/regenerate-key",
            post(regenerate_api_key),
        )
        .route(
            "/api/projects/{id}/regenerate-read-key",
            post(regenerate_read_key),
        )
        .route("/api/files/recent", get(recent_files))
        .route("/api/stats", get(get_stats))
        .route("/api/projects/{id}/files", get(list_project_files))
        .route("/api/projects/{id}/empty", delete(empty_project))
        .route("/api/projects/{id}/folders", delete(delete_project_folder))
        // Folder routes (protected)
        .route("/api/folders", post(create_folder))
        .route("/api/folders", get(list_folders))
        .route(
            "/api/folders/{id}/visibility",
            put(update_folder_visibility),
        )
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ));

    // File delete routes (support both JWT and API key authentication)
    let file_delete_routes = Router::new()
        .route("/api/files/bulk", delete(bulk_delete_files))
        .route("/api/files/{id}", delete(delete_file))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            optional_auth,
        ));

    // Build router
    let app = Router::new()
        // Merge protected routes (with auth middleware)
        .merge(protected_routes)
        // Merge public auth routes (no auth required)
        .merge(auth_routes)
        // Merge rate-limited upload routes (API key based, no JWT auth)
        .merge(upload_routes)
        .merge(chunk_routes)
        // Merge file delete routes (support both JWT and API key)
        .merge(file_delete_routes)
        // File download (API key based, no rate limit needed for downloads)
        .route("/api/files/{id}", get(download_file))
        // Health check
        .route("/health", get(|| async { "OK" }))
        // One log line per request (path only, never the query string)
        .layer(axum_middleware::from_fn(middleware::access_log::access_log))
        .layer(cors)
        // Security headers
        .layer(SetResponseHeaderLayer::overriding(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("x-xss-protection"),
            HeaderValue::from_static("1; mode=block"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
        ))
        .with_state(app_state);

    let addr = format!("{}:{}", config.server_host, config.server_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("FileRunner backend listening on {}", addr);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
