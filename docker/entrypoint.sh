#!/bin/sh
set -e

echo "============================================="
echo "  CPI Connect — Self-Hosted Startup"
echo "============================================="

# ── Validate required environment variables ──────────────────────────
MISSING=""

check_var() {
  eval val=\$$1
  if [ -z "$val" ]; then
    MISSING="$MISSING  - $1\n"
  fi
}

check_var DATABASE_URL
check_var NEXT_PUBLIC_SUPABASE_URL
check_var NEXT_PUBLIC_SUPABASE_ANON_KEY
check_var SUPABASE_SERVICE_ROLE_KEY
check_var ENCRYPTION_KEY
check_var NEXT_PUBLIC_APP_URL

if [ -n "$MISSING" ]; then
  echo ""
  echo "ERROR: The following required environment variables are not set:"
  printf "$MISSING"
  echo ""
  echo "See .env.example for a full reference."
  exit 1
fi

echo "[1/2] Running database migrations..."
npx prisma migrate deploy
echo "       Migrations complete."

echo "[2/2] Starting CPI Connect server..."
exec node server.js
