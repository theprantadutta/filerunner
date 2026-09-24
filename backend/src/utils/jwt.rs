use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{AppError, Result};

/// Access token claims - short-lived, contains user info for authorization
#[derive(Debug, Serialize, Deserialize)]
pub struct AccessTokenClaims {
    pub sub: String, // User ID
    pub email: String,
    pub role: String,
    pub token_type: String, // "access"
    pub exp: i64,
    pub iat: i64,
}

/// Refresh token claims - longer-lived, minimal info, for token refresh
#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenClaims {
    pub sub: String,        // User ID
    pub jti: String,        // Unique token ID for DB lookup
    pub family_id: String,  // Token family for rotation tracking
    pub token_type: String, // "refresh"
    pub exp: i64,
    pub iat: i64,
}

impl AccessTokenClaims {
    pub fn new(user_id: Uuid, email: String, role: String, expiry_minutes: i64) -> Self {
        let now = Utc::now();
        let expires_at = now + Duration::minutes(expiry_minutes);

        AccessTokenClaims {
            sub: user_id.to_string(),
            email,
            role,
            token_type: "access".to_string(),
            iat: now.timestamp(),
            exp: expires_at.timestamp(),
        }
    }
}

impl RefreshTokenClaims {
    pub fn new(user_id: Uuid, jti: Uuid, family_id: Uuid, expiry_days: i64) -> Self {
        let now = Utc::now();
        let expires_at = now + Duration::days(expiry_days);

        RefreshTokenClaims {
            sub: user_id.to_string(),
            jti: jti.to_string(),
            family_id: family_id.to_string(),
            token_type: "refresh".to_string(),
            iat: now.timestamp(),
            exp: expires_at.timestamp(),
        }
    }
}

/// Create a short-lived access token
pub fn create_access_token(
    user_id: Uuid,
    email: String,
    role: String,
    secret: &str,
    expiry_minutes: i64,
) -> Result<String> {
    let claims = AccessTokenClaims::new(user_id, email, role, expiry_minutes);
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|e| AppError::TokenError(e.to_string()))
}

/// Create a refresh token with unique ID and family
pub fn create_refresh_token(
    user_id: Uuid,
    jti: Uuid,
    family_id: Uuid,
    secret: &str,
    expiry_days: i64,
) -> Result<String> {
    let claims = RefreshTokenClaims::new(user_id, jti, family_id, expiry_days);
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|e| AppError::TokenError(e.to_string()))
}

/// Verify access token (validates token_type = "access")
pub fn verify_access_token(token: &str, secret: &str) -> Result<AccessTokenClaims> {
    let claims = decode::<AccessTokenClaims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| AppError::TokenError(e.to_string()))?;

    if claims.token_type != "access" {
        return Err(AppError::TokenError("Invalid token type".to_string()));
    }

    Ok(claims)
}

/// Verify refresh token (validates token_type = "refresh")
pub fn verify_refresh_token(token: &str, secret: &str) -> Result<RefreshTokenClaims> {
    let claims = decode::<RefreshTokenClaims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| AppError::TokenError(e.to_string()))?;

    if claims.token_type != "refresh" {
        return Err(AppError::TokenError("Invalid token type".to_string()));
    }

    Ok(claims)
}

/// Hash a refresh token for secure database storage
pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// Download token claims - grants read access to exactly one file until it expires.
/// Lets the dashboard show private files without putting the project API key in URLs.
#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadTokenClaims {
    pub sub: String,        // File ID
    pub token_type: String, // "download"
    pub exp: i64,
    pub iat: i64,
}

/// Create a signed, expiring download token for one file
pub fn create_download_token(file_id: Uuid, secret: &str, ttl_seconds: i64) -> Result<String> {
    let now = Utc::now();
    let claims = DownloadTokenClaims {
        sub: file_id.to_string(),
        token_type: "download".to_string(),
        iat: now.timestamp(),
        exp: (now + Duration::seconds(ttl_seconds)).timestamp(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|e| AppError::TokenError(e.to_string()))
}

/// True only for an unexpired download token issued for this exact file
pub fn verify_download_token(token: &str, secret: &str, file_id: Uuid) -> bool {
    decode::<DownloadTokenClaims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map(|data| data.claims.token_type == "download" && data.claims.sub == file_id.to_string())
    .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-secret-0123456789abcdef0123456789abcdef";

    #[test]
    fn download_token_opens_only_its_own_file() {
        let file = Uuid::new_v4();
        let token = create_download_token(file, SECRET, 60).unwrap();
        assert!(verify_download_token(&token, SECRET, file));
        assert!(!verify_download_token(&token, SECRET, Uuid::new_v4()));
        assert!(!verify_download_token(
            &token,
            "another-secret-0123456789abcdef0123",
            file
        ));
    }

    #[test]
    fn expired_download_token_is_rejected() {
        let file = Uuid::new_v4();
        // Past the default 60s validation leeway
        let token = create_download_token(file, SECRET, -120).unwrap();
        assert!(!verify_download_token(&token, SECRET, file));
    }

    #[test]
    fn download_token_is_not_a_login() {
        let token = create_download_token(Uuid::new_v4(), SECRET, 60).unwrap();
        assert!(verify_access_token(&token, SECRET).is_err());
        assert!(verify_refresh_token(&token, SECRET).is_err());
    }

    #[test]
    fn access_token_is_not_a_download_token() {
        let file = Uuid::new_v4();
        let access =
            create_access_token(file, "a@b.dev".into(), "user".into(), SECRET, 15).unwrap();
        assert!(!verify_download_token(&access, SECRET, file));
    }
}
