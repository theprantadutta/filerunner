use axum::{
    extract::State,
    Json,
};
use sqlx::PgPool;
use validator::Validate;

use crate::{
    error::{AppError, Result},
    middleware::AuthUser,
    models::{AuthResponse, CreateUserRequest, LoginRequest, User, UserInfo, UserRole},
    utils::{create_token, hash_password, verify_password},
    AppState,
};

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate input
    payload.validate()
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
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, $3)
        RETURNING id, email, password_hash, role, created_at
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
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Get user by email
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, role, created_at
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
    auth_user: AuthUser,
) -> Result<Json<UserInfo>> {
    Ok(Json(UserInfo {
        id: auth_user.id,
        email: auth_user.email,
        role: auth_user.role,
        created_at: chrono::Utc::now(), // We could fetch from DB if needed
    }))
}

// Admin function to create admin user on startup
pub async fn ensure_admin_user(pool: &PgPool, email: &str, password: &str) -> Result<()> {
    // Check if admin already exists
    let admin_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin')"
    )
    .fetch_one(pool)
    .await?;

    if admin_exists {
        tracing::info!("Admin user already exists");
        return Ok(());
    }

    // Create admin user
    let password_hash = hash_password(password)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))?;

    sqlx::query(
        r#"
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE SET role = 'admin'
        "#,
    )
    .bind(email)
    .bind(&password_hash)
    .bind(UserRole::Admin)
    .execute(pool)
    .await?;

    tracing::info!("Admin user created: {}", email);

    Ok(())
}
