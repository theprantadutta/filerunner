use axum::{
    async_trait,
    extract::{FromRequestParts, Request, State},
    http::{header::AUTHORIZATION, request::Parts},
    middleware::Next,
    response::Response,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    models::UserRole,
    utils::{verify_access_token, verify_token},
    AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub role: UserRole,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or(AppError::Unauthorized)
    }
}

/// Optional auth user extractor - returns None instead of error if not authenticated
/// Use this for endpoints that support both JWT and API key authentication
#[derive(Debug, Clone)]
pub struct OptionalAuthUser(pub Option<AuthUser>);

#[async_trait]
impl<S> FromRequestParts<S> for OptionalAuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self> {
        Ok(OptionalAuthUser(
            parts.extensions.get::<AuthUser>().cloned(),
        ))
    }
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response> {
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(AppError::Unauthorized)?;

    // Try to verify as access token first (new dual-token system)
    let (user_id, email, role_str) =
        if let Ok(claims) = verify_access_token(token, &state.config.jwt_secret) {
            (claims.sub, claims.email, claims.role)
        } else if let Ok(claims) = verify_token(token, &state.config.jwt_secret) {
            // Fall back to legacy token verification for backward compatibility
            (claims.sub, claims.email, claims.role)
        } else {
            return Err(AppError::Unauthorized);
        };

    let user_id = Uuid::parse_str(&user_id)
        .map_err(|_| AppError::TokenError("Invalid user ID in token".to_string()))?;

    let role = match role_str.as_str() {
        "admin" => UserRole::Admin,
        "user" => UserRole::User,
        _ => return Err(AppError::TokenError("Invalid role in token".to_string())),
    };

    let auth_user = AuthUser {
        id: user_id,
        email,
        role,
    };

    request.extensions_mut().insert(auth_user);

    Ok(next.run(request).await)
}

/// Optional authentication middleware - tries to authenticate but doesn't fail if no token
/// Use this for endpoints that support both JWT and API key authentication
pub async fn optional_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    // Try to get auth header
    if let Some(auth_header) = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
    {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            // Try to verify as access token first (new dual-token system)
            let auth_result =
                if let Ok(claims) = verify_access_token(token, &state.config.jwt_secret) {
                    Some((claims.sub, claims.email, claims.role))
                } else if let Ok(claims) = verify_token(token, &state.config.jwt_secret) {
                    // Fall back to legacy token verification for backward compatibility
                    Some((claims.sub, claims.email, claims.role))
                } else {
                    None
                };

            if let Some((user_id, email, role_str)) = auth_result {
                if let Ok(user_id) = Uuid::parse_str(&user_id) {
                    let role = match role_str.as_str() {
                        "admin" => UserRole::Admin,
                        _ => UserRole::User,
                    };

                    let auth_user = AuthUser {
                        id: user_id,
                        email,
                        role,
                    };

                    request.extensions_mut().insert(auth_user);
                }
            }
        }
    }

    // Always continue to next handler, regardless of auth result
    next.run(request).await
}
