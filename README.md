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

## Output
When u first Sign-Up
<img width="1920" height="1020" alt="Screenshot 2026-05-23 212210" src="https://github.com/user-attachments/assets/9700a811-72cd-4826-9bfe-80b0bc978d8a" />

Sign-in
<img width="1920" height="1020" alt="Screenshot 2026-05-23 212149" src="https://github.com/user-attachments/assets/603acba6-c970-4f86-8d0e-ca04511129d6" />

DashBoard
<img width="1920" height="1020" alt="Screenshot 2026-05-23 212235" src="https://github.com/user-attachments/assets/1cf2b3ec-4aa2-4bb3-a5d7-59c71e99b9af" />


## Author
   Pavithra Nagineni
