# Changelog - Production Readiness and Scalability Optimization

All notable changes made to the Cricket Association Management & Live Scoring project are documented in this file.

## Phase 1: Security Blockers & Hardening
- `backend/config/env.js`: Created centralized environment variable validation module enforcing JWT_SECRET strength (minimum 32 characters, rejecting default placeholders), database URIs, allowed CORS origins, and initial production admin credentials.
- `backend/config/db.js`: Prevented automatic seeding of default password "1234" in production (`NODE_ENV === 'production'`). Allowed initial super administrator provisioning strictly via `ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD`. Demo users are restricted to development and test environments.
- `backend/middleware/authMiddleware.js`: Swapped all `NODE_ENV !== 'production'` dev bypasses to strictly `process.env.NODE_ENV === 'development'`. Enforced authenticated admin session verification for master-settings and ratings recalculation.
- `backend/middleware/securityMiddleware.js`: Stripped dev bypass headers (`x-user-role`, `x-user-email`, `x-user-id`, `role`, `user-email`, `scorer-id`) from CORS `allowedHeaders`. Enforced strict origin checks.
- `backend/.env.example`: Removed leaked SMTP credentials and hardcoded password defaults. Set `DEV_ADMIN_BYPASS=false`.

## Phase 2: Cricket Logic Audit & Integrity
- `backend/services/scoringEngine.js`: Fixed strike rotation for wide and extras when odd runs are run. Implemented dynamic squad size minus 1 calculation for local match all-out determination. Ensured consistent `winner_id` assignments on match conclusion. Added concurrency request queuing and database-level locking.
- `backend/services/tournamentService.js`: Corrected Net Run Rate (NRR) calculation to strictly exclude abandoned and no-result matches. Added DLS revised target and revised overs normalization for fair NRR tracking. Fixed winner lookup by utilizing `winner_id` instead of substring matching.

## Phase 3: Backend Speed & Scalability
- `backend/server.js`:
  - Added `compression` middleware (gzip/brotli) placed before routes, skipping Socket.IO connections.
  - Configured static `/uploads` serving with 30-day public cache headers (`Cache-Control: public, max-age=2592000, immutable`) and ETag generation.
  - Implemented `GET /api/health` with active MongoDB ping connectivity verification, returning 503 if the database is unreachable.
  - Added graceful shutdown handling on `SIGTERM` and `SIGINT` signals, draining incoming requests, closing HTTP/WebSocket listeners, and disconnecting MongoDB cleanly.
  - Added structured request logging with Morgan, skipping high-frequency health checks.
- `backend/config/db.js`:
  - Configured production connection pool: `maxPoolSize: 20`, `minPoolSize: 5`, `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS: 45000`, and `autoIndex: false`.
  - Added connection lifecycle listeners for automatic reconnect and disconnect monitoring.
  - Removed duplicate index declarations (`unique: true, index: true`).
  - Added startup `ensureIndexes()` routine and compound indexes:
    - `UserSchema`: `{ role: 1, status: 1 }`
    - `MatchSchema`: `{ tournament_id: 1, status: 1 }`, `{ team_a_id: 1, team_b_id: 1 }`, `{ match_date: 1, match_time: 1 }`
    - `InningsSchema`: `{ match_id: 1, innings_number: 1 }`
    - `DeliverySchema`: `{ innings_id: 1, over_number: 1, ball_number: 1 }`, `{ match_id: 1, innings_number: 1 }`
    - `NotificationSchema`: `{ recipient_id: 1, status: 1 }`, `{ status: 1, created_at: -1 }`
    - `NewsSchema`: `{ status: 1, created_at: -1 }`
  - Exported `ping()`, `close()`, and `ensureIndexes()`.
- `backend/middleware/cacheMiddleware.js`:
  - Created lightweight in-memory cache middleware for public GET endpoints with configurable TTL (30-60s) and tag-based invalidation.
  - Strictly bypasses authenticated requests and live-scoring endpoints.
- `backend/middleware/uploadMiddleware.js`:
  - Implemented secure multipart file uploads using `multer` and `sharp`.
  - Enforced 2MB file size limits and validated image magic bytes (JPEG, PNG, WebP) to prevent disguised malicious file uploads.
  - Resized and compressed uploads to max 800px WebP with random crypto filenames.
  - Made upload directory configurable via `UPLOAD_DIR`.
- `backend/config/logger.js`:
  - Created centralized logger with level-based logging and automatic redaction of sensitive credentials (`password`, `otp`, `token`, `aadhaar`, `secret`).
- `backend/services/socketService.js`:
  - Restricted live scoring broadcasts strictly to match-specific rooms (`match:<id>`), removing global `io.emit` broadcasting.
  - Added input validation on `matchId` in `join:match` and `leave:match` events.
  - Bound Socket.IO CORS configuration to application CORS options.
- `backend/routes/portalRoutes.js`:
  - Applied field projection (`.select()`) and `.lean()` across `/home`, `/stats`, `/search`, `/teams/:teamId`, and `/players/:playerId`.
  - Eliminated N+1 queries by querying MongoDB directly via indexed fields instead of loading entire match/player tables.
  - Applied public response caching (30s) to `/home` and `/stats`.
- `backend/controllers/adminDashboardController.js`:
  - Converted `getUsers`, `getPlayers`, `getTeams`, `getMatches`, `getApprovals`, and `getNotifications` to support pagination (`page`, `limit`, `total`, `totalPages`, `data`) with default limit 20 and max 100.
  - Replaced player table in-memory looping in `getTeams` with MongoDB `$group` aggregation.
- `backend/routes/newsRoutes.js`:
  - Added pagination (`page`, `limit`, `total`) and short caching (30s).
  - Added cache invalidation (`invalidateCache('news')`) upon article publishing, updating, or deleting.
- `backend/routes/tournamentRoutes.js` & `backend/routes/cricketLawsRoutes.js`:
  - Added public response caching for points table and cricket laws.
- `backend/routes/playerRoutes.js` & `backend/routes/teamRoutes.js`:
  - Connected `uploadSingle` and `uploadLogo` multipart upload middlewares.
- `backend/services/authService.js`, `backend/config/mailer.js`, `backend/services/adminAccessService.js`:
  - Removed all `console.log` statements outputting raw OTP codes and authorization credentials.
- `backend/tests/test_phase3_speed.js`:
  - Added automated test suite validating health ping, caching headers, compression, and index synchronization.

