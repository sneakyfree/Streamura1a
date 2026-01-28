#!/bin/bash
# Streamura Demo Confidence Suite
# Run this before any demo to verify platform readiness

set -e

echo "🔍 Running Streamura Demo Confidence Suite..."
echo "================================================"
echo ""

BACKEND_URL="${BACKEND_URL:-http://localhost:8001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5878}"
PASS_COUNT=0
FAIL_COUNT=0

check() {
    local name="$1"
    local result="$2"
    if [ "$result" = "pass" ]; then
        echo "✅ $name"
        ((PASS_COUNT++))
    else
        echo "❌ $name"
        ((FAIL_COUNT++))
    fi
}

# 1. Backend health
if curl -sf "$BACKEND_URL/health" | grep -q "healthy"; then
    check "Backend health check" "pass"
else
    check "Backend health check" "fail"
fi

# 2. Discover API returns events
if curl -sf "$BACKEND_URL/api/v1/discover" | jq -e '.featured_events' > /dev/null 2>&1; then
    check "Discover API working" "pass"
else
    check "Discover API working" "fail"
fi

# 3. Auth works
TOKEN=$(curl -sf -X POST "$BACKEND_URL/api/v1/auth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=admin@streamura.com&password=admin123" 2>/dev/null | jq -r '.access_token' 2>/dev/null)
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    check "Authentication (login)" "pass"
else
    check "Authentication (login)" "fail"
fi

# 4. Trust badge API
if curl -sf "$BACKEND_URL/api/v1/trust-badge/1" | jq -e '.tier' > /dev/null 2>&1; then
    check "Trust Badge API" "pass"
else
    check "Trust Badge API" "fail"
fi

# 5. Frontend accessible with correct title
if curl -sf "$FRONTEND_URL" | grep -q "Streamura"; then
    check "Frontend accessible with correct title" "pass"
else
    check "Frontend accessible with correct title" "fail"
fi

# 6. Database has seed data
EVENT_COUNT=$(curl -sf "$BACKEND_URL/api/v1/discover" | jq '.featured_events | length' 2>/dev/null || echo "0")
if [ "$EVENT_COUNT" -gt 0 ]; then
    check "Database has seed data ($EVENT_COUNT events)" "pass"
else
    check "Database has seed data ($EVENT_COUNT events)" "fail"
fi

echo ""
echo "================================================"
echo "Demo Confidence Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "🎉 ALL CHECKS PASSED - Ready for demo!"
    exit 0
else
    echo "⚠️  SOME CHECKS FAILED - Review issues above"
    exit 1
fi
