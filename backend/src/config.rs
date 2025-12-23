use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub server_port: u16,
    pub server_host: String,
    pub cors_origins: Vec<String>,
    pub storage_path: String,
    pub max_file_size: usize,
    pub allow_signup: bool,
    pub admin_email: String,
    pub admin_password: String,
    pub db_min_connections: u32,
    pub db_max_connections: u32,
    // Token expiry settings
    pub access_token_expiry_minutes: i64,
    pub refresh_token_expiry_days: i64,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        dotenv::dotenv().ok();

        let cors_origins_str =
            env::var("CORS_ORIGINS").unwrap_or_else(|_| "http://localhost:3000".to_string());

        let cors_origins = cors_origins_str
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        let config = Config {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8000".to_string())
                .parse()?,
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            cors_origins,
            storage_path: env::var("STORAGE_PATH").unwrap_or_else(|_| "./storage".to_string()),
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "104857600".to_string())
                .parse()?,
            allow_signup: env::var("ALLOW_SIGNUP")
                .unwrap_or_else(|_| "true".to_string())
                .parse()?,
            admin_email: env::var("ADMIN_EMAIL")
                .unwrap_or_else(|_| "admin@example.com".to_string()),
            admin_password: env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "admin".to_string()),
            db_min_connections: env::var("DB_MIN_CONNECTIONS")
                .unwrap_or_else(|_| "2".to_string())
                .parse()?,
            db_max_connections: env::var("DB_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,
            // Token expiry settings (defaults: access=15min, refresh=7days)
            access_token_expiry_minutes: env::var("ACCESS_TOKEN_EXPIRY_MINUTES")
                .unwrap_or_else(|_| "15".to_string())
                .parse()?,
            refresh_token_expiry_days: env::var("REFRESH_TOKEN_EXPIRY_DAYS")
                .unwrap_or_else(|_| "7".to_string())
                .parse()?,
        };

        Ok(config)
    }
}
