mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod utils;

use axum::http::HeaderValue;
use axum::http::{header, Method};
use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post, put},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tower_http::cors::CorsLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;
use handlers::{
    auth::{change_password, ensure_admin_user, get_current_user, login, register},
    file::{delete_file, download_file, list_project_files, upload_file},
    folder::{create_folder, list_folders, update_folder_visibility},
    project::{
        create_project, delete_project, get_project, list_projects, regenerate_api_key,
        update_project,
    },
};
use middleware::require_auth;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "filerunner_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
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

    let app_state = AppState {
        pool,
        config: Arc::new(config.clone()),
    };

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
        ]);

    // Configure rate limiting for auth endpoints (5 requests per second per IP)
    let auth_rate_limit = GovernorConfigBuilder::default()
        .per_second(5)
        .burst_size(10)
        .finish()
        .unwrap();

    // Configure rate limiting for file uploads (10 requests per minute per IP)
    let upload_rate_limit = GovernorConfigBuilder::default()
        .per_second(1)
        .burst_size(10)
        .finish()
        .unwrap();

    // Auth routes with rate limiting (public)
    let auth_routes = Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .layer(GovernorLayer {
            config: Arc::new(auth_rate_limit),
        });

    // Upload routes with rate limiting (API key based)
    let upload_routes =
        Router::new()
            .route("/api/upload", post(upload_file))
            .layer(GovernorLayer {
                config: Arc::new(upload_rate_limit),
            });

    // Build router
    let app = Router::new()
        // Merge rate-limited auth routes
        .merge(auth_routes)
        // Auth routes (protected)
        .route("/api/auth/me", get(get_current_user))
        .route("/api/auth/change-password", put(change_password))
        // Project routes (protected)
        .route("/api/projects", post(create_project))
        .route("/api/projects", get(list_projects))
        .route("/api/projects/:id", get(get_project))
        .route("/api/projects/:id", put(update_project))
        .route("/api/projects/:id", delete(delete_project))
        .route("/api/projects/:id/regenerate-key", post(regenerate_api_key))
        .route("/api/projects/:id/files", get(list_project_files))
        // Folder routes (protected)
        .route("/api/folders", post(create_folder))
        .route("/api/folders", get(list_folders))
        .route("/api/folders/:id/visibility", put(update_folder_visibility))
        // File routes (protected for some)
        .route("/api/files/:id", delete(delete_file))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            require_auth,
        ))
        // Merge rate-limited upload routes
        .merge(upload_routes)
        // File download (API key based, no rate limit needed for downloads)
        .route("/api/files/:id", get(download_file))
        // Health check
        .route("/health", get(|| async { "OK" }))
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
    tracing::info!("API documentation available at http://{}/", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
