/**
 * backend/tests/test_cricket_rules_engine.js
 * Comprehensive automated test suite for Cricket Rules Engine
 */

const assert = require('assert');
const {
  MATCH_FORMAT_RULES,
  oversToBalls,
  ballsToOvers,
  incrementOvers,
  decrementOvers,
  calculateCRR,
  calculateRRR,
  isBowlerWicket,
  isDeliveryLegal,
  calculateBowlerRunsConceded,
  calculateNextStrike,
  canEnforceFollowOn,
  determineMatchResult
} = require('../services/cricketRulesEngine');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failedTests++;
  }
}

console.log('\n==================================================');
console.log('🧪 TESTING CRICKET RULES ENGINE');
console.log('==================================================\n');

// 1. Format Rules
it('T10 format has 10 overs, 2 overs per bowler, powerplay 1-2', () => {
  const t10 = MATCH_FORMAT_RULES.T10;
  assert.strictEqual(t10.maxOversPerInnings, 10);
  assert.strictEqual(t10.maxOversPerBowler, 2);
  assert.strictEqual(t10.powerplayPhases[0].fromOver, 1);
  assert.strictEqual(t10.powerplayPhases[0].toOver, 2);
  assert.strictEqual(t10.freeHitOnNoBall, true);
});

it('T20 format has 20 overs, 4 overs per bowler, powerplay 1-6', () => {
  const t20 = MATCH_FORMAT_RULES.T20;
  assert.strictEqual(t20.maxOversPerInnings, 20);
  assert.strictEqual(t20.maxOversPerBowler, 4);
  assert.strictEqual(t20.powerplayPhases[0].fromOver, 1);
  assert.strictEqual(t20.powerplayPhases[0].toOver, 6);
  assert.strictEqual(t20.freeHitOnNoBall, true);
});

it('ODI format has 50 overs, 10 overs per bowler, 3 powerplay phases', () => {
  const odi = MATCH_FORMAT_RULES.ODI;
  assert.strictEqual(odi.maxOversPerInnings, 50);
  assert.strictEqual(odi.maxOversPerBowler, 10);
  assert.strictEqual(odi.powerplayPhases.length, 3);
  assert.strictEqual(odi.powerplayPhases[0].name.includes('Mandatory'), true);
  assert.strictEqual(odi.powerplayPhases[2].toOver, 50);
});

it('Test Match has unlimited overs, 2 innings per team, follow-on 200 runs', () => {
  const test = MATCH_FORMAT_RULES.TEST;
  assert.strictEqual(test.maxOversPerInnings, null);
  assert.strictEqual(test.maxInningsPerTeam, 2);
  assert.strictEqual(test.enforceFollowOnLead, 200);
  assert.strictEqual(test.allowDeclaration, true);
  assert.strictEqual(test.freeHitOnNoBall, false);
});

// 2. Overs & Balls Calculations
it('oversToBalls correctly converts 4.2 overs to 26 balls', () => {
  assert.strictEqual(oversToBalls(4, 2), 26);
  assert.strictEqual(oversToBalls(0, 0), 0);
  assert.strictEqual(oversToBalls(19, 5), 119);
  assert.strictEqual(oversToBalls(20, 0), 120);
});

it('ballsToOvers correctly converts 26 balls to 4.2 overs', () => {
  const res = ballsToOvers(26);
  assert.strictEqual(res.overs, 4);
  assert.strictEqual(res.balls, 2);
  assert.strictEqual(res.formatted, '4.2');
});

it('incrementOvers: 4.5 + legal delivery -> 5.0 (over complete)', () => {
  const res = incrementOvers(4, 5, true);
  assert.strictEqual(res.overs, 5);
  assert.strictEqual(res.balls, 0);
  assert.strictEqual(res.formatted, '5.0');
  assert.strictEqual(res.isOverComplete, true);
});

it('incrementOvers: 4.2 + wide -> 4.2 (not over complete, extra does not advance legal ball count)', () => {
  const res = incrementOvers(4, 2, false);
  assert.strictEqual(res.overs, 4);
  assert.strictEqual(res.balls, 2);
  assert.strictEqual(res.formatted, '4.2');
  assert.strictEqual(res.isOverComplete, false);
});

it('decrementOvers: undo 5.0 legal delivery rolls back to 4.5', () => {
  const res = decrementOvers(5, 0, true);
  assert.strictEqual(res.overs, 4);
  assert.strictEqual(res.balls, 5);
  assert.strictEqual(res.formatted, '4.5');
});

it('decrementOvers: undo wide delivery retains 4.2 overs', () => {
  const res = decrementOvers(4, 2, false);
  assert.strictEqual(res.overs, 4);
  assert.strictEqual(res.balls, 2);
  assert.strictEqual(res.formatted, '4.2');
});

// 3. Run Rates
it('calculateCRR: 120 runs in 15.0 overs -> 8.00 CRR', () => {
  assert.strictEqual(calculateCRR(120, 15, 0), 8.00);
});

it('calculateRRR: need 48 runs from 30 balls (5.0 overs remaining in T20) -> 9.60 RRR', () => {
  // Target 180, current 132 in 15.0 overs, total limit 20
  const rrr = calculateRRR(180, 132, 20, 15, 0);
  assert.strictEqual(rrr, 9.60);
});

