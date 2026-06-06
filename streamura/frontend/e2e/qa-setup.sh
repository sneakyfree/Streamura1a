#!/bin/bash
# Streamura E2E QA-user bootstrap
#
# The authenticated e2e specs (authed-stress, modals, tab-state, forms,
# subscriptions) read a JWT from /tmp/qa_token.txt and inject it into
# localStorage. That file is ephemeral (cleared on reboot) and nothing else
# creates it — so run this once before the authed suite.
#
# Idempotent: registers qa_user if missing, then mints a fresh token.
#
# Usage:  BACKEND=http://localhost:8001 ./e2e/qa-setup.sh
set -e

BACKEND="${BACKEND:-http://localhost:8001}"
QA_USER="qa_user"
QA_EMAIL="qa@streamura.com"
QA_PASS="qa_pass123"
TOKEN_FILE="/tmp/qa_token.txt"

echo "🔑 Bootstrapping E2E qa_user against $BACKEND ..."

# Register (ignore failure if the user already exists).
curl -s -m 10 -X POST "$BACKEND/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$QA_USER\",\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" > /dev/null || true

# Mint an access token (form-encoded OAuth2 endpoint).
TOKEN="$(curl -s -m 10 -X POST "$BACKEND/api/v1/auth/token" \
  -d "username=$QA_USER&password=$QA_PASS" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')"

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to mint token — is the backend running on $BACKEND?"
    exit 1
fi

printf '%s' "$TOKEN" > "$TOKEN_FILE"
echo "✅ Wrote $TOKEN_FILE (token length ${#TOKEN})"
