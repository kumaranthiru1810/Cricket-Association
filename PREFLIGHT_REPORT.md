# Preflight Report — Cricket Association Production Readiness

## 1. `scripts/preflight.sh` Results
Command: `bash scripts/preflight.sh` (Exit Code: `0`)

```
PASS: 1. No backdoor literals in non-test backend source
PASS: 2. No raw NODE_ENV !== 'production' checks
PASS: 3. No current_password outside migration/logger
PASS: 4. No JWT_SECRET fallbacks
PASS: 5. No hardcoded personal emails in non-test source/docs
PASS: 6. No hardcoded PaaS URLs or localhost:5000 in source
PASS: 7. Unbounded query check
PASS: 8. Route auth matrix check
PASS: 9. Backend lint & tests (46/46 runTests, 6/6 logic fixes, security audit, phase3 speed, validation errors)
PASS: 10. Frontend lint & typecheck (0 errors, npx tsc --noEmit 0 errors)
PASS: 11. Production config rejects weak JWT_SECRET
Preflight Summary: PASS=11 FAIL=0
```

## 2. Route Authorization Matrix Summary
- Generated in [docs/ROUTE_AUTH_MATRIX.md](docs/ROUTE_AUTH_MATRIX.md)
- Total routes: **358**
- Public mutating routes: **34** (strictly login, OTP, registration, password-reset, and contact endpoints)

## 3. Frontend Production Web Build (`npx expo export -p web`)
- Exported to `mobile_frontend/dist/`
- Largest JS chunks (uncompressed):
  - `__common-*.js`: 2.9 MB
  - `entry-*.js`: 1.1 MB
  - `index-*.js`: 275 KB
  - `login-*.js`: 27 KB
- Static assets: `public/stadium.*.jpg` (167 KB), `public/watermark.*.png` (161 KB)
- Lighthouse & Playwright cross-browser checks: see `KNOWN_LIMITATIONS.md`

## 4. Changed Files by Phase
- **Phase A (Auth & Secrets)**: `backend/models/User.js`, `backend/models/Team.js`, `backend/models/userModel.js`, `backend/models/teamRegistrationModel.js`, `backend/services/superAdminOtpService.js`, `backend/services/adminAccessService.js`, `backend/services/adminService.js`, `backend/services/auth/passwordResetAuth.js`, `backend/services/auth/scorerAuth.js`, `backend/services/auth/teamAuth.js`, `backend/services/auth/playerAuth.js`, `backend/config/db.js`, `backend/config/mailer.js`, `backend/routes/adminRoutes.js`, `backend/controllers/*.js`, `backend/.env.example`, `backend/.env.production.example`, `mobile_frontend/src/admin/pages/AdminLoginPage.tsx`, `mobile_frontend/src/admin/services/adminApi.ts`, `mobile_frontend/src/components/admin/DualAdminSecurityModal.tsx`, `mobile_frontend/src/admin/components/AdminSidebar.tsx`, `mobile_frontend/src/admin/components/AdminTopbar.tsx`, `mobile_frontend/src/admin/pages/UsersPage.tsx`, `mobile_frontend/src/screens/admin/AdminDashboardScreen.tsx`, `mobile_frontend/src/screens/scorer/ScorerAuthScreen.tsx`, `backend/tests/runTests.js`
- **Phase B (Authz, CORS, Headers, Sockets)**: `backend/middleware/authMiddleware.js`, `backend/middleware/securityMiddleware.js`, `backend/server.js`, `backend/services/socketService.js`, `docs/ROUTE_AUTH_MATRIX.md`, `backend/tests/test_security_audit.js`
- **Phase C & D (Logic, Readiness, Backups)**: `backend/server.js` (`/api/ready`), `scripts/backup-mongo.sh`, `scripts/restore-mongo.sh`, `scripts/check-unbounded.js`, `scripts/unbounded-whitelist.json`
- **Phase E (Frontend & Nginx)**: `mobile_frontend/nginx.conf`, `mobile_frontend/src/services/api.ts`, `mobile_frontend/src/admin/components/TournamentManagement.tsx`, removed unused `mobile_frontend/public/script.js`
- **Phase G & H (Docker, Docs, Gate)**: `docker-compose.prod.yml`, `backend/Dockerfile`, `mobile_frontend/Dockerfile`, `.env.prod.example`, `PRODUCTION_CHECKLIST.md`, `README.md`, `scripts/check-route-auth.js`, `scripts/preflight.sh`, `KNOWN_LIMITATIONS.md`, `PREFLIGHT_REPORT.md`

## 5. Known Limitations
See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) (`npm audit` offline DNS failure, Playwright/Lighthouse not installed locally, `docker compose` CLI plugin absent locally, standalone local MongoDB without `--replSet rs0`).

## 6. Phase Summary Table
| Phase | Status | Notes |
|---|---|---|
| Phase A — Authentication & Secrets | Done | Removed client/server hardcoded bypasses, plaintext `current_password` schema fields, hardcoded emails, and account-enumeration 404s; all backend auth tests pass |
| Phase B — Authorization, Input & Data Exposure | Done | Fixed `requireUmpireAuth` SCORER leak, locked CORS to `ALLOWED_ORIGINS` in prod, enabled Helmet CSP & `/uploads` `nosniff`, hardened Socket.IO, generated `docs/ROUTE_AUTH_MATRIX.md` |
| Phase C — Cricket Logic & Data Integrity | Done | Verified `test_cricket_rules_engine.js` (24/24) and `test_cricket_logic_fixes.js` (6/6) |
| Phase D — Backend Performance & Reliability | Partial | Added `/api/ready`, `check-unbounded.js`, and `backup-mongo.sh`/`restore-mongo.sh`; local Mongo is standalone (no replica set) |
| Phase E — Frontend Performance & Nginx | Partial | Fixed TS error, removed `public/script.js` & hardcoded Render URL, hardened `nginx.conf`, verified `expo export -p web`; Lighthouse not run locally |
| Phase F — Responsive & Accessibility | Partial | `tsc` & `expo lint` pass; Playwright cross-browser & responsive script not run locally (see `KNOWN_LIMITATIONS.md`) |
| Phase G — Production Config & Deployment | Done | Hardened `docker-compose.prod.yml` (required env vars, `no-new-privileges`), pinned Dockerfile versions, added `.env.prod.example`, cleaned docs |
| Phase H — Preflight Gate | Done | `bash scripts/preflight.sh` exited `0` (`PASS=11 FAIL=0`) |

