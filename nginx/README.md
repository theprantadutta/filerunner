# Nginx Configuration for FileRunner

This directory contains nginx reverse proxy configurations for FileRunner.

## Configuration Files

| File | Purpose |
|------|---------|
| `nginx.conf` | HTTP-only (used by docker-compose.yml) |
| `nginx-ssl.conf` | HTTPS with user-provided certificates |
| `nginx-letsencrypt.conf` | HTTPS with Let's Encrypt/certbot |
| `ssl-params.conf` | Shared SSL/TLS security parameters |

## Quick Start

### Option 1: Using Docker Compose (Recommended)

The default `docker-compose.yml` includes nginx with HTTP configuration:

```bash
# Start FileRunner with nginx
docker-compose up -d

# Access at http://localhost/
```

### Option 2: External Nginx with HTTPS (Manual Certs)

For running nginx on the host machine with your own SSL certificates:

1. **Install nginx** on your system

2. **Place your certificates**:
   ```bash
   sudo mkdir -p /etc/nginx/ssl
   sudo cp your-fullchain.pem /etc/nginx/ssl/fullchain.pem
   sudo cp your-privkey.pem /etc/nginx/ssl/privkey.pem
   sudo chmod 600 /etc/nginx/ssl/*.pem
   ```

3. **Copy configuration files**:
   ```bash
   sudo cp nginx-ssl.conf /etc/nginx/nginx.conf
   sudo cp ssl-params.conf /etc/nginx/ssl-params.conf
   ```

4. **Edit the configuration** - Replace `YOUR_DOMAIN` with your domain:
   ```bash
   sudo sed -i 's/YOUR_DOMAIN/files.example.com/g' /etc/nginx/nginx.conf
   ```

5. **Start FileRunner without nginx** (expose ports directly):
   ```bash
   # Edit docker-compose.yml to expose backend:8000 and frontend:3000
   # Or run services without Docker's nginx
   docker-compose up -d postgres backend frontend
   ```

6. **Test and reload nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Option 3: External Nginx with Let's Encrypt

1. **Install certbot**:
   ```bash
   # Ubuntu/Debian
   sudo apt install certbot

   # CentOS/RHEL
   sudo dnf install certbot
   ```

2. **Create webroot directory**:
   ```bash
   sudo mkdir -p /var/www/certbot
   ```

3. **Get initial certificate** (temporarily use HTTP config):
   ```bash
   # Copy HTTP config first
   sudo cp nginx.conf /etc/nginx/nginx.conf
   # Edit to update upstreams to 127.0.0.1 instead of Docker names
   sudo nginx -t && sudo systemctl reload nginx

   # Obtain certificate
   sudo certbot certonly --webroot -w /var/www/certbot \
     -d files.example.com \
     --email admin@example.com \
     --agree-tos --no-eff-email
   ```

4. **Switch to HTTPS config**:
   ```bash
   sudo cp nginx-letsencrypt.conf /etc/nginx/nginx.conf
   sudo cp ssl-params.conf /etc/nginx/ssl-params.conf
   sudo sed -i 's/YOUR_DOMAIN/files.example.com/g' /etc/nginx/nginx.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Set up auto-renewal** (add to crontab):
   ```bash
   0 0 1 * * certbot renew --quiet && systemctl reload nginx
   ```

## Configuration Details

### Ports

| Service | Internal Port | Description |
|---------|---------------|-------------|
| Frontend | 3000 | Next.js application |
| Backend | 8000 | Rust API server |
| Nginx | 80 (HTTP) / 443 (HTTPS) | Reverse proxy |

### Routing

| Path | Destination | Description |
|------|-------------|-------------|
| `/` | frontend:3000 | Web UI |
| `/api/*` | backend:8000 | REST API |
| `/health` | backend:8000 | Health check |

### Rate Limiting

| Endpoint | Limit | Burst |
|----------|-------|-------|
| `/api/*` | 10 req/sec | 20 |
| `/api/auth/*` | 5 req/sec | 10 |

### File Upload

Maximum upload size is set to 100MB (`client_max_body_size 100M`).
Modify this if you change `MAX_FILE_SIZE` in your `.env` file.

### Security Headers

All HTTPS configurations include these security headers:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` (HSTS) - HTTPS only
- `Permissions-Policy`

## Environment Variables

Update your `.env` file based on your deployment:

```env
# HTTP deployment
NEXT_PUBLIC_API_URL=http://your-domain/api
CORS_ORIGINS=http://your-domain

# HTTPS deployment
NEXT_PUBLIC_API_URL=https://your-domain/api
CORS_ORIGINS=https://your-domain
```

## Docker vs Host Nginx

The `nginx.conf` file uses Docker service names (`frontend`, `backend`).
For host-based nginx, change the upstream servers:

```nginx
# Docker (nginx.conf - default)
upstream frontend {
    server frontend:3000;
}

# Host-based nginx
upstream frontend {
    server 127.0.0.1:3000;
}
```

## Troubleshooting

### 502 Bad Gateway

- Check if services are running: `docker-compose ps`
- Verify backend responds: `curl http://localhost:8000/health`
- Check nginx logs: `sudo tail -f /var/log/nginx/error.log`

### Certificate Issues

- Test config: `sudo nginx -t`
- Check cert exists: `ls -la /etc/letsencrypt/live/your-domain/`
- Verify cert validity: `openssl x509 -in /path/to/cert.pem -text -noout`

### Permission Denied

- Ensure nginx user can read certificates
- Check SELinux/AppArmor if on Linux: `sudo setenforce 0` (temporarily)

### Connection Refused

- Verify Docker services are running
- Check firewall rules: `sudo ufw status`
- Ensure ports are exposed in docker-compose.yml
