#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PASS_COUNT=0
FAIL_COUNT=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS: $name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL: $name"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# 1. No backdoor literals in non-test source
check "1. No backdoor literals in non-test backend source" bash -c \
  "! grep -rnE \"'1234'|'123456'|\\\"1234\\\"|admin123|athi1833\" backend --include='*.js' --exclude-dir=node_modules --exclude-dir=tests --exclude-dir=dev-only"

# 2. No raw NODE_ENV !== 'production' checks
check "2. No raw NODE_ENV !== 'production' checks" bash -c \
  "! grep -rnE \"!== 'production'|!process\.env\.NODE_ENV\" backend --include='*.js' --exclude-dir=node_modules --exclude-dir=tests"

# 3. No plaintext current_password usage outside migration/logger
check "3. No current_password outside migration/logger" bash -c \
  "test -z \"\$(grep -rn 'current_password' backend --include='*.js' --exclude-dir=node_modules --exclude-dir=tests | grep -v 'unset-plaintext-passwords.js' | grep -v 'config/logger.js' | grep -v '\$unset')\""

# 4. No JWT_SECRET fallbacks (excluding config/env.js weak-secret blocklist)
check "4. No JWT_SECRET fallbacks" bash -c \
  "! grep -rnE \"process\.env\.JWT_SECRET *\\|\\||'cricket_super_secret|cricket_webhook_secret|cricket_dual_admin\" backend --include='*.js' --exclude-dir=node_modules --exclude-dir=tests --exclude='env.js'"

# 5. No hardcoded personal emails in non-test source/docs
check "5. No hardcoded personal emails in non-test source/docs" bash -c \
  "! grep -rnE \"athilingam|cricketfederation21|ponramanan|ramana\\.twone|admin@example\\.com|admin@cfvd\\.org\" backend mobile_frontend PRODUCTION_CHECKLIST.md README.md --include='*.js' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.yml' --include='*.md' --exclude-dir=node_modules --exclude-dir=tests --exclude-dir=dist --exclude='.env'"

# 6. No hardcoded onrender/vercel/netlify/localhost:5000 in non-test source
check "6. No hardcoded PaaS URLs or localhost:5000 in source" bash -c \
  "! grep -rnE \"onrender\\.com|vercel\\.app|netlify\\.app|localhost:5000\" backend mobile_frontend/src --include='*.js' --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=tests"

# 7. Unbounded list query check
check "7. Unbounded query check" node scripts/check-unbounded.js

# 8. Route auth matrix allowlist check
check "8. Route auth matrix check" node scripts/check-route-auth.js

# 9. Backend lint & tests (includes security audit & validation tests)
check "9. Backend lint & tests" bash -c "cd backend && npm run lint && npm test"

# 10. Frontend lint & typecheck
check "10. Frontend lint & typecheck" bash -c "cd mobile_frontend && npm run lint && npx tsc --noEmit"

# 11. Production env validation smoke test (must reject weak JWT_SECRET)
check "11. Production config rejects weak JWT_SECRET" bash -c \
  "! (cd backend && NODE_ENV=production JWT_SECRET=short MONGODB_URI=mongodb://127.0.0.1/test ALLOWED_ORIGINS=https://a.b OTP_HMAC_SECRET=1234567890123456 WEBHOOK_SECRET=1234567890123456 BREVO_API_KEY=x node -e \"require('./config/env')\" >/dev/null 2>&1)"

echo ""
echo "Preflight Summary: PASS=$PASS_COUNT FAIL=$FAIL_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0

