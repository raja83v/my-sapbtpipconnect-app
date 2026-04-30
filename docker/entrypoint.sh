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
check_var ENCRYPTION_KEY
check_var BETTER_AUTH_SECRET
check_var NEXT_PUBLIC_APP_URL

if [ -n "$MISSING" ]; then
  echo ""
  echo "ERROR: The following required environment variables are not set:"
  printf "$MISSING"
  echo ""
  echo "See .env.example for a full reference."
  exit 1
fi

# Drizzle migrations are executed automatically by instrumentation.ts on
# server startup (see lib/db/migrate.ts). No external migrate step required.
echo "[1/1] Starting CPI Connect server..."
exec node server.js
