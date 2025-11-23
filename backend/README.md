# FileRunner Backend

High-performance file management API built with Rust and Axum.

## Features

- JWT-based authentication with role-based access control
- Multi-project support with API keys
- Folder-based file organization
- Public/private access control
- File upload/download with streaming support
- PostgreSQL database with SQLx
- Production-ready error handling and logging
- Docker support

## Prerequisites

- Rust 1.75 or later
- PostgreSQL 14 or later
- Docker and Docker Compose (optional)

## Quick Start

### Using Docker (Recommended)

1. From the root directory, run:
```bash
docker-compose up -d
```

2. The API will be available at `http://localhost:8000`

### Local Development

1. Install PostgreSQL and create a database:
```sql
CREATE DATABASE filerunner;
```

2. Copy `.env.example` to `.env` and update the configuration:
```bash
cp .env.example .env
```

3. Install SQLx CLI:
```bash
cargo install sqlx-cli --no-default-features --features postgres
```

4. Run migrations:
```bash
sqlx migrate run
```

5. Run the application:
```bash
cargo run
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret key for JWT tokens (min 32 chars) | Required |
| `SERVER_PORT` | Server port | 8000 |
| `SERVER_HOST` | Server host | 0.0.0.0 |
| `CORS_ORIGINS` | Comma-separated CORS origins | http://localhost:3000 |
| `STORAGE_PATH` | File storage path | ./storage |
| `MAX_FILE_SIZE` | Maximum file size in bytes | 104857600 (100MB) |
| `ALLOW_SIGNUP` | Allow user registration | true |
| `ADMIN_EMAIL` | Admin user email | admin@example.com |
| `ADMIN_PASSWORD` | Admin user password | admin |
| `RUST_LOG` | Logging level | info |

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | None |
| POST | `/api/auth/login` | Login user | None |
| GET | `/api/auth/me` | Get current user | Bearer |

### Projects

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/projects` | Create project | Bearer |
| GET | `/api/projects` | List user projects | Bearer |
| GET | `/api/projects/:id` | Get project details | Bearer |
| PUT | `/api/projects/:id` | Update project | Bearer |
| DELETE | `/api/projects/:id` | Delete project | Bearer |
| POST | `/api/projects/:id/regenerate-key` | Regenerate API key | Bearer |
| GET | `/api/projects/:id/files` | List project files | Bearer |

### Files

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/upload` | Upload file | API Key |
| GET | `/api/files/:id` | Download file | API Key (if private) |
| DELETE | `/api/files/:id` | Delete file | Bearer |

### Folders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/folders` | Create folder | Bearer |
| GET | `/api/folders?project_id=<id>` | List folders | Bearer |
| PUT | `/api/folders/:id/visibility` | Update visibility | Bearer |

## Database Schema

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    api_key UUID UNIQUE NOT NULL,
    is_public BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Folders
CREATE TABLE folders (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    path VARCHAR(500) NOT NULL,
    is_public BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(project_id, path)
);

-- Files
CREATE TABLE files (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    folder_id UUID REFERENCES folders(id),
    original_name VARCHAR(500) NOT NULL,
    stored_name VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    size BIGINT NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    upload_date TIMESTAMPTZ NOT NULL
);
```

## Development

### Running Tests

```bash
cargo test
```

### Building for Production

```bash
cargo build --release
```

### Database Migrations

Create new migration:
```bash
sqlx migrate add <migration_name>
```

Run migrations:
```bash
sqlx migrate run
```

Revert last migration:
```bash
sqlx migrate revert
```

## Project Structure

```
backend/
├── src/
│   ├── main.rs              # Application entry point
│   ├── config.rs            # Configuration management
│   ├── error.rs             # Error types and handling
│   ├── models/              # Database models
│   │   ├── user.rs
│   │   ├── project.rs
│   │   ├── folder.rs
│   │   └── file.rs
│   ├── handlers/            # HTTP request handlers
│   │   ├── auth.rs
│   │   ├── project.rs
│   │   ├── file.rs
│   │   └── folder.rs
│   ├── middleware/          # Middleware (auth, etc.)
│   │   └── auth.rs
│   ├── db/                  # Database utilities
│   │   └── pool.rs
│   └── utils/               # Utility functions
│       ├── jwt.rs
│       └── password.rs
├── migrations/              # SQL migrations
└── Dockerfile              # Docker build configuration
```

## Security Considerations

1. **JWT Secret**: Use a strong, random secret key in production (minimum 32 characters)
2. **Password Hashing**: Passwords are hashed using Argon2
3. **SQL Injection**: All queries use parameterized statements
4. **CORS**: Configure allowed origins appropriately
5. **File Upload**: Validate file sizes and types
6. **API Keys**: Treated as secrets, regenerate if compromised

## Troubleshooting

### Database Connection Error

Ensure PostgreSQL is running and the `DATABASE_URL` is correct:
```bash
psql $DATABASE_URL
```

### Port Already in Use

Change the `SERVER_PORT` in your `.env` file or stop the process using port 8000.

### Migration Errors

Reset the database (⚠️ WARNING: This will delete all data):
```bash
sqlx database drop
sqlx database create
sqlx migrate run
```

## License

MIT
