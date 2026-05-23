#!/bin/bash
# AppForge Quick Start Script
# Run: chmod +x start.sh && ./start.sh

set -e

echo "🚀 AppForge Quick Start"
echo "========================"

# Check dependencies
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Installing pnpm..."; npm install -g pnpm; }

# Setup backend
echo ""
echo "📦 Setting up backend..."
cd backend

if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created backend/.env — please fill in your DATABASE_URL and JWT_SECRET"
  echo ""
  echo "⚠️  Edit backend/.env before continuing, then run this script again."
  exit 1
fi

pnpm install
pnpm prisma:generate

echo ""
echo "🗃️  Running database migrations..."
pnpm prisma:deploy 2>/dev/null || pnpm prisma:migrate

echo ""
echo "🌱 Seeding demo data..."
pnpm seed 2>/dev/null || echo "  (seed skipped — may already be seeded)"

# Setup frontend
echo ""
echo "📦 Setting up frontend..."
cd ../frontend

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "✅ Created frontend/.env.local"
fi

pnpm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start the app:"
echo "  Terminal 1: cd backend && pnpm dev"
echo "  Terminal 2: cd frontend && pnpm dev"
echo ""
echo "Demo account: demo@appforge.dev / demo1234"
echo "Dashboard:    http://localhost:3000/dashboard"
echo "API:          http://localhost:4000/health"
