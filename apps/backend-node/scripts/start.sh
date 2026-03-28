#!/bin/sh
set -e

echo "[Startup] Container starting..."

DB_PUSH_ON_START="${PRISMA_DB_PUSH_ON_START:-false}"
DB_PUSH_URL="${PRISMA_DB_PUSH_URL:-${DATABASE_URL:-}}"

if [ "$DB_PUSH_ON_START" = "true" ]; then
  if [ -z "$DB_PUSH_URL" ]; then
    echo "[warn] PRISMA_DB_PUSH_ON_START=true but DATABASE_URL/PRISMA_DB_PUSH_URL is not set; skipping prisma db push"
  elif echo "$DB_PUSH_URL" | grep -q "pooler.supabase.com:6543"; then
    echo "[warn] Skipping prisma db push on Supabase pooler URL (prepared statements unsupported). Set PRISMA_DB_PUSH_URL to a direct DB URL."
  else
    echo "[Startup] Running prisma db push..."
    DATABASE_URL="$DB_PUSH_URL" timeout 30 npx prisma db push 2>&1 || echo "[warn] prisma db push failed or timed out"
  fi
else
  echo "[Startup] Skipping prisma db push (set PRISMA_DB_PUSH_ON_START=true to enable)"
fi

echo "[Startup] Launching node dist/main..."
exec node dist/main
