use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
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

/// Legacy claims for backward compatibility during migration
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub role: String,
    #[serde(default)]
    pub token_type: Option<String>,
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

// ============================================================================
// Legacy functions for backward compatibility during migration period
// These can be removed once all clients have updated to dual-token system
// ============================================================================

impl Claims {
    pub fn new(user_id: Uuid, email: String, role: String) -> Self {
        let now = Utc::now();
        let expires_at = now + Duration::days(7);

        Claims {
            sub: user_id.to_string(),
            email,
            role,
            token_type: Some("legacy".to_string()),
            iat: now.timestamp(),
            exp: expires_at.timestamp(),
        }
    }
}

/// Legacy: Create a single token (7-day expiry) - for backward compatibility
pub fn create_token(user_id: Uuid, email: String, role: String, secret: &str) -> Result<String> {
    let claims = Claims::new(user_id, email, role);
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|e| AppError::TokenError(e.to_string()))
}

/// Legacy: Verify any token type (access, refresh, or legacy)
pub fn verify_token(token: &str, secret: &str) -> Result<Claims> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| AppError::TokenError(e.to_string()))
}
