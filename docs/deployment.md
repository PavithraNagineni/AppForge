# Deployment Guide

## Option A: Railway (Recommended — Easiest)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
gh repo create appforge --public --push
```

### 2. Deploy Backend on Railway
1. Go to https://railway.app → New Project → Deploy from GitHub
2. Select your repo → select `backend` folder as root
3. Add PostgreSQL plugin → Railway auto-sets DATABASE_URL
4. Set environment variables:
   ```
   JWT_SECRET=your-secret-here
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   FRONTEND_URL=https://your-vercel-app.vercel.app
   NODE_ENV=production
   ```
5. Railway auto-detects `package.json` and runs `pnpm build && pnpm start`

### 3. Deploy Frontend on Vercel
1. Go to https://vercel.com → New Project → Import Git Repository
2. Set root directory to `frontend`
3. Set environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-backend.railway.app
   NEXTAUTH_URL=https://your-vercel-app.vercel.app
   NEXTAUTH_SECRET=your-secret-here
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
4. Deploy

---

## Option B: Render

### Backend
1. New → Web Service → Connect GitHub repo
2. Root directory: `backend`
3. Build command: `pnpm install && pnpm build && pnpm prisma migrate deploy`
4. Start command: `pnpm start`
5. Add PostgreSQL database service → copy DATABASE_URL

### Frontend
1. New → Static Site (or Web Service for SSR)
2. Root directory: `frontend`
3. Build: `pnpm install && pnpm build`
4. Publish: `.next` (or use Web Service with `pnpm start`)

---

## Option C: Docker Compose (Self-hosted)

```bash
# At project root
docker-compose up -d
```

The `docker-compose.yml` in the root spins up:
- PostgreSQL 15
- Backend (port 4000)
- Frontend (port 3000)

---

## Environment Variables Reference

### Backend `.env`
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/appforge
JWT_SECRET=super-secret-jwt-key-change-in-production
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
FRONTEND_URL=http://localhost:3000
PORT=4000
NODE_ENV=development
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Frontend `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=super-secret-nextauth-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

---

## Post-Deployment Checklist

- [ ] Backend health check: `GET /health` returns `{"status":"ok"}`
- [ ] Auth works: can register + login
- [ ] Config POST: `POST /api/apps` with sample config creates app
- [ ] Frontend loads app list
- [ ] CSV import works
- [ ] Language switcher works
