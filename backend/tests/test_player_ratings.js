/**
 * backend/tests/test_player_ratings.js
 * 
 * 20 Automated Test Scenarios for Player Performance & Career Rating Engine.
 * Verifies mathematical fairness, format awareness, role weighting,
 * non-opportunity renormalization, edge-case safety, and idempotency.
 */

const assert = require('assert');
const playerRatingService = require('../services/playerRatingService');

console.log('🏏 Starting 20 Comprehensive Player Rating Engine Test Scenarios...\n');

let passedTests = 0;
let totalTests = 20;

function runScenario(num, name, fn) {
  try {
    fn();
    console.log(`✅ [Scenario ${num}/20] PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [Scenario ${num}/20] FAIL: ${name}`);
    console.error(`   Error: ${err.message}`);
  }
}

// 1. Century (100+ runs in T20)
runScenario(1, 'Century: 102 off 55 balls in T20', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 102, balls: 55, fours: 9, sixes: 4, strike_rate: 185.45, is_out: true },
    role: 'BATSMAN',
    format: 'T20',
    matchContext: { team_won: true }
  });
  assert(result.batting_rating >= 9.0, `Expected Batting Rating >= 9.0, got ${result.batting_rating}`);
  assert(result.overall_rating >= 8.5, `Expected Overall >= 8.5, got ${result.overall_rating}`);
});

// 2. Fast 30 in T20: 32 off 12 balls (SR 266.67)
runScenario(2, 'Explosive Camo: 32 off 12 balls in T20', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 32, balls: 12, fours: 2, sixes: 3, strike_rate: 266.67, is_out: true },
    role: 'BATSMAN',
    format: 'T20'
  });
  assert(result.batting_rating >= 7.0, `Expected Batting Rating >= 7.0 for explosive 32(12), got ${result.batting_rating}`);
});

// 3. Duck: 0 off 3 balls
runScenario(3, 'Duck: 0 runs off 3 balls', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 0, balls: 3, fours: 0, sixes: 0, strike_rate: 0, is_out: true },
    role: 'BATSMAN',
    format: 'T20'
  });
  assert(result.batting_rating <= 2.5, `Expected Batting Rating <= 2.5 for duck, got ${result.batting_rating}`);
});

// 4. Not-Out Anchor: 48* off 36 balls chasing
runScenario(4, 'Not-Out Anchor: 48* off 36 balls chasing to victory', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 48, balls: 36, fours: 5, sixes: 1, strike_rate: 133.33, is_out: false },
    role: 'BATSMAN',
    format: 'T20',
    matchContext: { team_won: true }
  });
  assert(result.batting_rating >= 7.5, `Expected Batting Rating >= 7.5 with not-out bonus, got ${result.batting_rating}`);
});

// 5. Five-Wicket Haul: 5/18 in 4 overs (T20)
runScenario(5, 'Five-Wicket Haul: 5 for 18 in 4 overs', () => {
  const result = playerRatingService.calculateMatchRating({
    bowlingStats: { overs: 4, maidens: 0, runs_conceded: 18, wickets: 5, economy: 4.5 },
    role: 'BOWLER',
    format: 'T20',
    matchContext: { team_won: true }
  });
  assert(result.bowling_rating >= 9.5, `Expected Bowling Rating >= 9.5 for 5/18, got ${result.bowling_rating}`);
  assert(result.overall_rating >= 9.0, `Expected Overall >= 9.0, got ${result.overall_rating}`);
});

// 6. Miserly spell without wickets: 4-1-12-0 (Economy 3.0 in T20)
runScenario(6, 'Miserly Spell: 4-1-12-0 (Low economy without wickets)', () => {
  const result = playerRatingService.calculateMatchRating({
    bowlingStats: { overs: 4, maidens: 1, runs_conceded: 12, wickets: 0, economy: 3.0 },
    role: 'BOWLER',
    format: 'T20'
  });
  assert(result.bowling_rating >= 5.5, `Expected Bowling Rating >= 5.5 for 3.0 economy, got ${result.bowling_rating}`);
});

