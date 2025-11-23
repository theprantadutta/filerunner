mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod utils;

use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post, put},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;
use handlers::{
    auth::{ensure_admin_user, get_current_user, login, register},
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
    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connection established");

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

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .cors_origins
                .iter()
                .map(|origin| origin.parse().unwrap())
                .collect::<Vec<_>>(),
        )
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        // Auth routes (public)
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/me", get(get_current_user))
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
        // File upload/download (API key based)
        .route("/api/upload", post(upload_file))
        .route("/api/files/:id", get(download_file))
        // Health check
        .route("/health", get(|| async { "OK" }))
        .layer(cors)
        .with_state(app_state);

    let addr = format!("{}:{}", config.server_host, config.server_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("FileRunner backend listening on {}", addr);
    tracing::info!("API documentation available at http://{}/", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
