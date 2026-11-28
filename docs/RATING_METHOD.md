# Player Performance & Career Rating Methodology

## Overview
Player ratings are computed **automatically** from verified `COMPLETED` matches only (excluding `ABANDONED`, `NO_RESULT`, and `CANCELLED` matches). Players with `0` completed matches have `null` ratings (`—` in the UI) until their first completed match is evaluated.

## Format Benchmarks (`backend/config/ratingBenchmarks.js`)
Each match is evaluated against par averages for its format, scaled proportionally by `scheduledOvers / standardOvers` for batting `parRuns` and `parBallsPerWicket`:
- **T20** (`standardOvers: 20`): Par SR `130.0`, Par Runs `25.0`, Par Economy `7.50`, Par Balls/Wicket `18.0`
- **ONE_DAY** (`standardOvers: 50`): Par SR `85.0`, Par Runs `35.0`, Par Economy `5.20`, Par Balls/Wicket `30.0`
- **MULTI_DAY** (`standardOvers: 90`): Par SR `55.0`, Par Runs `45.0`, Par Economy `3.20`, Par Balls/Wicket `42.0`
- **T10** (`standardOvers: 10`): Par SR `160.0`, Par Runs `18.0`, Par Economy `9.00`, Par Balls/Wicket `12.0`
- **CUSTOM** (`standardOvers: 20`): Par SR `120.0`, Par Runs `25.0`, Par Economy `7.50`, Par Balls/Wicket `20.0`

Use `node backend/scripts/calibrate-benchmarks.js` to compute median runs, SR, economy, and balls/wicket from completed matches in MongoDB.

## Role Inference, Fielding Bonus & Non-Opportunity Renormalization
- **Batting Qualification Threshold**: Batting counts for role inference and overall weights only if the batter faced `>= 6` balls, scored `>= 10` runs, or was dismissed (`is_out === true`); otherwise it is treated as `DNB`.
- **Multi-Innings Scaling**: In `MULTI_DAY` (or any match where a player bats `2+` innings), `parRuns` is scaled by `innings_batted`.
- **Per-Match Role Inference**: Registered role is a prior only. If a player bats and bowls `>= 2` overs (`12+` legal balls), `ALL_ROUNDER` weights are used; any component actually performed always receives non-zero weight.
- **Additive Fielding Bonus**: Catches (`+0.3`), direct-hit run-outs (`+0.6`), assisted run-outs (`+0.3`), and stumpings (`+0.4`), capped at `+1.0`, are applied after the weighted overall so taking a catch never lowers a player's rating.
- **Economy & Dot Ratio**: Economy score (`5.5 × parEconomy / max(economy, 0.5)`, clamped `1–10`) is weighted by overs bowled; dot-ball ratio is computed from `Delivery` records where `is_legal_delivery: true` and runs charged to the bowler (`runs_batter + wides + no-balls`) equal `0` (so byes and leg-byes count as dots), defaulting to `0.40` only when delivery records are unavailable.
- **Milestone Bonuses**: `2×`, `3×`, `4×`, `6×`, `8×` scaled `parRuns` (`+0.5`, `+0.8`, `+1.0`, `+1.4`, `+1.8`).
- **Bayesian Shrinkage & Leaderboard**: Career overall applies recency weighting (`1.25×` last 5 matches) and Bayesian shrinkage `(n × rawAvg + 3 × leaguePrior) / (n + 3)` (`default prior = 5.5`), returning both `overall_rating` and `raw_overall_rating`. Under 5 matches, the dashboard displays `raw avg X (provisional)`. Public leaderboard requires `>= 3` rated matches.

## Career Aggregation & Confidence Levels
- **Recency Weighting**: The 5 most recent verified matches receive `1.25×` weight vs `1.0×` for older matches.
- **Confidence Calibration**:
  - `0` matches: `No Data`
  - `1–2` matches: `Provisional`
  - `3–4` matches: `Developing`
  - `5+` matches: `Established`

## Recalculation Triggers & Caching
1. **Background Queue (`enqueueMatchRatingRecalculation`)**: Triggered non-blockingly on match completion (`deliveryService`, `inningsService`, `tournamentService`) and on completed-match edit/undo (`undoEditService`).
2. **Idempotent Persistence**: Upserts on unique index `(player_id, match_id)` in `PlayerMatchRating`, syncs denormalized `Player.stats`, and sends a `"Your rating was updated"` notification.
3. **Nightly Reconciliation (`reconcileCompletedMatchRatings`)**: Scans completed matches for missing or stale rating rows every 24 hours.
4. **API Caching**: `GET /api/players/career-ratings` and `GET /api/players/:id/career-ratings` are cached for 60 seconds and invalidated on recalculation.