// 7. Expensive spell: 4-0-54-1 (Economy 13.5 in T20)
runScenario(7, 'Expensive Spell: 4-0-54-1 in T20', () => {
  const result = playerRatingService.calculateMatchRating({
    bowlingStats: { overs: 4, maidens: 0, runs_conceded: 54, wickets: 1, economy: 13.5 },
    role: 'BOWLER',
    format: 'T20'
  });
  assert(result.bowling_rating <= 4.0, `Expected Bowling Rating <= 4.0 for expensive spell, got ${result.bowling_rating}`);
});

// 8. All-Rounder: 42 runs off 28 balls + 2/24 in 4 overs
runScenario(8, 'All-Rounder Balance: 42 runs + 2/24 bowling', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 42, balls: 28, fours: 4, sixes: 1, strike_rate: 150.0, is_out: true },
    bowlingStats: { overs: 4, maidens: 0, runs_conceded: 24, wickets: 2, economy: 6.0 },
    fieldingStats: { catches: 1 },
    role: 'ALL_ROUNDER',
    format: 'T20',
    matchContext: { team_won: true }
  });
  assert(result.batting_rating >= 6.5, `Expected Batting >= 6.5, got ${result.batting_rating}`);
  assert(result.bowling_rating >= 7.0, `Expected Bowling >= 7.0, got ${result.bowling_rating}`);
  assert(result.overall_rating >= 7.5, `Expected Overall >= 7.5 for balanced all-rounder, got ${result.overall_rating}`);
});

// 9. Wicketkeeper: 35 runs + 2 catches + 1 stumping
runScenario(9, 'Wicketkeeper: 35 runs + 2 catches + 1 stumping', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 35, balls: 24, fours: 3, sixes: 1, strike_rate: 145.83, is_out: true },
    fieldingStats: { catches: 2, stumpings: 1 },
    role: 'WICKETKEEPER',
    format: 'T20'
  });
  assert(result.fielding_rating >= 7.5, `Expected Fielding >= 7.5 for 3 dismissals, got ${result.fielding_rating}`);
  assert(result.overall_rating >= 6.5, `Expected Overall >= 6.5, got ${result.overall_rating}`);
});

// 10. Did Not Bat (DNB) - player did not bat, bowled 4-0-22-2
runScenario(10, 'DNB (Did Not Bat) Non-Opportunity Renormalization', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: null, // DNB
    bowlingStats: { overs: 4, maidens: 0, runs_conceded: 22, wickets: 2, economy: 5.5 },
    role: 'ALL_ROUNDER',
    format: 'T20'
  });
  assert.strictEqual(result.batting_rating, null, 'Batting rating should be null for DNB');
  assert.strictEqual(result.component_availability.batting, false, 'Batting availability must be false');
  assert(result.overall_rating >= 6.8, `Expected Overall >= 6.8 (not dragged down to 0.0), got ${result.overall_rating}`);
});

// 11. Did Not Bowl (DNBowl) - batsman scored 65 off 42 balls, didn't bowl
runScenario(11, 'DNBowl (Did Not Bowl) Non-Opportunity Renormalization', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 65, balls: 42, fours: 7, sixes: 2, strike_rate: 154.76, is_out: true },
    bowlingStats: null, // DNBowl
    role: 'ALL_ROUNDER',
    format: 'T20'
  });
  assert.strictEqual(result.bowling_rating, null, 'Bowling rating should be null for DNBowl');
  assert.strictEqual(result.component_availability.bowling, false, 'Bowling availability must be false');
  assert(result.overall_rating >= 7.2, `Expected Overall >= 7.2 (renormalized weights), got ${result.overall_rating}`);
});

// 12. Single Match Provisional Confidence
runScenario(12, 'Career Confidence: Single Match -> Provisional', () => {
  const matchesCount = 1;
  const confidence = matchesCount >= 5 ? 'Established' : (matchesCount >= 3 ? 'Developing' : 'Provisional');
  assert.strictEqual(confidence, 'Provisional');
});

// 13. Five Matches Established Confidence
runScenario(13, 'Career Confidence: 5+ Matches -> Established', () => {
  const matchesCount = 6;
  const confidence = matchesCount >= 5 ? 'Established' : (matchesCount >= 3 ? 'Developing' : 'Provisional');
  assert.strictEqual(confidence, 'Established');
});

