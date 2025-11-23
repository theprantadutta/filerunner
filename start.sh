#!/bin/bash

# FileRunner Quick Start Script

set -e

echo "🚀 FileRunner Quick Start"
echo "=========================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env file..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env - Please review and update settings!"
fi

# Start services
echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if backend is healthy
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "Waiting for backend... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Backend failed to start. Check logs with: docker-compose logs backend"
    exit 1
fi

echo ""
echo "✨ FileRunner is ready!"
echo ""
echo "📍 Backend API: http://localhost:8000"
echo "📚 API Examples: See API_EXAMPLES.md"
echo "🔧 Setup Guide: See SETUP.md"
echo ""
echo "🔑 Default Admin Credentials:"
echo "   Email: admin@example.com"
echo "   Password: change_this_admin_password_immediately"
echo ""
echo "⚠️  IMPORTANT: Change the admin password immediately!"
echo ""
echo "📋 Quick Commands:"
echo "   View logs: docker-compose logs -f backend"
echo "   Stop:      docker-compose down"
echo "   Restart:   docker-compose restart backend"
echo ""
