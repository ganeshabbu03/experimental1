# Railway Deployment Guide (Deexen Monorepo)

This project is split into three deployable services:

1. `apps/backend` (FastAPI)
2. `apps/backend-node` (NestJS + Socket.IO + extension runtime)
3. `apps/frontend` (Vite React app)

## 1) Create Railway Services

Create three services from this same repository:

1. Service `deexen-backend`: root directory `apps/backend`
2. Service `deexen-backend-node`: root directory `apps/backend-node`
3. Service `deexen-frontend`: root directory `apps/frontend`

All three services use their local `Dockerfile`.

## 2) Add PostgreSQL in Railway

Add a Railway PostgreSQL plugin and share the `DATABASE_URL` with:

1. `deexen-backend`
2. `deexen-backend-node`

## 3) Required Environment Variables

### `deexen-backend` (FastAPI)

1. `DATABASE_URL` = Railway Postgres URL
2. `FRONTEND_URL` = public URL of `deexen-frontend` (for OAuth redirects/CORS)
3. `CORS_ORIGINS` = comma-separated allowed origins (include frontend URL)
4. OAuth and API keys already used by your app (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, etc.)

### `deexen-backend-node` (NestJS)

1. `DATABASE_URL` = Railway Postgres URL
2. `PORT` = auto-provided by Railway (no manual value needed)
3. `FRONTEND_URL` = public URL of `deexen-frontend`
4. `CORS_ORIGINS` = comma-separated allowed origins (include frontend URL)
5. `APP_URL` = public URL of this backend-node service
6. `GITHUB_CALLBACK_URL` = `${APP_URL}/auth/github/callback`
7. `ENABLE_DOCKER_WORKSPACES=false` (recommended on Railway unless you provide external Docker daemon access)

### `deexen-frontend` (React)

1. `VITE_API_URL` = public URL of `deexen-backend`
2. `VITE_WORKSPACE_API_URL` = public URL of `deexen-backend-node`
3. `VITE_WS_URL` = public URL of `deexen-backend-node`
4. Optional Supabase vars if used: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## 4) Health Endpoints

1. FastAPI: `GET /health`
2. NestJS: `GET /health`

Use these endpoints for Railway health checks.

## 5) Notes

1. Frontend container builds at startup using current env vars, then serves `dist` on Railway `PORT`.
2. `backend-node` runs `prisma db push` on startup, so schema is applied automatically.
3. Plugin and temporary workspace files are ephemeral unless you attach persistent storage.
