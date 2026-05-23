# AppForge — Config-Driven App Generator

A full-stack system that converts JSON configuration into working web applications. Inspired by [Base44](https://base44.com/).

## Architecture

```
appforge/
├── frontend/     # Next.js 14 (App Router) — React config renderer
├── backend/      # Node.js + Express + TypeScript — Dynamic API engine
└── docs/         # Architecture & deployment notes
```

## Features Implemented

1. **Multi-language / Localization** — Dynamic i18n switching via config
2. **CSV Import System** — Upload → column mapping → store → render in tables
3. **Multiple Auth Methods** — Email/password + Google OAuth (config-driven)

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- pnpm (recommended)

### 1. Backend
```bash
cd backend
cp .env.example .env        # fill in your DB URL + secrets
pnpm install
pnpm prisma migrate dev
pnpm dev
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL
pnpm install
pnpm dev
```

### 3. Open
Visit http://localhost:3000

## How Config Works

POST a JSON config to `/api/apps` and AppForge will:
- Generate database tables dynamically
- Expose CRUD REST endpoints
- Render a full React UI (forms, tables, dashboards)

See `docs/config-schema.md` for the full config specification.

## Deployment

See `docs/deployment.md` for Railway / Render / Vercel instructions.
