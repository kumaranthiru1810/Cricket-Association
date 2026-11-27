# Changelog

## [Unreleased] - Live Scoring & Real-Time Performance Upgrade

### Backend
- **Fast Ball Path (`backend/services/scoring/deliveryService.js`):**
  - Removed `getFullPlayerMap()` full-collection scan from `recordDelivery`; added per-match player cache (TTL 30 min) with projected `$in` queries.
  - Parallelized `Match`, `Innings`, `InningsBatter`, `InningsBowler`, and `Player` reads and parallelized core writes using atomic `findOneAndUpdate`.
  - Replaced extra `Delivery.countDocuments` / `Delivery.find` warning queries with in-innings counters (`bowler_no_balls`, `last_wide_over`, `over_wide_count`, `prev_ball_was_wide`).
  - Added `clientDeliveryId` idempotency support and `Server-Timing` instrumentation (`backend/routes/scorerRoutes.js`).
  - Moved non-critical `tournamentService.onMatchCompleted` to `setImmediate` background execution.
- **Zero-Polling Concurrency Lock (`backend/middleware/concurrencyLock.js`):**
  - Replaced 75ms DB-polling loop with an in-process per-match Promise mutex (DB lock kept for `MULTI_INSTANCE=true`).
- **Indexes (`backend/models/Innings.js`):**
  - Added compound indexes for `InningsBatter { innings_id, player_id }`, `InningsBowler { innings_id, player_id }`, `Delivery { match_id, innings_id, over_number, ball_number }`, and `Delivery { match_id, client_delivery_id }`.
- **Public Real-Time Score (`backend/routes/portalRoutes.js`, `backend/services/socketService.js`):**
  - Added uncached `GET /api/portal/live` endpoint with projected live fields.
  - Invalidated `portal-home` cache on every ball and match mutation.
  - Added public read-only `live` Socket.IO room (`join:live` / `leave:live`) with rate limiting.

### Frontend
- **Scorer Instant Queue (`mobile_frontend/src/screens/scorer/LiveScoringScreen.tsx`):**
  - Replaced global delivery lock with 150ms per-button debounce and an ordered sequential background queue with exponential backoff retries and `clientDeliveryId`.
  - Replaced per-ball `loadLiveState` with delta state updates (full sync only on over/innings change, reconnect, 409 conflict, or 60s interval).
  - Added compact sync status indicator in header (`Syncing (N)` / `Offline (N)`).
- **Public Real-Time Updates (`mobile_frontend/src/services/api.ts`, `mobile_frontend/screens/Home.tsx`, `mobile_frontend/src/screens/scorer/ScorecardScreen.tsx`):**
  - Removed 30s client cache for `/portal/home` in `api.ts`.
  - Subscribed `Home.tsx` to Socket.IO `live` room with 7s `/api/portal/live` fallback polling only while disconnected.
  - Updated `ScorecardScreen.tsx` to display `LIVE • HH:MM:SS` timestamp and 7s disconnected fallback polling.
