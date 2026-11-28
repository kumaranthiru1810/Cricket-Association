/**
 * backend/config/ratingBenchmarks.js
 * Format-specific par benchmarks and role weights for the Player Rating Engine.
 *
 * Each benchmark represents typical club/district-level par performance:
 * - T20: 130 SR, 25 runs/innings, 7.50 RPO economy, 18 balls/wicket (4-over spells)
 * - ONE_DAY (50-over): 85 SR, 35 runs/innings, 5.20 RPO economy, 30 balls/wicket
 * - MULTI_DAY: 55 SR, 45 runs/innings, 3.20 RPO economy, 42 balls/wicket
 * - T10: 160 SR, 18 runs/innings, 9.00 RPO economy, 12 balls/wicket
 * - CUSTOM: balanced default par metrics for non-standard overs
 */

const FORMAT_BENCHMARKS = {
  T20: {
    standardOvers: 20,
    parSR: 130.0,
    parRuns: 25.0,
    parEconomy: 7.50,
    parBallsPerWicket: 18.0
  },
  ONE_DAY: {
    standardOvers: 50,
    parSR: 85.0,
    parRuns: 35.0,
    parEconomy: 5.20,
    parBallsPerWicket: 30.0
  },
  MULTI_DAY: {
    standardOvers: 90,
    parSR: 55.0,
    parRuns: 45.0,
    parEconomy: 3.20,
    parBallsPerWicket: 42.0
  },
  T10: {
    standardOvers: 10,
    parSR: 160.0,
    parRuns: 18.0,
    parEconomy: 9.00,
    parBallsPerWicket: 12.0
  },
  CUSTOM: {
    standardOvers: 20,
    parSR: 120.0,
    parRuns: 25.0,
    parEconomy: 7.50,
    parBallsPerWicket: 20.0
  }
};

const ROLE_WEIGHTS = {
  BATSMAN: { batting: 0.70, bowling: 0.00, fielding: 0.15, impact: 0.15 },
  BOWLER: { batting: 0.00, bowling: 0.70, fielding: 0.15, impact: 0.15 },
  ALL_ROUNDER: { batting: 0.40, bowling: 0.40, fielding: 0.10, impact: 0.10 },
  WICKETKEEPER: { batting: 0.55, bowling: 0.00, fielding: 0.30, impact: 0.15 }
};

const CONFIDENCE_THRESHOLDS = {
  DEVELOPING_MIN_MATCHES: 3,
  ESTABLISHED_MIN_MATCHES: 5
};

module.exports = {
  FORMAT_BENCHMARKS,
  ROLE_WEIGHTS,
  CONFIDENCE_THRESHOLDS
};

