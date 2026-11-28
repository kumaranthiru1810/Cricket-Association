# Changelog

## [Unreleased] - 2026-11-28
- **Rating Engine Refinements & Easy-English Guide**: Added batting qualification threshold (`>= 6` balls, `>= 10` runs, or dismissed), multi-innings `parRuns` scaling (`innings_batted`), bowler dot-ball calculation counting byes/leg-byes as dots, `raw avg X (provisional)` display under 5 matches, hand-calculated unit tests (`40(25)` & `4-0-28-2`), and a clear 6-step easy-English "How Player Ratings Work" modal.
- **Rating Engine Upgrades**: Added per-match role inference, additive fielding bonus (`+0.3/+0.4/+0.6`, cap `+1.0`), overs-scaled benchmarks & `parRuns`-relative milestones, `Delivery` dot-ball aggregation, match-innings team-win lookup (no bonus on ties/NR), Bayesian career shrinkage (`k=3`), leaderboard min 3 matches, `T10`/`CUSTOM` buckets, expandable match breakdown, "How ratings work" modal, and `backend/scripts/calibrate-benchmarks.js`.
- **Dynamic Player Ratings & Career Stats**: Removed all hardcoded rating fallbacks (`7.5`, `7.8 ★`, `7.2 ★`, `8.0 ★`, `_fallbackLeaderboard`) from Player Dashboard, Scorecard, and backend rating service.
- **Background Rating Queue & Reconciliation**: Added non-blocking `enqueueMatchRatingRecalculation(matchId)`, batch `$in` player lookups, dismissal-only delivery queries, denormalized `Player.stats` sync, `"Your rating was updated"` notifications, 60-second career-ratings caching, and nightly reconciliation (`docs/RATING_METHOD.md`).
- **Camera-Captured Printed Passport Photo Cropping**: Added interactive 4-corner perspective warp & rotation cropper (`PassportPhotoCropperModal`) and `backend/config/photoVerification.js`.


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
