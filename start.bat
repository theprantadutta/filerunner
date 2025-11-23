@echo off
REM FileRunner Quick Start Script for Windows

echo.
echo ========================================
echo 🚀 FileRunner Quick Start
echo ========================================
echo.

REM Check if Docker is installed
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)

REM Create .env if it doesn't exist
if not exist backend\.env (
    echo 📝 Creating backend\.env file...
    copy backend\.env.example backend\.env
    echo ✅ Created backend\.env - Please review and update settings!
)

REM Start services
echo.
echo 🐳 Starting Docker containers...
docker-compose up -d

echo.
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo ✨ FileRunner is ready!
echo.
echo 📍 Backend API: http://localhost:8000
echo 📚 API Examples: See API_EXAMPLES.md
echo 🔧 Setup Guide: See SETUP.md
echo.
echo 🔑 Default Admin Credentials:
echo    Email: admin@example.com
echo    Password: change_this_admin_password_immediately
echo.
echo ⚠️  IMPORTANT: Change the admin password immediately!
echo.
echo 📋 Quick Commands:
echo    View logs: docker-compose logs -f backend
echo    Stop:      docker-compose down
echo    Restart:   docker-compose restart backend
echo.
pause
