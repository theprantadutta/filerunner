# FileRunner Deployment Checklist

Complete this checklist before deploying FileRunner.

## ✅ Pre-Deployment Verification

### 1. Environment Configuration

- [ ] Copied `.env.example` to `.env`
  ```bash
  cp .env.example .env
  ```

- [ ] Generated and set secure `JWT_SECRET`
  ```bash
  openssl rand -base64 32
  # Copy output to JWT_SECRET in .env
  ```

- [ ] Set strong `POSTGRES_PASSWORD`
  ```bash
  openssl rand -base64 24
  # Copy output to POSTGRES_PASSWORD in .env
  ```

- [ ] Set strong `ADMIN_PASSWORD` in `.env`

- [ ] Verified `.env` is NOT in git
  ```bash
  git ls-files | grep "\.env$"
  # Should return nothing
  ```

- [ ] For local dev: Created `backend/.env`
  ```bash
  cp backend/.env.example backend/.env
  ```

- [ ] For local dev: Created `frontend/.env.local`
  ```bash
  cp frontend/.env.local.example frontend/.env.local
  ```

### 2. Security Settings

- [ ] Reviewed and updated `CORS_ORIGINS` in `.env`
  - Development: `http://localhost:3000,http://localhost:8000`
  - Production: Your actual domain(s)

- [ ] Set `ALLOW_SIGNUP` appropriately
  - `true` for open registration
  - `false` to restrict registration

- [ ] Configured `MAX_FILE_SIZE` (default: 100MB)

- [ ] Reviewed all default passwords changed

### 3. Docker Environment

- [ ] Docker installed and running
  ```bash
  docker --version
  docker-compose --version
  ```

- [ ] Docker Compose version 3.8+ supported

- [ ] Sufficient disk space for:
  - PostgreSQL data
  - File storage
  - Docker images

### 4. Git Repository

- [ ] Verified `.gitignore` excludes `.env` files

- [ ] Confirmed only these env files are tracked:
  - `.env.example` ✅
  - `backend/.env.example` ✅
  - `frontend/.env.local.example` ✅

- [ ] NOT tracked:
  - `.env` ❌
  - `backend/.env` ❌
  - `frontend/.env.local` ❌

- [ ] All changes committed
  ```bash
  git status
  # Should show "nothing to commit, working tree clean"
  ```

## 🚀 Deployment Steps

### Quick Start (Development/Testing)

```bash
# 1. Navigate to project
cd filerunner

# 2. Create .env file
cp .env.example .env

# 3. Edit .env - REQUIRED CHANGES:
nano .env
# Update: POSTGRES_PASSWORD, JWT_SECRET, ADMIN_PASSWORD

# 4. Start services
docker-compose up -d

# 5. Check logs
docker-compose logs -f backend

# 6. Wait for services to be ready (30-60 seconds)

# 7. Access application
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

### Production Deployment

```bash
# 1. On production server
cd /opt/filerunner  # or your deployment path

# 2. Pull latest code
git pull origin main

# 3. Create .env with production values
cp .env.example .env
nano .env

# CRITICAL: Set these to strong, unique values:
# - POSTGRES_PASSWORD
# - JWT_SECRET (32+ chars)
# - ADMIN_PASSWORD
# - CORS_ORIGINS (your domain)
# - ALLOW_SIGNUP=false (if restricting registration)

# 4. Secure .env file
chmod 600 .env
chown root:root .env

# 5. Build and start services
docker-compose up -d --build

# 6. Verify services are running
docker-compose ps

# 7. Check logs for errors
docker-compose logs -f

# 8. Test access
curl http://localhost:8000/health
# Should return: OK

# 9. Access frontend
# Visit: http://your-domain.com:3000
```

### With Reverse Proxy (Recommended for Production)

```bash
# 1. Set up Nginx/Caddy/Traefik

# 2. Configure SSL/TLS certificates
certbot certonly --standalone -d your-domain.com

# 3. Update docker-compose.yml
# Remove port mappings, add reverse proxy config

# 4. Start services
docker-compose up -d

