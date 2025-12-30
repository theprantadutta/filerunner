# FileRunner

A production-ready, self-hostable file management and CDN platform built with Rust and Next.js.

## Features

- **Secure Authentication** - JWT-based auth with dual-token system (access + refresh tokens)
- **Project Management** - Organize files into projects with unique API keys
- **File Upload/Download** - High-performance file handling with folder support
- **CDN Capabilities** - Public/private access control for files and folders
- **Self-Hostable** - Easy deployment with Docker
- **High Performance** - Built with Rust for speed and reliability

## Architecture

- **Backend**: Rust with Axum framework
- **Frontend**: Next.js 15 with TypeScript
- **Database**: PostgreSQL
- **Storage**: Local filesystem (S3-compatible storage coming soon)

## Quick Start

### Option 1: Quick Deploy (Recommended)

Create a `docker-compose.yml` file on your server:

**With included PostgreSQL database:**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: filerunner
      POSTGRES_PASSWORD: your_secure_password_here
      POSTGRES_DB: filerunner
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U filerunner"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: theprantadutta/filerunner-backend:latest
    environment:
      DATABASE_URL: postgresql://filerunner:your_secure_password_here@postgres:5432/filerunner
      JWT_SECRET: your-super-secret-jwt-key-min-32-characters
      CORS_ORIGINS: http://localhost
      ADMIN_EMAIL: admin@example.com
      ADMIN_PASSWORD: admin123
    ports:
      - "8000:8000"
    volumes:
      - file_storage:/app/storage
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    image: theprantadutta/filerunner-frontend:latest
    environment:
      API_URL: http://localhost:8000/api
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
  file_storage:
```

**With external PostgreSQL database:**

```yaml
services:
  backend:
    image: theprantadutta/filerunner-backend:latest
    environment:
      DATABASE_URL: postgresql://user:password@your-db-host:5432/filerunner
      JWT_SECRET: your-super-secret-jwt-key-min-32-characters
      CORS_ORIGINS: http://localhost
      ADMIN_EMAIL: admin@example.com
      ADMIN_PASSWORD: admin123
    ports:
      - "8000:8000"
    volumes:
      - file_storage:/app/storage

  frontend:
    image: theprantadutta/filerunner-frontend:latest
    environment:
      API_URL: http://localhost:8000/api
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  file_storage:
```

Then run:
```bash
docker-compose up -d
```

Access the application at:
- Frontend: **http://localhost:3000**
- Backend API: **http://localhost:8000**

### Option 2: Clone Repository

For more configuration options (nginx reverse proxy, HTTPS with Traefik, etc.):

#### Prerequisites

- Docker and Docker Compose
- Rust 1.75+ (for development)
- Node.js 18+ (for frontend development)

#### Running with Docker

1. Clone the repository:
```bash
git clone https://github.com/theprantadutta/filerunner.git
cd filerunner
```

2. Create environment file:
```bash
cp .env.example .env

# IMPORTANT: Edit .env and change these values:
# - POSTGRES_PASSWORD
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - ADMIN_PASSWORD
```

**Security Note:**
- `.env` files contain secrets and are **NOT tracked in git**
- Only `.env.example` files are committed (safe templates)
- See [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for detailed instructions

3. Start the services:
```bash
docker-compose up -d
```

4. Access the application at: **http://localhost/**

   The admin user is created automatically on first startup. You'll be prompted to change the password on first login.

### Deployment Options

FileRunner supports multiple deployment configurations:

| Method | Command | Access URL | Use Case |
|--------|---------|------------|----------|
| **HTTP** | `docker-compose up -d` | `http://localhost/` | Development, internal networks |
| **HTTPS** | `docker-compose -f docker-compose.ssl.yml up -d` | `https://your-domain.com/` | Production with auto-SSL |

#### HTTP Deployment (Default)

Uses nginx as reverse proxy on port 80:
```bash
docker-compose up -d
# Access at http://localhost/
```

#### HTTPS Deployment (Production)

Uses Traefik with automatic Let's Encrypt SSL certificates:

1. Configure your `.env` file:
```env
DOMAIN=files.yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com
CORS_ORIGINS=https://files.yourdomain.com
API_URL=https://files.yourdomain.com/api

# Optional: Traefik dashboard auth (generate with: htpasswd -nb admin yourpassword)
TRAEFIK_DASHBOARD_AUTH=admin:$$apr1$$...
```

