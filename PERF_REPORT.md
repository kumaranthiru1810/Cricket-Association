# Live Scoring Performance Report

## Environment
- Local MongoDB (`127.0.0.1:27017`)
- Benchmark script: `backend/scripts/bench-delivery.js` (30 sequential deliveries to `POST /api/scorer/matches/:id/deliveries` with 5,000 `Player` documents seeded)

## Before Optimization
- **Per-ball bottlenecks:**
  - `getFullPlayerMap()` loaded the entire `Player` and `TeamRegistration` collections on every ball.
  - `acquireMatchLock` ran MongoDB `findOneAndUpdate` + 75ms polling loop + `updateOne` release on every ball.
  - Sequential reads and `find + modify + save` writes (12–20+ DB round trips per ball).
  - Extra `Delivery.countDocuments` / `Delivery.find` queries for No-Ball & Wide warnings.
  - Frontend blocked taps globally while waiting for HTTP response and called `loadLiveState(false)` after every ball.
- **Measured Latency (30 sequential balls):**
  - Min: `174.68 ms`
  - p50: `228.07 ms`
  - **p95: `327.49 ms`** (above 300 ms target)
  - p99: `337.77 ms`
  - Max: `337.77 ms`

## After Optimization
- **Key improvements:**
  - Replaced `getFullPlayerMap()` with a per-match in-memory cache (TTL 30 min) + single projected `$in` query (`id name role`).
  - Replaced DB-polling lock with an in-process per-match Promise mutex (0ms polling; DB lock retained only for `MULTI_INSTANCE=true`).
  - Parallelized `Match` + `Innings` reads, parallelized `InningsBatter` + `InningsBowler` + `Player` reads, and parallelized atomic `findOneAndUpdate` / `Delivery.create` / `Match.updateOne` writes.
  - Replaced extra `Delivery.countDocuments` / `Delivery.find` warning queries with in-innings counters (`bowler_no_balls`, `over_wide_count`, `prev_ball_was_wide`).
  - Added `clientDeliveryId` idempotency check (in-memory LRU + sparse indexed DB lookup).
  - Added `Server-Timing` header and step-by-step timing breakdown.
  - Frontend (`LiveScoringScreen.tsx`) now uses a 150ms per-button debounce, non-blocking ordered sequential delivery queue, and delta state updates (no `loadLiveState` per ball).
- **Measured Latency (30 sequential balls):**
  - Min: `24.16 ms`
  - p50: `46.39 ms` (**4.9x faster**)
  - **p95: `58.73 ms`** (**5.6x faster**, well under `< 300 ms` target)
  - p99: `127.50 ms`
  - Max: `127.50 ms`
- **Sample `Server-Timing` Header:**
  `idempotency;dur=3.36, read;dur=7.92, players;dur=4.19, writes;dur=14.42, emit;dur=0.16, total;dur=30.68`

## Query Plans (`explain('executionStats')` — No `COLLSCAN`)
- `Delivery` (`{ match_id, innings_id, over_number, ball_number }`): `FETCH -> IXSCAN`
- `InningsBatter` (`{ innings_id, player_id }`): `FETCH -> IXSCAN`
- `InningsBowler` (`{ innings_id, player_id }`): `FETCH -> IXSCAN`
- `Innings` (`{ match_id, innings_number }`): `FETCH -> IXSCAN`
- `Match` (`{ id }`): `FETCH -> IXSCAN`