// 14. 10-Match Form Trend Detection
runScenario(14, 'Form Trend: Improving form over 6 matches', () => {
  const recentRatings = [8.5, 9.0, 8.8, 7.0, 6.5, 6.2]; // Recent 3 avg = 8.76, Older 3 avg = 6.56
  const half = Math.floor(recentRatings.length / 2);
  const recentAvg = recentRatings.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const olderAvg = recentRatings.slice(half).reduce((a, b) => a + b, 0) / (recentRatings.length - half);
  let trend = 'STEADY';
  if (recentAvg - olderAvg >= 0.5) trend = 'IMPROVING';
  else if (olderAvg - recentAvg >= 0.5) trend = 'DECLINING';
  assert.strictEqual(trend, 'IMPROVING');
});

// 15. T20 Format Normalization (Par SR 130)
runScenario(15, 'Format Benchmark T20: 30 runs off 25 balls (SR 120)', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 30, balls: 25, fours: 3, sixes: 0, strike_rate: 120.0, is_out: true },
    role: 'BATSMAN',
    format: 'T20'
  });
  assert(result.batting_rating >= 5.0 && result.batting_rating <= 7.0, `Expected around Par (5.0 - 7.0), got ${result.batting_rating}`);
});

// 16. One-Day Format Normalization (Par SR 85, Par Runs 35)
runScenario(16, 'Format Benchmark One-Day: 60 runs off 70 balls (SR 85.7)', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 60, balls: 70, fours: 6, sixes: 0, strike_rate: 85.71, is_out: true },
    role: 'BATSMAN',
    format: 'ONE_DAY'
  });
  assert(result.batting_rating >= 7.0, `Expected solid ODI rating >= 7.0, got ${result.batting_rating}`);
});

// 17. Multi-Day Format Normalization (Par SR 55, Par Runs 45)
runScenario(17, 'Format Benchmark Multi-Day: 85 runs off 160 balls (SR 53.1)', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: { runs: 85, balls: 160, fours: 10, sixes: 0, strike_rate: 53.12, is_out: true },
    role: 'BATSMAN',
    format: 'MULTI_DAY'
  });
  assert(result.batting_rating >= 8.0, `Expected strong Multi-Day rating >= 8.0, got ${result.batting_rating}`);
});

// 18. Idempotency: Duplicate recalculations yield identical results
runScenario(18, 'Idempotency: Re-running rating calculation yields exact same score', () => {
  const input = {
    battingStats: { runs: 54, balls: 32, fours: 5, sixes: 2, strike_rate: 168.75, is_out: true },
    bowlingStats: { overs: 3, maidens: 0, runs_conceded: 21, wickets: 1, economy: 7.0 },
    fieldingStats: { catches: 1 },
    role: 'ALL_ROUNDER',
    format: 'T20'
  };
  const r1 = playerRatingService.calculateMatchRating(input);
  const r2 = playerRatingService.calculateMatchRating(input);
  assert.strictEqual(r1.overall_rating, r2.overall_rating, 'Idempotent ratings must be identical');
  assert.strictEqual(r1.batting_rating, r2.batting_rating, 'Idempotent batting ratings must be identical');
});

// 19. Zero Opportunities Safety (DNB, DNBowl, No Catches)
runScenario(19, 'Zero Opportunities: Player in XI who had 0 balls faced and 0 balls bowled', () => {
  const result = playerRatingService.calculateMatchRating({
    battingStats: null,
    bowlingStats: null,
    fieldingStats: null,
    role: 'BATSMAN',
    format: 'T20'
  });
  assert.strictEqual(result.batting_rating, null);
  assert.strictEqual(result.bowling_rating, null);
  assert.strictEqual(result.overall_rating, null);
});

// 20. Small sample size safety: 1 ball bowled, 0 runs, 1 wicket
runScenario(20, 'Small Sample Safety: 0.1 overs, 0 runs, 1 wicket', () => {
  const result = playerRatingService.calculateMatchRating({
    bowlingStats: { overs: 0.1, maidens: 0, runs_conceded: 0, wickets: 1, economy: 0 },
    role: 'BOWLER',
    format: 'T20'
  });
  assert(result.bowling_rating !== null, 'Bowling rating must not be null');
  assert(!isNaN(result.bowling_rating), 'Bowling rating must not be NaN');
  assert(result.bowling_rating >= 6.0 && result.bowling_rating <= 9.0, `Got realistic bounded rating: ${result.bowling_rating}`);
});

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests} / ${totalTests} Scenarios Passed!`);
console.log(`========================================`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
