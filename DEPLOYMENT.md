# Deployment Guide

This project has two parts:
- `backend/` (Node + Express + Prisma + Postgres)
- `Frontend/` (Vite + React)

Below is a production‑focused deployment guide. It assumes you already have a PostgreSQL server and a Linux/Windows host for Node.

## 1) Prerequisites

- Node.js 18+ (or 20+ recommended)
- PostgreSQL 14+
- A domain or IP for the backend API
- A domain or IP for the frontend (can be same host)

## 2) Environment Variables

### Backend
Create `backend/.env` (use `backend/.env.example` as template):

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME"
JWT_SECRET="change-me"
PORT=5000
FRONTEND_URL="https://your-frontend-domain"
CLIENT_URL="https://your-frontend-domain"
CORS_ORIGINS=""
NODE_ENV=production
TRUST_PROXY=true
```

Notes:
- `JWT_SECRET` **must** be changed in production.
- `FRONTEND_URL` and `CLIENT_URL` are both accepted by the API.
- `CORS_ORIGINS` can be a comma‑separated list if you host multiple frontends.

### Frontend
Create `Frontend/.env.production` (use `Frontend/.env.example` as template):

```
VITE_API_URL=https://your-backend-domain/api
VITE_APP_NAME="OBU Leave Management"
VITE_APP_VERSION=1.0.0
VITE_LOG_LEVEL=error
VITE_ENABLE_MOCK_API=false
```

## 3) Database Setup

From `backend/`:

```
npm install
npx prisma db push
```

Optional: open Prisma Studio
```
npx prisma studio
```

## 4) Build Frontend

From `Frontend/`:

```
npm install
npm run build
```

The production bundle is in `Frontend/dist`.

## 5) Run Backend (Production)

From `backend/`:

```
npm install
npm start
```

API should be available at:
```
http://your-backend-host:5000/health
```

## 6) Serve Frontend

Use any static server to serve `Frontend/dist`.

Example (Node):
```
npx serve -s dist -l 5173
```

Or use Nginx/Apache to serve `Frontend/dist`.

## 7) Reverse Proxy (Recommended)

If you use Nginx, map:
- `/api` -> backend service (port 5000)
- `/` -> frontend static files

Example (high-level):
```
location /api/ {
  proxy_pass http://127.0.0.1:5000/api/;
}

location / {
  root /var/www/leave-s-m/dist;
  try_files $uri /index.html;
}
```

## 8) Health Check

The backend exposes:
```
GET /health
```

## 9) Common Issues

- **DB not found**: Create the database or update `DATABASE_URL`.
- **CORS errors**: Ensure `FRONTEND_URL` or `CORS_ORIGINS` includes your frontend domain.
- **JWT default**: In production, the server will exit if `JWT_SECRET` is unchanged.

## 10) Production Checklist

- [ ] `JWT_SECRET` replaced
- [ ] `DATABASE_URL` points to production database
- [ ] `FRONTEND_URL` / `CLIENT_URL` set correctly
- [ ] Frontend built (`npm run build`)
- [ ] Backend running (`npm start`)
- [ ] Health check OK (`/health`)

---

If you want Docker, CI, or automated migrations, let me know and I’ll add those files too.
