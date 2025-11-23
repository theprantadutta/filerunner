# Environment Configuration Guide

This guide explains how to properly configure environment variables for FileRunner.

## 🔐 Security First

**IMPORTANT:**
- ✅ `.env.example` files are tracked in git (safe, no secrets)
- ❌ `.env` files are NOT tracked in git (contains your secrets)
- ✅ `.gitignore` prevents `.env` files from being committed

## Environment Files Overview

FileRunner uses three environment files:

```
filerunner/
├── .env                        # Main config (Docker) - CREATE THIS
├── .env.example                # Example config (safe to commit)
├── backend/
│   ├── .env                    # Backend local dev - CREATE THIS
│   └── .env.example            # Example (safe to commit)
└── frontend/
    ├── .env.local              # Frontend local dev - CREATE THIS
    └── .env.local.example      # Example (safe to commit)
```

## Quick Setup

### For Docker Deployment

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and change these CRITICAL values:**
   ```bash
   # CHANGE THESE IMMEDIATELY!
   POSTGRES_PASSWORD=your_super_secure_password_here
   JWT_SECRET=your-random-secret-min-32-chars-use-pwgen-or-openssl
   ADMIN_PASSWORD=your_admin_password_here
   ```

3. **Generate secure secrets:**
   ```bash
   # Linux/Mac - Generate random JWT secret
   openssl rand -base64 32

   # Or use any secure random string generator
   ```

4. **Start services:**
   ```bash
   docker-compose up -d
   ```

### For Local Development

#### Backend

1. **Copy example:**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edit `backend/.env`:**
   ```env
   # Update with your local PostgreSQL credentials
   POSTGRES_USER=filerunner
   POSTGRES_PASSWORD=your_local_db_password
   POSTGRES_DB=filerunner

   DATABASE_URL=postgresql://filerunner:your_local_db_password@localhost:5432/filerunner

   JWT_SECRET=your-random-secret-min-32-chars
   ADMIN_PASSWORD=your_admin_password
   ```

3. **Start backend:**
   ```bash
   cargo run
   ```

#### Frontend

1. **Copy example:**
   ```bash
   cd frontend
   cp .env.local.example .env.local
   ```

2. **Edit `frontend/.env.local`:**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   ```

3. **Start frontend:**
   ```bash
   npm install
   npm run dev
   ```

## Environment Variables Reference

### Root `.env` (Docker)

Used by docker-compose.yml to configure all services.

```env
# PostgreSQL - Database credentials
POSTGRES_USER=filerunner              # Database username
POSTGRES_PASSWORD=CHANGE_ME           # ⚠️ CHANGE THIS!
POSTGRES_DB=filerunner                # Database name

# Backend - Application settings
JWT_SECRET=CHANGE_ME_MIN_32_CHARS     # ⚠️ CHANGE THIS!
SERVER_PORT=8000                      # Backend port
SERVER_HOST=0.0.0.0                   # Listen on all interfaces
CORS_ORIGINS=http://localhost:3000,http://localhost:8000

# Storage
STORAGE_PATH=/app/storage             # File storage location
MAX_FILE_SIZE=104857600               # 100MB in bytes

# Features
ALLOW_SIGNUP=true                     # Allow user registration

# Admin User
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=CHANGE_ME              # ⚠️ CHANGE THIS!

# Logging
RUST_LOG=info,filerunner_backend=debug

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Backend `.env` (Local Development)

Used when running backend locally (not in Docker).

```env
POSTGRES_USER=filerunner
POSTGRES_PASSWORD=your_password
POSTGRES_DB=filerunner
DATABASE_URL=postgresql://filerunner:your_password@localhost:5432/filerunner

JWT_SECRET=your-secret-min-32-chars
SERVER_PORT=8000
SERVER_HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
STORAGE_PATH=./storage
MAX_FILE_SIZE=104857600
ALLOW_SIGNUP=true
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password
RUST_LOG=info,filerunner_backend=debug
```

### Frontend `.env.local` (Local Development)