// 4. Extras and Bowler Conceded
it('calculateBowlerRunsConceded: byes/leg-byes do NOT charge bowler', () => {
  assert.strictEqual(calculateBowlerRunsConceded(0, 4, 'BYE'), 0);
  assert.strictEqual(calculateBowlerRunsConceded(0, 1, 'LEG_BYE'), 0);
  assert.strictEqual(calculateBowlerRunsConceded(0, 5, 'PENALTY'), 0);
});

it('calculateBowlerRunsConceded: wides and no-balls charge bowler', () => {
  assert.strictEqual(calculateBowlerRunsConceded(0, 1, 'WIDE'), 1);
  assert.strictEqual(calculateBowlerRunsConceded(4, 1, 'NO_BALL'), 5);
  assert.strictEqual(calculateBowlerRunsConceded(6, 0, 'NONE'), 6);
});

it('isDeliveryLegal: wide and no-ball are not legal', () => {
  assert.strictEqual(isDeliveryLegal('WIDE'), false);
  assert.strictEqual(isDeliveryLegal('NO_BALL'), false);
  assert.strictEqual(isDeliveryLegal('NONE'), true);
  assert.strictEqual(isDeliveryLegal('BYE'), true);
  assert.strictEqual(isDeliveryLegal('LEG_BYE'), true);
});

// 5. Wickets Attribution
it('isBowlerWicket: Bowled, Caught, LBW, Stumped credited to bowler; Run Out is NOT', () => {
  assert.strictEqual(isBowlerWicket('BOWLED'), true);
  assert.strictEqual(isBowlerWicket('CAUGHT'), true);
  assert.strictEqual(isBowlerWicket('LBW'), true);
  assert.strictEqual(isBowlerWicket('STUMPED'), true);
  assert.strictEqual(isBowlerWicket('RUN_OUT'), false);
  assert.strictEqual(isBowlerWicket('RETIRED_OUT'), false);
});

// 6. Strike Rotation
it('calculateNextStrike: 1 run -> strike rotated', () => {
  const next = calculateNextStrike({
    currentStrikerId: 'P1',
    currentNonStrikerId: 'P2',
    runsScoredOffDelivery: 1,
    isOverComplete: false,
    wicket: false
  });
  assert.strictEqual(next.nextStrikerId, 'P2');
  assert.strictEqual(next.nextNonStrikerId, 'P1');
});

it('calculateNextStrike: 2 runs -> striker stays on strike', () => {
  const next = calculateNextStrike({
    currentStrikerId: 'P1',
    currentNonStrikerId: 'P2',
    runsScoredOffDelivery: 2,
    isOverComplete: false,
    wicket: false
  });
  assert.strictEqual(next.nextStrikerId, 'P1');
  assert.strictEqual(next.nextNonStrikerId, 'P2');
});

it('calculateNextStrike: 1 run on 6th ball (end of over) -> P1 returns to strike', () => {
  const next = calculateNextStrike({
    currentStrikerId: 'P1',
    currentNonStrikerId: 'P2',
    runsScoredOffDelivery: 1,
    isOverComplete: true,
    wicket: false
  });
  // 1 run swaps P1 <-> P2 (P2 on strike), then end of over swaps back (P1 on strike for new over)
  assert.strictEqual(next.nextStrikerId, 'P1');
  assert.strictEqual(next.nextNonStrikerId, 'P2');
});

it('calculateNextStrike: MCC 2022 new batter rule on caught wicket takes strike', () => {
  const next = calculateNextStrike({
    currentStrikerId: 'P1',
    currentNonStrikerId: 'P2',
    runsScoredOffDelivery: 0,
    isOverComplete: false,
    wicket: true,
    dismissedPlayerId: 'P1',
    newBatterId: 'P3'
  });
  assert.strictEqual(next.nextStrikerId, 'P3');
  assert.strictEqual(next.nextNonStrikerId, 'P2');
});

// 7. Multi-Day Follow-On Rule
it('canEnforceFollowOn: 5-day Test requires 200 runs lead', () => {
  assert.strictEqual(canEnforceFollowOn(210, 'TEST', 5).canEnforce, true);
  assert.strictEqual(canEnforceFollowOn(195, 'TEST', 5).canEnforce, false);
});

it('canEnforceFollowOn: 3-day Multi-Day requires 150 runs lead', () => {
  assert.strictEqual(canEnforceFollowOn(160, 'MULTI_DAY', 3).canEnforce, true);
  assert.strictEqual(canEnforceFollowOn(140, 'MULTI_DAY', 3).canEnforce, false);
});

// 8. Match Result Determination
it('determineMatchResult: chasing team passes score -> win by wickets', () => {
  const res = determineMatchResult({
    team1Name: 'Spartans',
    team2Name: 'Strikers',
    team1Runs: 150,
    team2Runs: 151,
    team2Wickets: 3,
    isSecondInningsComplete: false,
    maxWickets: 10
  });
  assert.strictEqual(res.winnerTeam, 'Strikers');
  assert.strictEqual(res.resultText, 'Strikers won by 7 wickets');
});

it('determineMatchResult: defending team finishes second innings with higher score -> win by runs', () => {
  const res = determineMatchResult({
    team1Name: 'Spartans',
    team2Name: 'Strikers',
    team1Runs: 180,
    team2Runs: 165,
    team2Wickets: 10,
    isSecondInningsComplete: true,
    maxWickets: 10
  });
  assert.strictEqual(res.winnerTeam, 'Spartans');
  assert.strictEqual(res.resultText, 'Spartans won by 15 runs');
});

console.log(`\nResults: ${passedTests} Passed, ${failedTests} Failed.`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL CRICKET RULES ENGINE TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}
