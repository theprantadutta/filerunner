use axum::{
    extract::{FromRequestParts, Request, State},
    http::{header::AUTHORIZATION, request::Parts},
    middleware::Next,
    response::Response,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    AppState,
    error::{AppError, Result},
    models::UserRole,
    utils::verify_access_token,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub role: UserRole,
}

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

/// Routes a user may still call while their password must be changed
const PASSWORD_CHANGE_ALLOWED: &[&str] = &[
    "/api/auth/me",
    "/api/auth/change-password",
    "/api/auth/logout",
    "/api/auth/logout-all",
];

/// Resolve a bearer access token to its user ID
fn token_user_id(token: &str, secret: &str) -> Option<Uuid> {
    let claims = verify_access_token(token, secret).ok()?;
    Uuid::parse_str(&claims.sub).ok()
}

fn bearer_token(request: &Request) -> Option<&str> {
    request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
}

/// Look up the account behind a token. Role and the password-change flag come from the
/// database, not the token, so changes (and deleted accounts) take effect immediately.
async fn load_account(state: &AppState, user_id: Uuid) -> Result<Option<(AuthUser, bool)>> {
    let row = sqlx::query_as::<_, (String, UserRole, bool)>(
        "SELECT email, role, must_change_password FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?;

    Ok(row.map(|(email, role, must_change_password)| {
        (
            AuthUser {
                id: user_id,
                email,
                role,
            },
            must_change_password,
        )
    }))
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response> {
    let token = bearer_token(&request).ok_or(AppError::Unauthorized)?;
    let user_id = token_user_id(token, &state.config.jwt_secret).ok_or(AppError::Unauthorized)?;

    let (auth_user, must_change_password) = load_account(&state, user_id)
        .await?
        .ok_or(AppError::Unauthorized)?;

    // Accounts created with a temporary password can only change it until they do
    if must_change_password && !PASSWORD_CHANGE_ALLOWED.contains(&request.uri().path()) {
        return Err(AppError::PasswordChangeRequired);
    }

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
    if let Some(user_id) =
        bearer_token(&request).and_then(|t| token_user_id(t, &state.config.jwt_secret))
        && let Ok(Some((auth_user, must_change_password))) = load_account(&state, user_id).await
        // A pending password change means the JWT grants nothing; API keys still work
        && !must_change_password
    {
        request.extensions_mut().insert(auth_user);
    }

    // Always continue to next handler, regardless of auth result
    next.run(request).await
}