Used when running frontend locally (not in Docker).

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## How Environment Loading Works

### Docker Compose

```yaml
services:
  backend:
    env_file:
      - .env                 # Loads from root .env
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      # Variables are substituted from .env file
```

Docker Compose:
1. Reads `.env` file automatically (if in same directory)
2. Loads variables with `env_file` directive
3. Substitutes variables in `environment` section
4. Provides defaults with `${VAR:-default}` syntax

### Backend (Rust)

```rust
// src/config.rs
dotenv::dotenv().ok();  // Loads .env file
let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
```

The backend uses `dotenv` crate to load `.env` file from the current directory.

### Frontend (Next.js)

Next.js automatically loads:
- `.env.local` (local development, not committed)
- `.env.production` (production builds)
- Variables prefixed with `NEXT_PUBLIC_` are exposed to browser

## Security Checklist

Before deploying to production:

- [ ] `.env` file is NOT in git (check: `git ls-files | grep "\.env$"` returns nothing)
- [ ] Changed `POSTGRES_PASSWORD` to a strong password
- [ ] Changed `JWT_SECRET` to a random 32+ character string
- [ ] Changed `ADMIN_PASSWORD` to a strong password
- [ ] Set `ALLOW_SIGNUP=false` if you don't want public registration
- [ ] Updated `CORS_ORIGINS` to your domain
- [ ] Reviewed all default values

## Troubleshooting

### "JWT_SECRET must be set" error

**Solution:** Copy `.env.example` to `.env` and set `JWT_SECRET`.

### "Database connection failed"

**Solution:**
1. Check `DATABASE_URL` is correct
2. Ensure PostgreSQL is running
3. Verify credentials match your database

### Frontend can't connect to backend

**Solution:**
1. Check `NEXT_PUBLIC_API_URL` in frontend `.env.local`
2. Verify backend is running on correct port
3. Check CORS settings in backend `.env`

### Docker services not loading environment variables

**Solution:**
1. Ensure `.env` file exists in root directory
2. Run `docker-compose down` and `docker-compose up -d`
3. Check with: `docker-compose config` to see resolved values

## Production Deployment

### Using Docker

1. **Create `.env` on server:**
   ```bash
   # On your production server
   cd /path/to/filerunner
   nano .env
   # Paste your production values
   ```

2. **Use strong secrets:**
   ```bash
   # Generate strong password
   openssl rand -base64 32
   ```

3. **Set restrictive permissions:**
   ```bash
   chmod 600 .env
   ```

4. **Start services:**
   ```bash
   docker-compose up -d
   ```

### Using Environment Variables (Cloud)

For cloud platforms (Heroku, AWS, etc.), set environment variables through their dashboard:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- All other variables from `.env.example`

## Best Practices

1. **Never commit `.env` files** - They contain secrets
2. **Always commit `.env.example`** - Safe templates for others
3. **Use different secrets per environment** - dev, staging, prod
4. **Rotate secrets regularly** - Especially JWT_SECRET and passwords
5. **Use strong passwords** - Minimum 32 characters for JWT_SECRET
6. **Limit CORS origins** - Only allow your domains in production
7. **Backup your `.env`** - Securely, in case you need to restore

## Example: Full Setup from Scratch

```bash
# 1. Clone repository
git clone <your-repo>
cd filerunner

# 2. Create environment file
cp .env.example .env

# 3. Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24)

# 4. Update .env (on Linux/Mac)
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${DB_PASSWORD}/" .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env

# 5. Set admin password
nano .env  # Manually set ADMIN_PASSWORD

# 6. Start services
docker-compose up -d

# 7. Check logs
docker-compose logs -f backend
```

## Support

If you have issues with environment configuration:
1. Check this guide first
2. Verify `.gitignore` is working: `git status` should NOT show `.env`
3. Check docker-compose config: `docker-compose config`
4. Review logs: `docker-compose logs backend`

---

**Remember:** `.env` = SECRET (not in git) | `.env.example` = TEMPLATE (safe in git)
