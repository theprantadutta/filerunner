use axum::{extract::State, Json};
use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{
        AuthResponse, ChangePasswordRequest, ChangePasswordResponse, CreateUserRequest,
        LoginRequest, LogoutAllResponse, LogoutRequest, LogoutResponse, RefreshRequest,
        TokenAuthResponse, TokenRefreshResponse, User, UserInfo, UserRole,
    },
    utils::{
        create_access_token, create_refresh_token, create_token, hash_password, hash_token,
        verify_password, verify_refresh_token,
    },
    AppState,
};

/// Helper to create tokens and store refresh token in DB
async fn create_token_pair(
    pool: &PgPool,
    user: &User,
    config: &crate::config::Config,
    user_agent: Option<String>,
    ip_address: Option<String>,
) -> Result<(String, String, i64)> {
    // Create access token
    let access_token = create_access_token(
        user.id,
        user.email.clone(),
        user.role.to_string(),
        &config.jwt_secret,
        config.access_token_expiry_minutes,
    )?;

    // Create refresh token with new family
    let jti = Uuid::new_v4();
    let family_id = Uuid::new_v4();
    let refresh_token = create_refresh_token(
        user.id,
        jti,
        family_id,
        &config.jwt_secret,
        config.refresh_token_expiry_days,
    )?;

    // Hash and store refresh token
    let token_hash = hash_token(&refresh_token);
    let expires_at = Utc::now() + Duration::days(config.refresh_token_expiry_days);

    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, user_agent, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(jti)
    .bind(user.id)
    .bind(&token_hash)
    .bind(family_id)
    .bind(expires_at)
    .bind(user_agent)
    .bind(ip_address)
    .execute(pool)
    .await?;

    Ok((
        access_token,
        refresh_token,
        config.access_token_expiry_minutes * 60, // expires_in in seconds
    ))
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<TokenAuthResponse>> {
    // Validate input
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check if signup is allowed
    if !state.config.allow_signup {
        return Err(AppError::SignupDisabled);
    }

    // Hash password
    let password_hash = hash_password(&payload.password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    // Insert user (regular users don't need to change password)
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (email, password_hash, role, must_change_password)
        VALUES ($1, $2, $3, FALSE)
        RETURNING id, email, password_hash, role, created_at, must_change_password
        "#,
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(UserRole::User)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
            AppError::BadRequest("Email already exists".to_string())
        }
        _ => AppError::Database(e),
    })?;

    // Create token pair
    let (access_token, refresh_token, expires_in) =
        create_token_pair(&state.pool, &user, &state.config, None, None).await?;

    Ok(Json(TokenAuthResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in,
        user: user.into(),
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<TokenAuthResponse>> {
    // Validate input
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Get user by email
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, role, created_at, must_change_password
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(&payload.email)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::InvalidCredentials)?;

    // Verify password
    let is_valid = verify_password(&payload.password, &user.password_hash)
        .map_err(|e| AppError::InternalError(format!("Password verification failed: {}", e)))?;

    if !is_valid {
        return Err(AppError::InvalidCredentials);
    }

    // Create token pair
    let (access_token, refresh_token, expires_in) =
        create_token_pair(&state.pool, &user, &state.config, None, None).await?;

    Ok(Json(TokenAuthResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in,
        user: user.into(),
    }))
}

