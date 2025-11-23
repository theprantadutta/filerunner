# Security Guide

## Overview

FileRunner takes security seriously. This document outlines security best practices and configuration.

## Pre-Deployment Security Checklist

Before deploying FileRunner to production, complete this checklist:

### Environment & Secrets

- [ ] Created `.env` file (copied from `.env.example`)
- [ ] Changed `POSTGRES_PASSWORD` to a strong, unique password
- [ ] Generated and set `JWT_SECRET` (minimum 32 characters)
  ```bash
  openssl rand -base64 32
  ```
- [ ] Changed `ADMIN_PASSWORD` to a strong password
- [ ] Verified `.env` is in `.gitignore` and NOT tracked in git
  ```bash
  git ls-files | grep "\.env$"  # Should return nothing
  ```
- [ ] Set restrictive file permissions on `.env`
  ```bash
  chmod 600 .env
  ```

### Application Configuration

- [ ] Set `ALLOW_SIGNUP=false` if public registration not needed
- [ ] Updated `CORS_ORIGINS` to only include your domain(s)
- [ ] Set `MAX_FILE_SIZE` to appropriate limit
- [ ] Reviewed and updated `ADMIN_EMAIL`
- [ ] Configured proper `STORAGE_PATH` with appropriate permissions

### Database Security

- [ ] Using strong PostgreSQL password
- [ ] PostgreSQL not exposed to public internet
- [ ] Database backups configured
- [ ] Regular backup testing scheduled

### Network Security

- [ ] Using HTTPS in production (reverse proxy)
- [ ] Firewall configured (only necessary ports open)
- [ ] CORS origins restricted to your domains
- [ ] Rate limiting configured (reverse proxy level)

### Docker Security

- [ ] Not running containers as root
- [ ] Using specific image versions (not `latest`)
- [ ] Regular image updates scheduled
- [ ] Docker socket not mounted in containers
- [ ] Secrets passed via environment, not baked into images

### Application Security

- [ ] Changed all default passwords
- [ ] JWT tokens expire after reasonable time (default: 7 days)
- [ ] File uploads validated and sanitized
- [ ] SQL injection protected (using parameterized queries)
- [ ] XSS protected (using React's built-in escaping)

### Monitoring & Logging

- [ ] Logging configured (`RUST_LOG` set appropriately)
- [ ] Log rotation configured
- [ ] Monitoring alerts set up
- [ ] Failed login attempts logged

## Security Features

### Authentication

**Password Hashing:**
- Uses Argon2 (memory-hard, resistant to GPU attacks)
- Automatic salt generation
- Secure default parameters

**JWT Tokens:**
- Signed with HS256 algorithm
- 7-day expiration (configurable)
- Includes user role for authorization

**Session Management:**
- Tokens stored in localStorage (frontend)
- No sensitive data in JWT payload
- Logout clears all tokens

### Authorization

**Role-Based Access Control (RBAC):**
- `admin` role: Full system access
- `user` role: Own projects only

**API Key Authentication:**
- UUID-based keys for file uploads
- Per-project keys
- Keys can be regenerated

**Access Control:**
- Users can only access their own projects
- Public/private project visibility
- Public/private folder visibility
- API key required for private resource access

### Data Protection

**SQL Injection Prevention:**
- All queries use SQLx parameterized queries
- No string concatenation in SQL

**XSS Prevention:**
- React automatically escapes output
- Sanitized user input
- CSP headers (add via reverse proxy)

**CSRF Protection:**
- JWT tokens in Authorization header (not cookies)
- State-changing operations require authentication

### File Security

**Upload Validation:**
- File size limits enforced
- MIME type detection
- Unique file IDs (UUID)
- Organized storage structure

**Download Protection:**
- API key required for private files
- Public files accessible without auth
- No directory traversal vulnerabilities

**Storage:**
- Files stored outside web root
- Unique stored names (prevent overwrites)
- Folder organization by project

## Secure Deployment

### Docker Production Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # Don't expose port externally
    networks:
      - internal

  backend:
    image: your-registry/filerunner-backend:latest
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - file_storage:/app/storage:rw
    # Only expose via reverse proxy
    networks:
      - internal

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - internal
    depends_on:
      - backend
      - frontend

networks:
  internal:
    driver: bridge
```

### Nginx Configuration (HTTPS)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Rate limiting
    limit_req zone=one burst=10 nodelay;

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 100M;
    }
}
```

## Security Maintenance

### Regular Tasks

**Weekly:**
- Review access logs for suspicious activity
- Check for failed login attempts
- Monitor disk usage

**Monthly:**
- Update Docker images
- Review and rotate admin passwords
- Check for dependency updates
- Review user accounts

**Quarterly:**
- Rotate JWT_SECRET (requires all users to re-login)
- Security audit
- Penetration testing (if applicable)
- Review CORS and access policies

### Incident Response

**If you suspect a breach:**

1. **Immediate Actions:**
   - Rotate all secrets (JWT_SECRET, database password)
   - Review access logs
   - Disable compromised accounts
   - Take snapshot/backup

2. **Investigation:**
   - Check Docker logs: `docker-compose logs`
   - Review PostgreSQL logs
   - Analyze access patterns
   - Identify entry point

3. **Recovery:**
   - Patch vulnerabilities
   - Restore from clean backup if needed
   - Notify affected users
   - Document incident

## Vulnerability Reporting

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email security details to: [your-email]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Resources

### Password Generation

```bash
# Linux/Mac
openssl rand -base64 32

# Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Online (use with caution)
# Only use for development, never for production secrets
```

### SSL/TLS Certificates

```bash
# Let's Encrypt (recommended)
certbot certonly --standalone -d your-domain.com

# Self-signed (development only)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem
```

### Security Scanning

```bash
# Scan Docker images
docker scan filerunner-backend:latest

# Audit npm dependencies (frontend)
cd frontend && npm audit

# Audit Cargo dependencies (backend)
cd backend && cargo audit
```

## Compliance

### GDPR Considerations

If handling EU user data:
- [ ] User data deletion capability
- [ ] Data export functionality
- [ ] Privacy policy in place
- [ ] Cookie consent (if using cookies)
- [ ] Data processing agreements

### Data Retention

- User accounts: Until deletion
- Files: Until deletion
- Logs: 90 days (configurable)
- Backups: 30 days

## Best Practices Summary

1. **Never commit secrets** - Use `.env` files (gitignored)
2. **Use strong passwords** - Minimum 32 chars for secrets
3. **Enable HTTPS** - Always in production
4. **Restrict CORS** - Only allow your domains
5. **Update regularly** - Keep dependencies current
6. **Monitor logs** - Watch for suspicious activity
7. **Backup database** - Regular, tested backups
8. **Limit access** - Principle of least privilege
9. **Use environment variables** - Never hardcode secrets
10. **Review code** - Security-focused code reviews

## Additional Security Layers

### Web Application Firewall (WAF)

Consider adding:
- Cloudflare
- AWS WAF
- ModSecurity

### Intrusion Detection

- fail2ban for repeated failed logins
- OSSEC for log analysis
- Tripwire for file integrity monitoring

### Backup Security

- Encrypted backups
- Off-site storage
- Regular restore testing
- Backup access logging

---

**Remember:** Security is an ongoing process, not a one-time setup. Stay vigilant!