2. Ensure your domain points to your server's IP address

3. Start with SSL:
```bash
docker-compose -f docker-compose.ssl.yml up -d
```

4. Access at: `https://your-domain.com/`
   - Traefik dashboard: `https://traefik.your-domain.com/` (if configured)

#### External Nginx (Alternative)

If you prefer to use your own nginx installation, see the `nginx/` directory for configuration examples:
- `nginx/nginx.conf` - HTTP configuration
- `nginx/nginx-ssl.conf` - HTTPS with your own certificates
- `nginx/nginx-letsencrypt.conf` - HTTPS with certbot
- `nginx/README.md` - Detailed setup instructions

#### Subpath Deployment

To deploy FileRunner under a subpath (e.g., `https://example.com/filerunner/`), you need to build the frontend with `NEXT_PUBLIC_BASE_PATH`:

1. Create a `docker-compose.override.yml`:
```yaml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_BASE_PATH: /filerunner
    environment:
      API_URL: https://example.com/filerunner-api
```

2. Configure nginx to proxy both frontend and backend:
```nginx
# Backend API
location /filerunner-api/ {
    rewrite ^/filerunner-api/?(.*)$ /api/$1 break;
    proxy_pass http://localhost:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Frontend
location /filerunner/ {
    rewrite ^/filerunner/?(.*)$ /$1 break;
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
}
```

3. Build and start:
```bash
docker-compose up -d --build
```

> **Note:** `NEXT_PUBLIC_BASE_PATH` is a **build-time** variable. You must rebuild the frontend image whenever you change it.

### Using an Existing Database

If you want to use an existing PostgreSQL database:

**Option 1** - Update `DATABASE_URL` in docker-compose.yml:
```yaml
DATABASE_URL: postgresql://your_user:your_pass@your_host:5432/your_db
```

**Option 2** - Run without Docker's postgres service:
```bash
# Comment out 'postgres' service in docker-compose.yml
# Update .env with your database credentials
```

**Note:** Migrations run automatically on startup.

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

---

## API Documentation

### Authentication Concepts

FileRunner uses **two authentication methods** for different purposes:

| Auth Type | Header | Used For |
|-----------|--------|----------|
| **JWT Bearer Token** | `Authorization: Bearer <token>` | User account operations, project management, file listing |
| **API Key** | `X-API-Key: <api_key>` or `?api_key=<api_key>` | File uploads and downloads (programmatic access) |

**When to use each:**
- Use **JWT tokens** when managing your account through the dashboard or API (creating projects, listing files, deleting files via dashboard)
- Use **API keys** when integrating file uploads/downloads into your applications (each project has its own unique API key)

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1800,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "user",
    "created_at": "2024-01-15T10:30:00Z",
    "must_change_password": false
  }
}
```

**Errors:**
- `400` - Invalid email format or password too short (min 6 chars)
- `400` - Email already exists
- `403` - Signup disabled

---

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response (200 OK):** Same as register response

**Errors:**
- `401` - Invalid credentials

---

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

**Errors:**
- `401` - Token not found, expired, or invalid
- `403` - Token reuse detected (security incident - all tokens revoked)

---

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "role": "user",
  "created_at": "2024-01-15T10:30:00Z",
  "must_change_password": false
}
```

---

#### Change Password
```http
PUT /api/auth/change-password
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "current_password": "old_password",
  "new_password": "new_secure_password"
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Errors:**
- `400` - Current password incorrect or new password too short

**Note:** All active refresh tokens are revoked on password change.

---

#### Logout (Single Session)
```http
POST /api/auth/logout
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### Logout All Sessions
```http
POST /api/auth/logout-all
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "message": "All sessions logged out",
  "revoked_count": 5
}
```

