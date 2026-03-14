#!/bin/sh
set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

APP_WORKSPACE="${APP_WORKSPACE:-apps/web}"
SERVICE_ROLE="${SERVICE_ROLE:-web}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
MIGRATION_SCHEMA="${MIGRATION_SCHEMA:-apps/web/prisma/schema.prisma}"

if [ -n "${WORKER_DATABASE_URL:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="$WORKER_DATABASE_URL"
fi

if [ "$RUN_MIGRATIONS" = "true" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[entrypoint] DATABASE_URL is required when RUN_MIGRATIONS=true"
    exit 1
  fi
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy --schema="$MIGRATION_SCHEMA"
fi

case "$SERVICE_ROLE" in
  web)
    echo "[entrypoint] Starting web service..."
    if [ -f "$APP_WORKSPACE/dist-hostinger/start.js" ]; then
      exec node "$APP_WORKSPACE/dist-hostinger/start.js"
    fi
    exec npm run start --workspace="$APP_WORKSPACE"
    ;;
  worker)
    echo "[entrypoint] Starting worker service..."
    exec npm run worker:start --workspace="$APP_WORKSPACE"
    ;;
  *)
    echo "[entrypoint] Invalid SERVICE_ROLE: '$SERVICE_ROLE' (expected: web|worker)"
    exit 1
    ;;
esac
