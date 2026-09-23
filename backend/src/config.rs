use serde::Deserialize;
use std::env;

/// Minimum length for the HMAC secret that signs every token
const MIN_JWT_SECRET_LEN: usize = 32;

/// Minimum length for the initial admin password
pub const MIN_ADMIN_PASSWORD_LEN: usize = 12;

/// Fragments of the example secrets used in this repository's docs and env files.
/// Anyone can read those, so a secret containing one must never sign tokens.
const PLACEHOLDER_SECRET_MARKERS: &[&str] = &[
    "your-super-secret",
    "your-random-secret",
    "your-secret",
    "change-this",
    "change_this",
    "change-me",
    "change_me",
    "changeme",
    "min-32",
];

/// Passwords shipped as defaults or suggested in docs at some point
const PLACEHOLDER_PASSWORDS: &[&str] = &["admin", "admin123", "password"];

/// Fragments of placeholder passwords from docs ("your_admin_password", "change_on_first_login", ...)
const PLACEHOLDER_PASSWORD_MARKERS: &[&str] = &[
    "change_on_first_login",
    "change_this",
    "change_me",
    "changeme",
    "your_admin_password",
];

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
        dotenvy::dotenv().ok();

        let cors_origins_str =
            env::var("CORS_ORIGINS").unwrap_or_else(|_| "http://localhost:3000".to_string());

        let cors_origins = cors_origins_str
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        let jwt_secret = env::var("JWT_SECRET").unwrap_or_default();
        validate_jwt_secret(&jwt_secret)?;

        let config = Config {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            jwt_secret,
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8000".to_string())
                .parse()?,
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            cors_origins,
            storage_path: env::var("STORAGE_PATH").unwrap_or_else(|_| "./storage".to_string()),
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "524288000".to_string()) // 500MB default
                .parse()?,
            // Closed by default: an open instance is free public file hosting for anyone
            allow_signup: env::var("ALLOW_SIGNUP")
                .unwrap_or_else(|_| "false".to_string())
                .parse()?,
            admin_email: env::var("ADMIN_EMAIL")
                .unwrap_or_else(|_| "admin@example.com".to_string()),
            // Only used when the first admin is created; validated at that point
            admin_password: env::var("ADMIN_PASSWORD").unwrap_or_default(),
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

/// Refuse to sign tokens with a missing, short, or publicly known secret
pub fn validate_jwt_secret(secret: &str) -> Result<(), String> {
    if secret.trim().is_empty() {
        return Err(
            "JWT_SECRET is not set. Generate one with `openssl rand -hex 32` and set it in .env"
                .to_string(),
        );
    }
    let lowered = secret.to_ascii_lowercase();
    if PLACEHOLDER_SECRET_MARKERS
        .iter()
        .any(|marker| lowered.contains(marker))
    {
        return Err(
            "JWT_SECRET is still the example value, which anyone can read in this repository. \
             Generate a new one with `openssl rand -hex 32`"
                .to_string(),
        );
    }
    if secret.len() < MIN_JWT_SECRET_LEN {
        return Err(format!(
            "JWT_SECRET must be at least {MIN_JWT_SECRET_LEN} characters (it is {}). \
             Generate one with `openssl rand -hex 32`",
            secret.len()
        ));
    }
    Ok(())
}

/// Refuse to create the first admin account with a guessable password
pub fn validate_admin_password(password: &str) -> Result<(), String> {
    if password.is_empty() {
        return Err(
            "ADMIN_PASSWORD is not set. It is required to create the first admin account"
                .to_string(),
        );
    }
    let lowered = password.to_ascii_lowercase();
    if PLACEHOLDER_PASSWORDS.iter().any(|p| lowered == *p)
        || PLACEHOLDER_PASSWORD_MARKERS
            .iter()
            .any(|marker| lowered.contains(marker))
    {
        return Err("ADMIN_PASSWORD is a default value. Choose a unique password".to_string());
    }
    if password.chars().count() < MIN_ADMIN_PASSWORD_LEN {
        return Err(format!(
            "ADMIN_PASSWORD must be at least {MIN_ADMIN_PASSWORD_LEN} characters"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jwt_secret_rejects_missing_placeholder_and_short() {
        assert!(validate_jwt_secret("").is_err());
        assert!(validate_jwt_secret("   ").is_err());
        assert!(
            validate_jwt_secret("your-super-secret-jwt-key-change-this-in-production-min-32-chars")
                .is_err()
        );
        assert!(validate_jwt_secret("too-short").is_err());
        // Doc placeholders that are long enough to pass the length check
        assert!(validate_jwt_secret("your-super-secret-jwt-key-min-32-characters").is_err());
        assert!(
            validate_jwt_secret("your-random-secret-min-32-chars-use-pwgen-or-openssl").is_err()
        );
    }

    #[test]
    fn jwt_secret_accepts_random_value() {
        assert!(validate_jwt_secret(&"a1".repeat(32)).is_ok());
    }

    #[test]
    fn admin_password_rules() {
        assert!(validate_admin_password("").is_err());
        assert!(validate_admin_password("admin").is_err());
        assert!(validate_admin_password("ADMIN").is_err());
        assert!(validate_admin_password("short-pw").is_err());
        assert!(validate_admin_password("admin123").is_err());
        assert!(validate_admin_password("your_admin_password_here").is_err());
        assert!(validate_admin_password("change_this_admin_password_immediately").is_err());
        assert!(validate_admin_password("a-long-unique-passphrase").is_ok());
    }
}
