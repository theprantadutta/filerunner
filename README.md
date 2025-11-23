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
- **Frontend**: Next.js 14+ with TypeScript (Coming in Phase 2)
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

# Edit .env with your configuration (especially change passwords!)
# For local development, also create backend/.env:
cp backend/.env.example backend/.env
```

3. Start the services:
```bash
docker-compose up -d
```

4. The API will be available at `http://localhost:8000`

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

### For Docker Deployment

Create a `.env` file in the root directory:

```env
# PostgreSQL
POSTGRES_USER=filerunner
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=filerunner

# Backend
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

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
- 🚧 Phase 2: Frontend (In Progress)
- 📋 Phase 3: CLI Tool (Planned)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