# 5. Configure reverse proxy
# See SECURITY.md for Nginx example
```

## 🔍 Post-Deployment Verification

### Service Health Checks

- [ ] PostgreSQL running
  ```bash
  docker-compose ps postgres
  # State should be "Up (healthy)"
  ```

- [ ] Backend running
  ```bash
  docker-compose ps backend
  curl http://localhost:8000/health
  # Should return: OK
  ```

- [ ] Frontend running
  ```bash
  docker-compose ps frontend
  curl http://localhost:3000
  # Should return HTML
  ```

### Functionality Tests

- [ ] Can access frontend at `http://localhost:3000`

- [ ] Can register new user (if `ALLOW_SIGNUP=true`)

- [ ] Can login with admin credentials
  - Email: Value from `ADMIN_EMAIL` in `.env`
  - Password: Value from `ADMIN_PASSWORD` in `.env`

- [ ] Can create a project

- [ ] Can upload a file

- [ ] Can download a file

- [ ] Can delete a file

- [ ] Can logout and login again

### Security Verification

- [ ] HTTPS enabled (production only)

- [ ] CORS origins restricted to your domain

- [ ] `.env` file has restrictive permissions
  ```bash
  ls -l .env
  # Should show: -rw------- (600)
  ```

- [ ] No `.env` files in git
  ```bash
  git ls-files | grep "\.env$"
  # Should return nothing
  ```

- [ ] Strong passwords set (checked above)

- [ ] JWT tokens expire (default: 7 days)

- [ ] File upload size limits enforced

## 📊 Monitoring Setup

### Log Monitoring

- [ ] Backend logs
  ```bash
  docker-compose logs -f backend
  ```

- [ ] Database logs
  ```bash
  docker-compose logs -f postgres
  ```

- [ ] Frontend logs
  ```bash
  docker-compose logs -f frontend
  ```

### Disk Usage Monitoring

- [ ] Set up disk usage alerts

- [ ] Monitor file storage growth
  ```bash
  du -sh ./storage
  ```

- [ ] Monitor database size
  ```bash
  docker exec filerunner-postgres du -sh /var/lib/postgresql/data
  ```

### Backup Configuration

- [ ] Database backup script created

- [ ] File storage backup configured

- [ ] Backup restoration tested

- [ ] Backup schedule automated

## 🛠️ Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Verify .env file exists and has correct values
cat .env

# Check Docker resources
docker system df
```

### Database connection errors

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify DATABASE_URL is correct
docker-compose exec backend env | grep DATABASE_URL
```

### Frontend can't connect to backend

```bash
# Verify NEXT_PUBLIC_API_URL
docker-compose exec frontend env | grep NEXT_PUBLIC_API_URL

# Check CORS settings
docker-compose exec backend env | grep CORS_ORIGINS

# Test backend directly
curl http://localhost:8000/health
```

## 📝 Documentation References

- [README.md](README.md) - Main documentation
- [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) - Complete env guide
- [SECURITY.md](SECURITY.md) - Security best practices
- [SETUP.md](SETUP.md) - Detailed setup instructions
- [API_EXAMPLES.md](API_EXAMPLES.md) - API usage examples

## ✨ Success Criteria

Your deployment is successful when:

- ✅ All services show "Up" status
- ✅ Frontend accessible and loads correctly
- ✅ Can login with admin credentials
- ✅ Can create projects and upload files
- ✅ API endpoints respond correctly
- ✅ No errors in logs (except expected startup messages)
- ✅ `.env` files secured and not in git

## 🎉 Post-Deployment

Once deployed successfully:

1. **Test all features** - Create account, upload files, etc.
2. **Set up monitoring** - Logs, disk usage, uptime
3. **Configure backups** - Database and file storage
4. **Document your setup** - Server details, access info
5. **Share with team** - Access credentials, docs

## 🔄 Updates & Maintenance

### Updating FileRunner

```bash
# 1. Backup first!
docker-compose exec postgres pg_dump -U filerunner filerunner > backup.sql
tar -czf storage-backup.tar.gz storage/

# 2. Pull updates
git pull origin main

# 3. Rebuild and restart
docker-compose down
docker-compose up -d --build

# 4. Check logs
docker-compose logs -f
```

### Regular Maintenance

- **Daily**: Monitor logs for errors
- **Weekly**: Check disk usage
- **Monthly**: Update Docker images, review access logs
- **Quarterly**: Rotate secrets, security audit

---

**Ready to deploy?** Start with section ✅ Pre-Deployment Verification!
