use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, Result};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // User ID
    pub email: String,
    pub role: String,
    pub exp: i64,
    pub iat: i64,
}

impl Claims {
    pub fn new(user_id: Uuid, email: String, role: String) -> Self {
        let now = Utc::now();
        let expires_at = now + Duration::days(7);

        Claims {
            sub: user_id.to_string(),
            email,
            role,
            iat: now.timestamp(),
            exp: expires_at.timestamp(),
        }
    }
}

pub fn create_token(user_id: Uuid, email: String, role: String, secret: &str) -> Result<String> {
    let claims = Claims::new(user_id, email, role);
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|e| AppError::TokenError(e.to_string()))
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| AppError::TokenError(e.to_string()))
}
