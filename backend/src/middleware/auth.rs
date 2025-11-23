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
    utils::verify_token,
    AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub role: UserRole,
}

impl AuthUser {
    pub fn is_admin(&self) -> bool {
        matches!(self.role, UserRole::Admin)
    }
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

    let claims = verify_token(token, &state.config.jwt_secret)?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::TokenError("Invalid user ID in token".to_string()))?;

    let role = match claims.role.as_str() {
        "admin" => UserRole::Admin,
        "user" => UserRole::User,
        _ => return Err(AppError::TokenError("Invalid role in token".to_string())),
    };

    let auth_user = AuthUser {
        id: user_id,
        email: claims.email,
        role,
    };

    request.extensions_mut().insert(auth_user);

    Ok(next.run(request).await)
}

pub async fn require_admin(
    mut request: Request,
    next: Next,
) -> Result<Response> {
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .ok_or(AppError::Unauthorized)?;

    if !auth_user.is_admin() {
        return Err(AppError::Forbidden("Admin access required".to_string()));
    }

    Ok(next.run(request).await)
}
