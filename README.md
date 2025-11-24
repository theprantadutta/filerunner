# FileRunner

A production-ready, self-hostable file management and CDN platform built with Rust and Next.js.

## Features

- 🔐 **Secure Authentication** - JWT-based auth with role-based access control
- 📁 **Project Management** - Organize files into projects with unique API keys
- ☁️ **File Upload/Download** - High-performance file handling with folder support
- 🌐 **CDN Capabilities** - Public/private access control for files and folders
- 🐳 **Self-Hostable** - Easy deployment with Docker
- ⚡ **High Performance** - Built with Rust for speed and reliability

## Architecture

- **Backend**: Rust with Axum framework
- **Frontend**: Next.js 15 with TypeScript
- **Database**: PostgreSQL
- **Storage**: Local filesystem (S3-compatible storage coming soon)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Rust 1.75+ (for development)
- Node.js 18+ (for frontend development)

### Running with Docker

1. Clone the repository:
```bash
git clone <repository-url>
cd filerunner
```

2. Create environment file:
```bash
# Copy the example environment file
cp .env.example .env

# ⚠️ IMPORTANT: Edit .env and change these values:
# - POSTGRES_PASSWORD
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - ADMIN_PASSWORD

# For local development, also create backend/.env:
cp backend/.env.example backend/.env
# And update the database credentials
```

**🔐 Security Note:**
- `.env` files contain secrets and are **NOT tracked in git**
- Only `.env.example` files are committed (safe templates)
- See [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for detailed instructions

3. Start the services:
```bash
docker-compose up -d
```

   **Database Setup:**
   - By default, Docker Compose creates a **new PostgreSQL database** with a persistent volume
   - The backend automatically runs migrations and creates all required tables on startup
   - An admin user is created automatically using credentials from your `.env` file

   **Using an Existing Database (Optional):**

   If you want to use an existing PostgreSQL database instead:

   Option 1 - Modify the backend service in `docker-compose.yml`:
   ```yaml
   # Update the DATABASE_URL to point to your existing database
   DATABASE_URL: postgresql://your_user:your_pass@your_host:5432/your_db
   ```

   Option 2 - Run without the Docker Postgres service:
   ```bash
   # Comment out the 'postgres' service in docker-compose.yml
   # Then update your .env file with existing database credentials
   DATABASE_URL=postgresql://user:pass@host:port/dbname
   ```

   **Note:** Migrations will run automatically on your existing database. Ensure there are no conflicting table names.

4. The services will be available at:
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8000`

### Development Setup

#### Backend

```bash
cd backend
cargo build
cargo run
```

#### Database Migrations

```bash
cd backend
sqlx migrate run
```

## API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

### Projects

#### Create Project
```http
POST /api/projects
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "My Project",
  "is_public": false
}
```

#### List Projects
```http
GET /api/projects
Authorization: Bearer <jwt_token>
```

#### Get Project
```http
GET /api/projects/:id
Authorization: Bearer <jwt_token>
```

#### Update Project
```http
PUT /api/projects/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "is_public": true
}
```

#### Delete Project
```http
DELETE /api/projects/:id
Authorization: Bearer <jwt_token>
```

#### Regenerate API Key
```http
POST /api/projects/:id/regenerate-key
Authorization: Bearer <jwt_token>
```

### Files

#### Upload File
```http
POST /api/upload
X-API-Key: <project_api_key>
Content-Type: multipart/form-data

file: <binary_file>
folder_path: hrm/avatars (optional)
```

#### Download File
```http
GET /api/files/:file_id
X-API-Key: <project_api_key> (for private files)
```

#### List Project Files
```http
GET /api/projects/:id/files
Authorization: Bearer <jwt_token>
```

#### Delete File
```http
DELETE /api/files/:file_id
Authorization: Bearer <jwt_token>
```

### Folders

#### Create Folder
```http
POST /api/folders
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "project_id": "uuid",
  "path": "hrm/forms/leave",
  "is_public": false
}
```

#### List Folders
```http
GET /api/folders?project_id=<uuid>
Authorization: Bearer <jwt_token>
```

#### Update Folder Visibility
```http
PUT /api/folders/:id/visibility
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "is_public": true
}
```

## Environment Variables

**🔐 Important:** Never commit `.env` files to git! Only `.env.example` files are tracked.

### For Docker Deployment

Create a `.env` file in the root directory:

```bash
# Copy and edit
cp .env.example .env

# Generate secure secrets
openssl rand -base64 32  # Use this for JWT_SECRET
```

**Required changes in `.env`:**
```env
# PostgreSQL
POSTGRES_PASSWORD=your_secure_password_here      # ⚠️ CHANGE THIS

# Backend
JWT_SECRET=your-random-32-char-secret            # ⚠️ CHANGE THIS
ADMIN_PASSWORD=your_admin_password               # ⚠️ CHANGE THIS
```

See [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for complete configuration guide.

### For Local Development

Create a `backend/.env` file:

```env
# PostgreSQL
POSTGRES_USER=filerunner
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=filerunner

# Database URL
DATABASE_URL=postgresql://filerunner:password@localhost:5432/filerunner

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server
SERVER_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:8000

# Storage
STORAGE_PATH=./storage
MAX_FILE_SIZE=104857600  # 100MB in bytes

# Features
ALLOW_SIGNUP=true

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin_password_change_this
```

## Database Schema

### Users
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `password_hash` (String)
- `role` (Enum: admin, user)
- `created_at` (Timestamp)

### Projects
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `name` (String)
- `api_key` (UUID, Unique)
- `is_public` (Boolean)
- `created_at` (Timestamp)

### Folders
- `id` (UUID, Primary Key)
- `project_id` (UUID, Foreign Key)
- `path` (String)
- `is_public` (Boolean)
- `created_at` (Timestamp)

### Files
- `id` (UUID, Primary Key)
- `project_id` (UUID, Foreign Key)
- `folder_id` (UUID, Foreign Key, Nullable)
- `original_name` (String)
- `stored_name` (String)
- `file_path` (String)
- `size` (BigInt)
- `mime_type` (String)
- `upload_date` (Timestamp)

## Project Status

- ✅ Phase 1: Backend Foundation (Complete)
- ✅ Phase 2: Frontend (Complete)
- 📋 Phase 3: CLI Tool (Planned)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