pub async fn refresh_token(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<TokenRefreshResponse>> {
    // Verify the refresh token JWT
    let claims = verify_refresh_token(&payload.refresh_token, &state.config.jwt_secret)?;

    // Get token hash for DB lookup
    let token_hash = hash_token(&payload.refresh_token);

    // Look up token in database
    let stored_token = sqlx::query_as::<_, crate::models::RefreshToken>(
        r#"
        SELECT id, user_id, token_hash, family_id, expires_at, created_at, revoked_at, revoked_reason, user_agent, ip_address
        FROM refresh_tokens
        WHERE token_hash = $1
        "#,
    )
    .bind(&token_hash)
    .fetch_optional(&state.pool)
    .await?;

    let stored_token = match stored_token {
        Some(t) => t,
        None => return Err(AppError::TokenError("Token not found".to_string())),
    };

    // Check if token is already revoked (potential reuse attack)
    if stored_token.revoked_at.is_some() {
        // SECURITY: Revoke all tokens in this family
        sqlx::query(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW(), revoked_reason = 'security_reuse_detected'
            WHERE family_id = $1 AND revoked_at IS NULL
            "#,
        )
        .bind(stored_token.family_id)
        .execute(&state.pool)
        .await?;

        tracing::error!(
            "SECURITY: Token reuse detected for user {} family {}",
            stored_token.user_id,
            stored_token.family_id
        );

        return Err(AppError::TokenReuseDetected);
    }

    // Check if token is expired
    if stored_token.expires_at < Utc::now() {
        return Err(AppError::RefreshTokenExpired);
    }

    // Get user for new tokens
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, role, created_at, must_change_password
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(stored_token.user_id)
    .fetch_one(&state.pool)
    .await?;

    // Revoke current token (rotation)
    sqlx::query(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), revoked_reason = 'rotation'
        WHERE id = $1
        "#,
    )
    .bind(stored_token.id)
    .execute(&state.pool)
    .await?;

    // Create new access token
    let access_token = create_access_token(
        user.id,
        user.email.clone(),
        user.role.to_string(),
        &state.config.jwt_secret,
        state.config.access_token_expiry_minutes,
    )?;

    // Create new refresh token with SAME family_id (for rotation tracking)
    let new_jti = Uuid::new_v4();
    let family_id = Uuid::parse_str(&claims.family_id)
        .map_err(|_| AppError::TokenError("Invalid family ID".to_string()))?;

    let new_refresh_token = create_refresh_token(
        user.id,
        new_jti,
        family_id,
        &state.config.jwt_secret,
        state.config.refresh_token_expiry_days,
    )?;

    // Store new refresh token
    let new_token_hash = hash_token(&new_refresh_token);
    let expires_at = Utc::now() + Duration::days(state.config.refresh_token_expiry_days);

    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, user_agent, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(new_jti)
    .bind(user.id)
    .bind(&new_token_hash)
    .bind(family_id)
    .bind(expires_at)
    .bind(&stored_token.user_agent)
    .bind(&stored_token.ip_address)
    .execute(&state.pool)
    .await?;

    Ok(Json(TokenRefreshResponse {
        access_token,
        refresh_token: new_refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.access_token_expiry_minutes * 60,
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<LogoutRequest>,
) -> Result<Json<LogoutResponse>> {
    if let Some(refresh_token) = payload.refresh_token {
        // Revoke specific token
        let token_hash = hash_token(&refresh_token);
        sqlx::query(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW(), revoked_reason = 'logout'
            WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL
            "#,
        )
        .bind(&token_hash)
        .bind(auth_user.id)
        .execute(&state.pool)
        .await?;
    }

    Ok(Json(LogoutResponse {
        message: "Logged out successfully".to_string(),
    }))
}

pub async fn logout_all(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<LogoutAllResponse>> {
    // Revoke all tokens for this user
    let result = sqlx::query(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), revoked_reason = 'logout_all'
        WHERE user_id = $1 AND revoked_at IS NULL
        "#,
    )
    .bind(auth_user.id)
    .execute(&state.pool)
    .await?;

    Ok(Json(LogoutAllResponse {
        message: "All sessions logged out".to_string(),
        revoked_count: result.rows_affected() as i64,
    }))
}

pub async fn get_current_user(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<UserInfo>> {
    // Fetch full user info from DB to get must_change_password
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, role, created_at, must_change_password
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(auth_user.id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(user.into()))
}

pub async fn change_password(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<Json<ChangePasswordResponse>> {
    // Validate input
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Get user with password hash
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, role, created_at, must_change_password
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(auth_user.id)
    .fetch_one(&state.pool)
    .await?;

    // Verify current password
    let is_valid = verify_password(&payload.current_password, &user.password_hash)
        .map_err(|e| AppError::InternalError(format!("Password verification failed: {}", e)))?;

    if !is_valid {
        return Err(AppError::BadRequest(
            "Current password is incorrect".to_string(),
        ));
    }

    // Hash new password
    let new_password_hash = hash_password(&payload.new_password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    // Update password and clear must_change_password flag
    sqlx::query(
        r#"
        UPDATE users
        SET password_hash = $1, must_change_password = FALSE
        WHERE id = $2
        "#,
    )
    .bind(&new_password_hash)
    .bind(auth_user.id)
    .execute(&state.pool)
    .await?;

    // Revoke all refresh tokens on password change (security)
    sqlx::query(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), revoked_reason = 'password_change'
        WHERE user_id = $1 AND revoked_at IS NULL
        "#,
    )
    .bind(auth_user.id)
    .execute(&state.pool)
    .await?;

    Ok(Json(ChangePasswordResponse {
        message: "Password changed successfully".to_string(),
    }))
}

// Admin function to create admin user on startup
pub async fn ensure_admin_user(pool: &PgPool, email: &str, password: &str) -> Result<()> {
    // Check if admin already exists
    let admin_exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin')")
            .fetch_one(pool)
            .await?;

    if admin_exists {
        tracing::info!("Admin user already exists");
        return Ok(());
    }

    // Create admin user with must_change_password = true
    let password_hash = hash_password(password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    sqlx::query(
        r#"
        INSERT INTO users (email, password_hash, role, must_change_password)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (email) DO UPDATE SET role = 'admin', must_change_password = TRUE
        "#,
    )
    .bind(email)
    .bind(&password_hash)
    .bind(UserRole::Admin)
    .execute(pool)
    .await?;

    tracing::info!(
        "Admin user created: {} (password change required on first login)",
        email
    );

    Ok(())
}

// ============================================================================
// Legacy endpoint for backward compatibility
// Can be removed once frontend is updated
// ============================================================================

pub async fn login_legacy(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate input
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Get user by email
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, role, created_at, must_change_password
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(&payload.email)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::InvalidCredentials)?;

    // Verify password
    let is_valid = verify_password(&payload.password, &user.password_hash)
        .map_err(|e| AppError::InternalError(format!("Password verification failed: {}", e)))?;

    if !is_valid {
        return Err(AppError::InvalidCredentials);
    }

    // Create legacy JWT token
    let token = create_token(
        user.id,
        user.email.clone(),
        user.role.to_string(),
        &state.config.jwt_secret,
    )?;

    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

pub async fn register_legacy(
    State(state): State<AppState>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate input
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check if signup is allowed
    if !state.config.allow_signup {
        return Err(AppError::SignupDisabled);
    }

    // Hash password
    let password_hash = hash_password(&payload.password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    // Insert user
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (email, password_hash, role, must_change_password)
        VALUES ($1, $2, $3, FALSE)
        RETURNING id, email, password_hash, role, created_at, must_change_password
        "#,
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(UserRole::User)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
            AppError::BadRequest("Email already exists".to_string())
        }
        _ => AppError::Database(e),
    })?;

    // Create legacy JWT token
    let token = create_token(
        user.id,
        user.email.clone(),
        user.role.to_string(),
        &state.config.jwt_secret,
    )?;

    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}
