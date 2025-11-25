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
cp .env.example .env

# ⚠️ IMPORTANT: Edit .env and change these values:
# - POSTGRES_PASSWORD
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - ADMIN_PASSWORD
```

**🔐 Security Note:**
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
NEXT_PUBLIC_API_URL=https://files.yourdomain.com/api

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

### HTTP vs HTTPS Configuration

**For HTTP deployment** (default):
```env
CORS_ORIGINS=http://localhost
NEXT_PUBLIC_API_URL=http://localhost/api
```

**For HTTPS deployment**:
```env
DOMAIN=files.yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com
CORS_ORIGINS=https://files.yourdomain.com
NEXT_PUBLIC_API_URL=https://files.yourdomain.com/api
TRAEFIK_DASHBOARD_AUTH=admin:$$apr1$$...  # Optional
```

### All Variables

See `.env.example` for complete list with descriptions, or [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for detailed guide.

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
