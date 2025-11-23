# FileRunner Setup Guide

Complete setup guide for FileRunner - from zero to running in minutes.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start with Docker](#quick-start-with-docker)
3. [Manual Setup](#manual-setup)
4. [First Steps](#first-steps)
5. [Testing the API](#testing-the-api)
6. [Production Deployment](#production-deployment)

## Prerequisites

### Docker Setup (Recommended)

- Docker 20.10+
- Docker Compose 2.0+

### Manual Setup

- Rust 1.75+
- PostgreSQL 14+
- Node.js 18+ (for frontend, Phase 2)

## Quick Start with Docker

The fastest way to get FileRunner running:

### 1. Clone and Configure

```bash
# Clone the repository
git clone <repository-url>
cd filerunner

# Create environment file (optional, docker-compose has defaults)
cp backend/.env.example backend/.env
```

### 2. Configure Environment (Optional)

Edit `docker-compose.yml` or `backend/.env` to set:

- `JWT_SECRET` - **IMPORTANT**: Change this in production!
- `ADMIN_EMAIL` - Admin user email
- `ADMIN_PASSWORD` - **IMPORTANT**: Change this in production!
- `ALLOW_SIGNUP` - Set to `false` to disable public registration

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Check status
docker-compose ps
```

### 4. Verify Installation

```bash
# Check health
curl http://localhost:8000/health

# Should return: OK
```

**Done!** The API is now running at `http://localhost:8000`

## Manual Setup

For development or non-Docker deployments:

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows:**
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE filerunner;
CREATE USER filerunner WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE filerunner TO filerunner;
\q
```

### 3. Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database credentials:
```env
DATABASE_URL=postgresql://filerunner:your_password@localhost:5432/filerunner
JWT_SECRET=generate-a-random-secret-at-least-32-characters-long
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-secure-admin-password
```

### 4. Install Rust Dependencies

```bash
# Install SQLx CLI
cargo install sqlx-cli --no-default-features --features postgres
```

### 5. Run Migrations

```bash
# From backend directory
sqlx migrate run
```

### 6. Start the Backend

```bash
cargo run --release
```

The API will be available at `http://localhost:8000`

## First Steps

### 1. Login as Admin

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "change_this_admin_password_immediately"
  }'
```

Save the `token` from the response.

### 2. Create a Project

```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "My First Project",
    "is_public": false
  }'
```

Save the `api_key` from the response.

### 3. Upload a File

```bash
curl -X POST http://localhost:8000/api/upload \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  -F "file=@/path/to/your/file.jpg" \
  -F "folder_path=images/avatars"
```

### 4. Download the File

```bash
curl http://localhost:8000/api/files/FILE_ID \
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \
  --output downloaded-file.jpg
```

## Testing the API

### Using cURL

See examples in [First Steps](#first-steps)

### Using Postman/Insomnia

Import this collection:

1. **Register User**
   - POST `/api/auth/register`
   - Body: `{ "email": "user@example.com", "password": "password123" }`

2. **Login**
   - POST `/api/auth/login`
   - Body: `{ "email": "user@example.com", "password": "password123" }`
   - Save token from response

3. **Create Project**
   - POST `/api/projects`
   - Headers: `Authorization: Bearer {token}`
   - Body: `{ "name": "Test Project", "is_public": true }`
   - Save api_key from response

4. **Upload File**
   - POST `/api/upload`
   - Headers: `X-API-Key: {api_key}`
   - Body: form-data with `file` field
   - Optional: `folder_path` field (e.g., "docs/reports")

5. **List Files**
   - GET `/api/projects/{project_id}/files`
   - Headers: `Authorization: Bearer {token}`

6. **Download File**
   - GET `/api/files/{file_id}`
   - Headers: `X-API-Key: {api_key}` (if private)

### Sample API Test Script

```bash
#!/bin/bash

BASE_URL="http://localhost:8000"

# 1. Register
echo "Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# 2. Create Project
echo "Creating project..."
PROJECT_RESPONSE=$(curl -s -X POST $BASE_URL/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Project","is_public":true}')

API_KEY=$(echo $PROJECT_RESPONSE | jq -r '.api_key')
PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.id')
echo "API Key: $API_KEY"
echo "Project ID: $PROJECT_ID"

# 3. Upload File
echo "Uploading file..."
echo "Hello, FileRunner!" > test.txt
UPLOAD_RESPONSE=$(curl -s -X POST $BASE_URL/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@test.txt" \
  -F "folder_path=test/files")

FILE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.file_id')
echo "File ID: $FILE_ID"

# 4. Download File
echo "Downloading file..."
curl -s $BASE_URL/api/files/$FILE_ID \
  -H "X-API-Key: $API_KEY" \
  -o downloaded.txt

echo "Downloaded content:"
cat downloaded.txt

# Cleanup
rm test.txt downloaded.txt
```

## Production Deployment

### Security Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Change `ADMIN_PASSWORD` immediately
- [ ] Set `ALLOW_SIGNUP=false` if you don't want public registration
- [ ] Configure proper CORS origins
- [ ] Use HTTPS in production
- [ ] Set up database backups
- [ ] Configure file storage limits
- [ ] Set up monitoring and logging
- [ ] Use environment variables, not `.env` files
- [ ] Review and restrict file upload permissions

### Docker Production Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: filerunner
    volumes:
      - /var/lib/filerunner/postgres:/var/lib/postgresql/data
    restart: always

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/filerunner
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      ALLOW_SIGNUP: "false"
      STORAGE_PATH: /app/storage
    volumes:
      - /var/lib/filerunner/storage:/app/storage
    ports:
      - "8000:8000"
    depends_on:
      - postgres
    restart: always
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Systemd Service

```ini
# /etc/systemd/system/filerunner.service
[Unit]
Description=FileRunner Backend
After=network.target postgresql.service

[Service]
Type=simple
User=filerunner
WorkingDirectory=/opt/filerunner/backend
Environment="DATABASE_URL=postgresql://..."
Environment="JWT_SECRET=..."
ExecStart=/opt/filerunner/backend/target/release/filerunner-backend
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable filerunner
sudo systemctl start filerunner
sudo systemctl status filerunner
```

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql postgresql://filerunner:password@localhost:5432/filerunner
```

**2. Migration Errors**
```bash
# Check migration status
sqlx migrate info

# Revert and retry
sqlx migrate revert
sqlx migrate run
```

**3. Permission Denied (Storage)**
```bash
# Fix storage directory permissions
mkdir -p storage
chmod 755 storage
```

**4. Port 8000 Already in Use**
```bash
# Find process
lsof -i :8000

# Kill process or change port in .env
SERVER_PORT=8001
```

**5. Docker Build Fails**
```bash
# Clean build
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Getting Help

- Check logs: `docker-compose logs -f backend`
- Enable debug logging: `RUST_LOG=debug`
- Review configuration in `.env`
- Check database connection
- Verify file permissions

## Next Steps

- Set up the frontend (Phase 2)
- Configure S3-compatible storage
- Set up automated backups
- Implement monitoring
- Add rate limiting
- Set up CDN for public files

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: See README.md files in each directory