---

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

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Project",
  "api_key": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "is_public": false,
  "created_at": "2024-01-15T10:35:00Z"
}
```

**Errors:**
- `400` - Invalid project name (empty or > 255 chars)

---

#### List Projects
```http
GET /api/projects
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Project",
    "api_key": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "is_public": false,
    "created_at": "2024-01-15T10:35:00Z",
    "file_count": 42,
    "total_size": 15728640
  }
]
```

---

#### Get Project
```http
GET /api/projects/:id
Authorization: Bearer <jwt_token>
```

**Response (200 OK):** Same structure as list item

**Errors:**
- `404` - Project not found or not owned by user

---

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

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Name",
  "api_key": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "is_public": true,
  "created_at": "2024-01-15T10:35:00Z"
}
```

---

#### Regenerate API Key
```http
POST /api/projects/:id/regenerate-key
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Project",
  "api_key": "NEW-UUID-API-KEY-HERE",
  "is_public": false,
  "created_at": "2024-01-15T10:35:00Z"
}
```

**Note:** The old API key becomes immediately invalid.

---

#### Delete Project
```http
DELETE /api/projects/:id
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "message": "Project deleted successfully"
}
```

**Note:** All files and folders in the project are permanently deleted.

---

#### Empty Project
```http
DELETE /api/projects/:id/empty
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "message": "Project emptied successfully",
  "deleted_count": 42
}
```

**Note:** Deletes all files and folders but keeps the project itself.

---

### Files

#### Upload File
```http
POST /api/upload
X-API-Key: <project_api_key>
Content-Type: multipart/form-data

file: <binary_file>
folder_path: images/avatars (optional)
```

**Response (200 OK):**
```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "original_name": "avatar.jpg",
  "size": 245760,
  "mime_type": "image/jpeg",
  "download_url": "/api/files/550e8400-e29b-41d4-a716-446655440000",
  "folder_path": "images/avatars"
}
```

**Errors:**
- `400` - No file provided
- `400` - File exceeds maximum size (default: 100MB)
- `400` - Invalid folder path (see validation rules below)
- `401` - Missing or invalid API key

**Folder Path Validation:**
- Only alphanumeric characters, underscores, hyphens, forward slashes, and dots allowed
- No `..` (path traversal)
- No leading/trailing slashes
- No hidden folders (starting with `.`)
- No double slashes

---

#### Download File
```http
GET /api/files/:file_id
X-API-Key: <project_api_key> (for private files)
```

Or using query parameter:
```http
GET /api/files/:file_id?api_key=<project_api_key>
```

**Response:** Binary file content with appropriate headers:
- `Content-Type`: Detected MIME type
- `Content-Length`: File size in bytes
- `Content-Disposition`: `inline; filename="original_name.ext"`

**Access Control:**
- **Public project**: No API key needed
- **Public folder in private project**: No API key needed
- **Private project/folder**: API key required (header or query param)

---

#### List Project Files
```http
GET /api/projects/:id/files
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "project_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "folder_id": "8b3e8480-e29b-41d4-a716-446655440000",
    "folder_path": "images/avatars",
    "original_name": "avatar.jpg",
    "size": 245760,
    "mime_type": "image/jpeg",
    "upload_date": "2024-01-15T11:00:00Z",
    "download_url": "/api/files/550e8400-e29b-41d4-a716-446655440000"
  }
]
```

---

#### Delete File
Supports both JWT and API key authentication:
```http
DELETE /api/files/:file_id
Authorization: Bearer <jwt_token>
```

Or with API key:
```http
DELETE /api/files/:file_id
X-API-Key: <project_api_key>
```

**Response (200 OK):**
```json
{
  "message": "File deleted successfully"
}
```

**Authentication:**
- **JWT**: User must own the project containing the file
- **API Key**: Must match the project's API key

---

#### Bulk Delete Files
Supports both JWT and API key authentication:
```http
DELETE /api/files/bulk
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

Or with API key:
```http
DELETE /api/files/bulk
X-API-Key: <project_api_key>
Content-Type: application/json

