#!/usr/bin/env bash
# =============================================================================
# generate-supabase-keys.sh
# =============================================================================
# Generates the JWT secret and derives ANON_KEY / SERVICE_ROLE_KEY for a
# self-hosted Supabase deployment. Requires: openssl, node (for JWT signing).
#
# Usage:
#   bash docker/generate-supabase-keys.sh
# =============================================================================
set -euo pipefail

# Generate a random JWT secret (64 hex chars = 32 bytes)
JWT_SECRET=$(openssl rand -hex 32)

echo "Generated Supabase JWT keys:"
echo ""
echo "SUPABASE_JWT_SECRET=$JWT_SECRET"
echo ""

# Generate ANON key (role: anon)
ANON_KEY=$(node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const payload = Buffer.from(JSON.stringify({
  role: 'anon',
  iss: 'supabase',
  iat: now,
  exp: now + 10 * 365 * 24 * 3600  // 10 years
})).toString('base64url');
const signature = crypto.createHmac('sha256', '$JWT_SECRET')
  .update(header + '.' + payload).digest('base64url');
console.log(header + '.' + payload + '.' + signature);
")

echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
echo ""

# Generate SERVICE_ROLE key (role: service_role)
SERVICE_KEY=$(node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const payload = Buffer.from(JSON.stringify({
  role: 'service_role',
  iss: 'supabase',
  iat: now,
  exp: now + 10 * 365 * 24 * 3600  // 10 years
})).toString('base64url');
const signature = crypto.createHmac('sha256', '$JWT_SECRET')
  .update(header + '.' + payload).digest('base64url');
console.log(header + '.' + payload + '.' + signature);
")

echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY"
echo ""
