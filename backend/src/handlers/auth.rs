use axum::{extract::State, Json};
use sqlx::PgPool;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{
        AuthResponse, ChangePasswordRequest, ChangePasswordResponse, CreateUserRequest,
        LoginRequest, User, UserInfo, UserRole,
    },
    utils::{create_token, hash_password, verify_password},
    AppState,
};

pub async fn register(
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

    // Create JWT token
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

pub async fn login(
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

    // Create JWT token
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