{
  "file_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**Response (200 OK):**
```json
{
  "message": "Files deleted successfully",
  "deleted_count": 2
}
```

**Authentication:**
- **JWT**: User must own the projects containing the files (can span multiple projects)
- **API Key**: All files must belong to the same project that the API key is for

---

#### Delete Folder (via API Key)
```http
POST /api/folders/delete
X-API-Key: <project_api_key>
Content-Type: application/json

{
  "folder_path": "images/avatars"
}
```

**Response (200 OK):**
```json
{
  "message": "Folder files deleted successfully",
  "deleted_count": 15
}
```

**Note:** Deletes all files in the folder and the folder itself.

---

### Folders

#### Create Folder
```http
POST /api/folders
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "path": "documents/invoices",
  "is_public": false
}
```

**Response (200 OK):**
```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "path": "documents/invoices",
  "is_public": false,
  "created_at": "2024-01-15T10:40:00Z"
}
```

**Note:** If folder already exists, updates its visibility.

---

#### List Folders
```http
GET /api/folders?project_id=<uuid>
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "path": "documents/invoices",
    "is_public": false,
    "created_at": "2024-01-15T10:40:00Z",
    "file_count": 15,
    "total_size": 5242880
  }
]
```

---

#### Update Folder Visibility
```http
PUT /api/folders/:id/visibility
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "is_public": true
}
```

**Response (200 OK):**
```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "path": "documents/invoices",
  "is_public": true,
  "created_at": "2024-01-15T10:40:00Z"
}
```

---

### Health Check

```http
GET /health
```

**Response (200 OK):** `OK`

---

### Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Error message description"
}
```

| Status Code | Description |
|-------------|-------------|
| `400` | Bad Request - Invalid input, validation error |
| `401` | Unauthorized - Missing or invalid token/API key |
| `403` | Forbidden - Token reuse detected, signup disabled |
| `404` | Not Found - Resource doesn't exist or access denied |
| `500` | Internal Server Error - Server-side error |

---

### Rate Limiting

| Endpoint Category | Limit | Burst |
|-------------------|-------|-------|
| Auth endpoints (`/api/auth/*`) | 5 req/sec | 10 |
| File upload (`/api/upload`) | 1 req/sec | 10 |
| Folder delete (`/api/folders/delete`) | 1 req/sec | 10 |
| Other endpoints | No limit | - |

---

## Code Examples

### cURL

```bash
# Login and get tokens
curl -X POST https://your-filerunner.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Create a project
curl -X POST https://your-filerunner.com/api/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My CDN Project", "is_public": false}'

# Upload a file
curl -X POST https://your-filerunner.com/api/upload \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  -F "file=@/path/to/image.jpg" \
  -F "folder_path=images/avatars"

# Download a file (private)
curl -X GET "https://your-filerunner.com/api/files/FILE_ID" \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  -o downloaded_file.jpg

# Download a file (using query param)
curl -X GET "https://your-filerunner.com/api/files/FILE_ID?api_key=YOUR_PROJECT_API_KEY" \
  -o downloaded_file.jpg

# List project files
curl -X GET https://your-filerunner.com/api/projects/PROJECT_ID/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Delete a file (with JWT)
curl -X DELETE https://your-filerunner.com/api/files/FILE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Delete a file (with API key)
curl -X DELETE https://your-filerunner.com/api/files/FILE_ID \
  -H "X-API-Key: YOUR_PROJECT_API_KEY"

# Bulk delete files (with JWT)
curl -X DELETE https://your-filerunner.com/api/files/bulk \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_ids": ["FILE_ID_1", "FILE_ID_2"]}'

# Bulk delete files (with API key - all files must be in same project)
curl -X DELETE https://your-filerunner.com/api/files/bulk \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_ids": ["FILE_ID_1", "FILE_ID_2"]}'
```

### Python

```python
import requests

BASE_URL = "https://your-filerunner.com"

# Login
response = requests.post(f"{BASE_URL}/api/auth/login", json={
    "email": "user@example.com",
    "password": "password123"
})
tokens = response.json()
jwt_token = tokens["access_token"]
headers = {"Authorization": f"Bearer {jwt_token}"}

# Create a project
response = requests.post(f"{BASE_URL}/api/projects",
    headers=headers,
    json={"name": "My CDN Project", "is_public": False}
)
project = response.json()
api_key = project["api_key"]
project_id = project["id"]

# Upload a file
with open("/path/to/image.jpg", "rb") as f:
    response = requests.post(f"{BASE_URL}/api/upload",
        headers={"X-API-Key": api_key},
        files={"file": f},
        data={"folder_path": "images/avatars"}
    )
file_info = response.json()
file_id = file_info["file_id"]

# Download a file
response = requests.get(f"{BASE_URL}/api/files/{file_id}",
    headers={"X-API-Key": api_key}
)
with open("downloaded_file.jpg", "wb") as f:
    f.write(response.content)

# List project files
response = requests.get(f"{BASE_URL}/api/projects/{project_id}/files",
    headers=headers
)
files = response.json()

# Delete a file (with JWT)
response = requests.delete(f"{BASE_URL}/api/files/{file_id}",
    headers=headers
)

# Delete a file (with API key)
response = requests.delete(f"{BASE_URL}/api/files/{file_id}",
    headers={"X-API-Key": api_key}
)

# Bulk delete files (with JWT)
response = requests.delete(f"{BASE_URL}/api/files/bulk",
    headers=headers,
    json={"file_ids": ["file_id_1", "file_id_2"]}
)

# Bulk delete files (with API key)
response = requests.delete(f"{BASE_URL}/api/files/bulk",
    headers={"X-API-Key": api_key},
    json={"file_ids": ["file_id_1", "file_id_2"]}
)
```

### JavaScript (Node.js / Browser)

```javascript
const BASE_URL = "https://your-filerunner.com";

// Login
async function login(email, password) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return response.json();
}

// Create a project
async function createProject(jwtToken, name, isPublic = false) {
  const response = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwtToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, is_public: isPublic })
  });
  return response.json();
}

// Upload a file
async function uploadFile(apiKey, file, folderPath = "") {
  const formData = new FormData();
  formData.append("file", file);
  if (folderPath) formData.append("folder_path", folderPath);

  const response = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: formData
  });
  return response.json();
}

// Download a file
async function downloadFile(fileId, apiKey = null) {
  const url = apiKey
    ? `${BASE_URL}/api/files/${fileId}?api_key=${apiKey}`
    : `${BASE_URL}/api/files/${fileId}`;

  const response = await fetch(url);
  return response.blob();
}

// List project files
async function listFiles(jwtToken, projectId) {
  const response = await fetch(`${BASE_URL}/api/projects/${projectId}/files`, {
    headers: { "Authorization": `Bearer ${jwtToken}` }
  });
  return response.json();
}

// Delete files (with JWT)
async function deleteFilesWithJwt(jwtToken, fileIds) {
  const response = await fetch(`${BASE_URL}/api/files/bulk`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${jwtToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ file_ids: fileIds })
  });
  return response.json();
}

// Delete files (with API key - all files must be in same project)
async function deleteFilesWithApiKey(apiKey, fileIds) {
  const response = await fetch(`${BASE_URL}/api/files/bulk`, {
    method: "DELETE",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ file_ids: fileIds })
  });
  return response.json();
}

// Delete single file (with API key)
async function deleteFile(apiKey, fileId) {
  const response = await fetch(`${BASE_URL}/api/files/${fileId}`, {
    method: "DELETE",
    headers: { "X-API-Key": apiKey }
  });
  return response.json();
}

// Usage example
async function main() {
  const { access_token } = await login("user@example.com", "password123");
  const project = await createProject(access_token, "My CDN Project");
  console.log("Project API Key:", project.api_key);

  // Upload using the project's API key
  const fileInput = document.querySelector('input[type="file"]');
  const result = await uploadFile(project.api_key, fileInput.files[0], "uploads");
  console.log("File uploaded:", result.download_url);
}
```

---

## Using FileRunner with AI Agents

This section provides ready-to-use prompts you can give to AI assistants (like ChatGPT, Claude, etc.) to help you interact with your FileRunner instance.

**Before using these prompts, gather this information:**
- `YOUR_FILERUNNER_URL` - Your FileRunner instance URL (e.g., `https://files.example.com`)
- `YOUR_EMAIL` - Your account email
- `YOUR_PASSWORD` - Your account password
- `YOUR_PROJECT_API_KEY` - Your project's API key (get this after creating a project)

---

### Getting Started Prompt

Copy and paste this prompt to an AI assistant to get started:

```
I have a FileRunner instance at [YOUR_FILERUNNER_URL]. FileRunner is a file hosting and CDN platform with a REST API.

Here's how the authentication works:
- JWT Bearer tokens for account operations (Authorization: Bearer <token>)
- API Keys for file uploads/downloads (X-API-Key: <key> or ?api_key=<key>)

Help me get started by:
1. Logging in with email [YOUR_EMAIL] and password [YOUR_PASSWORD] via POST /api/auth/login
2. Creating a project named "[YOUR_PROJECT_NAME]" via POST /api/projects
3. Show me the project's API key from the response

Key endpoints:
- POST /api/auth/login - Login (returns access_token)
- POST /api/projects - Create project (requires Bearer token, returns api_key)
- POST /api/upload - Upload file (requires X-API-Key header)
- GET /api/files/:id - Download file (requires X-API-Key for private files)

Please provide curl commands or code examples for each step.
```

---

### File Operations Prompt

```
I need to manage files on my FileRunner instance at [YOUR_FILERUNNER_URL].

My project API key is: [YOUR_PROJECT_API_KEY]

Help me with file operations:

UPLOAD FILES:
- Endpoint: POST /api/upload
- Headers: X-API-Key: [YOUR_PROJECT_API_KEY]
- Body: multipart/form-data with "file" field and optional "folder_path" field
- folder_path organizes files (e.g., "images/avatars", "documents/2024")

DOWNLOAD FILES:
- Endpoint: GET /api/files/:file_id
- For private files, add header X-API-Key or query param ?api_key=
- Public project files don't need authentication

DELETE FILES (supports both JWT token OR API key):
- Single: DELETE /api/files/:file_id with X-API-Key header or Authorization: Bearer
- Bulk: DELETE /api/files/bulk with body {"file_ids": ["id1", "id2"]}
- Note: With API key, all files must belong to the same project

I want to:
1. Upload a file to folder "[FOLDER_PATH]"
2. Get the download URL
3. [YOUR SPECIFIC REQUEST]

Please provide the exact commands or code.
```

---

### Project Management Prompt

```
I need to manage projects on my FileRunner instance at [YOUR_FILERUNNER_URL].

My JWT token is: [YOUR_JWT_TOKEN]
(Get this by logging in: POST /api/auth/login with email/password)

Project management endpoints (all require Authorization: Bearer <token>):

CREATE PROJECT:
POST /api/projects
Body: {"name": "Project Name", "is_public": false}
Response includes the api_key for file uploads

LIST PROJECTS:
GET /api/projects
Returns array with file_count and total_size for each project

UPDATE PROJECT:
PUT /api/projects/:id
Body: {"name": "New Name", "is_public": true}

REGENERATE API KEY:
POST /api/projects/:id/regenerate-key
Old key immediately becomes invalid

DELETE PROJECT:
DELETE /api/projects/:id
Warning: Deletes all files permanently

EMPTY PROJECT (keep project, delete all files):
DELETE /api/projects/:id/empty

I want to:
[YOUR SPECIFIC REQUEST - e.g., "create a new public project for user avatars"]

Please provide the exact commands.
```

---

### Folder Management Prompt

```
I need to organize files into folders on my FileRunner instance at [YOUR_FILERUNNER_URL].

My JWT token is: [YOUR_JWT_TOKEN]
My project ID is: [YOUR_PROJECT_ID]
My project API key is: [YOUR_PROJECT_API_KEY]

FOLDER ENDPOINTS:

Create/Update Folder (JWT auth):
POST /api/folders
Body: {"project_id": "[PROJECT_ID]", "path": "folder/path", "is_public": false}

List Folders (JWT auth):
GET /api/folders?project_id=[PROJECT_ID]

Update Folder Visibility (JWT auth):
PUT /api/folders/:id/visibility
Body: {"is_public": true}

Delete Folder Contents (API key auth):
POST /api/folders/delete
Headers: X-API-Key: [API_KEY]
Body: {"folder_path": "folder/path"}

VISIBILITY RULES:
- Private project + private folder = API key required to download
- Private project + public folder = No auth needed to download
- Public project = No auth needed to download any file

I want to:
[YOUR SPECIFIC REQUEST - e.g., "create a public folder 'assets' for my website images"]

Please help with the exact commands.
```

---

### Complete Integration Prompt

Use this comprehensive prompt when you need full API access:

```
I'm integrating with FileRunner, a file hosting/CDN platform at [YOUR_FILERUNNER_URL].

AUTHENTICATION:
- Account operations use JWT: Authorization: Bearer <access_token>
- File operations use API Key: X-API-Key: <project_api_key> (or ?api_key=)
- Login: POST /api/auth/login {"email": "...", "password": "..."} returns access_token
- Refresh: POST /api/auth/refresh {"refresh_token": "..."}

MY CREDENTIALS:
- Email: [YOUR_EMAIL]
- JWT Token: [YOUR_JWT_TOKEN] (or help me get one)
- Project API Key: [YOUR_PROJECT_API_KEY] (or help me create a project)

FULL API REFERENCE:

Auth:
- POST /api/auth/register - Create account
- POST /api/auth/login - Login, get tokens
- POST /api/auth/refresh - Refresh access token
- GET /api/auth/me - Get current user (Bearer)
- PUT /api/auth/change-password - Change password (Bearer)
- POST /api/auth/logout - Logout session (Bearer)
- POST /api/auth/logout-all - Logout all sessions (Bearer)

Projects (Bearer token):
- POST /api/projects - Create project
- GET /api/projects - List projects
- GET /api/projects/:id - Get project
- PUT /api/projects/:id - Update project
- DELETE /api/projects/:id - Delete project
- DELETE /api/projects/:id/empty - Empty project
- POST /api/projects/:id/regenerate-key - New API key

Files:
- POST /api/upload - Upload file (X-API-Key, multipart: file + folder_path)
- GET /api/files/:id - Download file (X-API-Key for private)
- GET /api/projects/:id/files - List files (Bearer)
- DELETE /api/files/:id - Delete file (Bearer OR X-API-Key)
- DELETE /api/files/bulk - Bulk delete (Bearer OR X-API-Key, body: file_ids array)
- POST /api/folders/delete - Delete folder (X-API-Key, body: folder_path)

Folders (Bearer token):
- POST /api/folders - Create folder
- GET /api/folders?project_id=:id - List folders
- PUT /api/folders/:id/visibility - Update visibility

LIMITS:
- Max file size: 100MB (configurable)
- Auth rate limit: 5 req/sec
- Upload rate limit: 1 req/sec

I need help with:
[YOUR SPECIFIC REQUEST]

Please provide working code or curl commands with my actual credentials filled in.
```

---

## Environment Variables

**Important:** Never commit `.env` files to git! Only `.env.example` files are tracked.

### Quick Setup

```bash
cp .env.example .env

# Generate secure JWT secret
openssl rand -base64 32
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | `secure_password_here` |
| `JWT_SECRET` | Token signing key (32+ chars) | `openssl rand -base64 32` |
| `ADMIN_PASSWORD` | Initial admin password | `change_on_first_login` |

### File Storage Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_PATH` | File storage directory | `/app/storage` |
| `MAX_FILE_SIZE` | Maximum upload size in bytes | `104857600` (100MB) |

### HTTP vs HTTPS Configuration

**For HTTP deployment** (default):
```env
CORS_ORIGINS=http://localhost
API_URL=http://localhost:8000/api
```

**For HTTPS deployment**:
```env
DOMAIN=files.yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com
CORS_ORIGINS=https://files.yourdomain.com
API_URL=https://files.yourdomain.com/api
TRAEFIK_DASHBOARD_AUTH=admin:$$apr1$$...  # Optional
```

> **Note:** Use `API_URL` (not `NEXT_PUBLIC_API_URL`). This is read at runtime, allowing you to configure the backend URL without rebuilding the Docker image.

### All Variables

See `.env.example` for complete list with descriptions, or [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for detailed guide.

---

## Security Features

FileRunner implements multiple security measures:

| Feature | Description |
|---------|-------------|
| **Token Rotation** | Refresh tokens are rotated on each use |
| **Reuse Detection** | Detects token reuse attacks and revokes all tokens |
| **Path Traversal Protection** | Blocks `..`, null bytes, and invalid characters in paths |
| **Password Hashing** | Uses bcrypt for secure password storage |
| **Rate Limiting** | Prevents brute force on auth and upload endpoints |
| **CORS Protection** | Configurable allowed origins |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy |

---

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

---

## Project Status

- Phase 1: Backend Foundation (Complete)
- Phase 2: Frontend (Complete)
- Phase 3: CLI Tool (Planned)

---

## License

MIT

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
