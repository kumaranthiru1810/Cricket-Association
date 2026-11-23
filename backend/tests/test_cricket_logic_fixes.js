/**
 * tests/test_cricket_logic_fixes.js
 * Verification suite for the 6 Cricket Logic Bug Fixes
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const db = require('../config/db');
const scoringEngine = require('../services/scoringEngine');
const tournamentService = require('../services/tournamentService');

async function runCricketLogicTests() {
  console.log('==================================================');
  console.log('🏏 RUNNING CRICKET LOGIC AUDIT TESTS');
  console.log('==================================================\n');

  await db.initDb();

  const runId = Date.now();
  const team1Id = 'TM-NRR-1-' + runId;
  const team2Id = 'TM-NRR-2-' + runId;

  const tourneyId = 'TRN-TEST-NRR-' + runId;
  await db.models.Tournament.create({
    id: tourneyId,
    name: 'NRR Test Cup',
    overs_per_match: 20,
    status: 'ACTIVE',
    teams: [team1Id, team2Id]
  });

  // Match 1: Completed (Team 1 scored 160 in 20 ov, Team 2 scored 140 in 20 ov)
  const match1Id = 'M-NRR-1-' + runId;
  await db.models.Match.create({
    id: match1Id,
    tournament_id: tourneyId,
    team_a_id: team1Id,
    team_b_id: team2Id,
    team_a_name: 'Strikers',
    team_b_name: 'Warriors',
    status: 'COMPLETED',
    winner_id: team1Id,
    overs_per_side: 20,
    result_summary: 'Strikers won by 20 runs'
  });
  await db.models.Innings.create({
    id: 'INN-M1-1-' + runId,
    match_id: match1Id,
    innings_number: 1,
    batting_team_id: team1Id,
    bowling_team_id: team2Id,
    total_runs: 160,
    overs: 20,
    balls: 0,
    wickets: 5,
    status: 'COMPLETED',
    is_completed: true
  });
  await db.models.Innings.create({
    id: 'INN-M1-2-' + runId,
    match_id: match1Id,
    innings_number: 2,
    batting_team_id: team2Id,
    bowling_team_id: team1Id,
    total_runs: 140,
    overs: 20,
    balls: 0,
    wickets: 7,
    status: 'COMPLETED',
    is_completed: true
  });

  // Match 2: Abandoned / No Result (Team 1 scored 80 in 8 overs before rain washed it out)
  const match2Id = 'M-NRR-2-' + runId;
  await db.models.Match.create({
    id: match2Id,
    tournament_id: tourneyId,
    team_a_id: team1Id,
    team_b_id: team2Id,
    team_a_name: 'Strikers',
    team_b_name: 'Warriors',
    status: 'COMPLETED',
    winner_id: 'NO_RESULT',
    overs_per_side: 20,
    result_summary: 'Match Abandoned due to rain'
  });
  await db.models.Innings.create({
    id: 'INN-M2-1-' + runId,
    match_id: match2Id,
    innings_number: 1,
    batting_team_id: team1Id,
    bowling_team_id: team2Id,
    total_runs: 80,
    overs: 8,
    balls: 0,
    wickets: 1,
    status: 'COMPLETED',
    is_completed: true
  });

  const table = await tournamentService.getPointsTable(tourneyId);
  const t1Row = table.find(r => r.team_id === team1Id);

  // In real cricket, Match 2 should be excluded from NRR tallies!
  // Team 1 runs_scored must be 160, NOT 240 (160 + 80).
  assert.strictEqual(t1Row.runs_scored, 160, 'NRR must exclude runs from abandoned / no-result match');
  assert.strictEqual(t1Row.overs_faced, 20, 'NRR must exclude overs from abandoned / no-result match');
  console.log('✅ PASS: Bug 1: NRR strictly excludes runs and overs from No-Result / Abandoned matches');

  // -------------------------------------------------------------------------
  // TEST 2: Winner determination by winner_id & team name overlap protection
  // -------------------------------------------------------------------------
  const teamSpartans = 'TM-SPARTANS';
  const teamSpartansXI = 'TM-SPARTANS-XI';

  const tourneyOverlapId = 'TRN-OVERLAP-' + Date.now();
  await db.models.Tournament.create({
    id: tourneyOverlapId,
    name: 'Overlap Cup',
    overs_per_match: 20,
    teams: [teamSpartans, teamSpartansXI]
  });

  const matchOverlapId = 'M-OVERLAP-' + Date.now();
  await db.models.Match.create({
    id: matchOverlapId,
    tournament_id: tourneyOverlapId,
    team_a_id: teamSpartans,
    team_b_id: teamSpartansXI,
    team_a_name: 'Spartans',
    team_b_name: 'Spartans XI',
    status: 'COMPLETED',
    winner_id: teamSpartansXI,
    result_summary: 'Spartans XI won by 4 wickets'
  });

  const standingsOverlap = await tournamentService.getPointsTable(tourneyOverlapId);
  const spartansXIRow = standingsOverlap.find(r => r.team_id === teamSpartansXI);
  const spartansRow = standingsOverlap.find(r => r.team_id === teamSpartans);

  assert.strictEqual(spartansXIRow.won, 1, 'Spartans XI must be registered as the winner');
  assert.strictEqual(spartansRow.lost, 1, 'Spartans must be registered as the loser');
  console.log('✅ PASS: Bug 2: Winner determination uses winner_id and avoids substring confusion between overlapping team names');

  // -------------------------------------------------------------------------
  // TEST 3: DLS / Revised Target NRR Adjustment
  // -------------------------------------------------------------------------
  const tourneyDlsId = 'TRN-DLS-' + runId;
  await db.models.Tournament.create({
    id: tourneyDlsId,
    name: 'DLS Test Cup',
    overs_per_match: 20,
    teams: ['TM-DLS-A-' + runId, 'TM-DLS-B-' + runId]
  });

  const matchDlsId = 'M-DLS-1-' + runId;
  // Team A scored 180 in 20 ov. Rain reduced Team B's chase to 12 overs with revised target 120.
  // Team B scored 124 in 11.2 overs and won.
  await db.models.Match.create({
    id: matchDlsId,
    tournament_id: tourneyDlsId,
    team_a_id: 'TM-DLS-A-' + runId,
    team_b_id: 'TM-DLS-B-' + runId,
    team_a_name: 'Team A',
    team_b_name: 'Team B',
    status: 'COMPLETED',
    winner_id: 'TM-DLS-B-' + runId,
    overs_per_side: 20,
    revised_overs: 12,
    revised_target: 120,
    result_summary: 'Team B won by 5 wickets (DLS Method)'
  });
  await db.models.Innings.create({
    id: 'INN-DLS-1-' + runId,
    match_id: matchDlsId,
    innings_number: 1,
    batting_team_id: 'TM-DLS-A-' + runId,
    bowling_team_id: 'TM-DLS-B-' + runId,
    total_runs: 180,
    overs: 20,
    balls: 0,
    wickets: 4,
    is_completed: true
  });
  await db.models.Innings.create({
    id: 'INN-DLS-2-' + runId,
    match_id: matchDlsId,
    innings_number: 2,
    batting_team_id: 'TM-DLS-B-' + runId,
    bowling_team_id: 'TM-DLS-A-' + runId,
    total_runs: 124,
    overs: 11,
    balls: 2,
    wickets: 5,
    is_completed: true
  });

  const dlsStandings = await tournamentService.getPointsTable(tourneyDlsId);
  const teamARow = dlsStandings.find(r => r.team_id === 'TM-DLS-A-' + runId);
  // In official DLS NRR rules: Team A runs = revised_target - 1 = 119; overs = revised_overs = 12
  assert.strictEqual(teamARow.runs_scored, 119, 'DLS NRR adjustment must credit Team 1 with revised_target - 1');
  assert.strictEqual(teamARow.overs_faced, 12, 'DLS NRR adjustment must credit Team 1 with revised_overs quota');
  console.log('✅ PASS: Bug 3: DLS / Revised Target NRR properly adjusts Team 1 runs and overs quota');

  // -------------------------------------------------------------------------
  // TEST 4: Wide + run (odd) strike rotation
  // -------------------------------------------------------------------------
  const matchWideId = 'M-WIDE-' + Date.now();
  await db.models.Match.create({
    id: matchWideId,
    team_a_id: 'TM-W1',
    team_b_id: 'TM-W2',
    status: 'LIVE',
    overs_per_side: 20
  });
  const innWide = await db.models.Innings.create({
    id: 'INN-' + matchWideId + '-1',
    match_id: matchWideId,
    innings_number: 1,
    batting_team_id: 'TM-W1',
    bowling_team_id: 'TM-W2',
    total_runs: 0,
    overs: 0,
    balls: 0,
    wickets: 0,
    current_striker_id: 'BATTER-1',
    current_non_striker_id: 'BATTER-2',
    current_bowler_id: 'BOWLER-1'
  });

  // Record 1 Wide + 1 run ran (total runsExtras = 2)
  await scoringEngine.recordDelivery(matchWideId, {
    strikerId: 'BATTER-1',
    nonStrikerId: 'BATTER-2',
    bowlerId: 'BOWLER-1',
    runsBatter: 0,
    runsExtras: 2,
    extraType: 'WIDE'
  }, 'SCR-101');

  const updatedInnWide = await db.models.Innings.findOne({ id: innWide.id });
  // Since batters completed 1 run between wickets on the wide, strike must have rotated to BATTER-2!
  assert.strictEqual(updatedInnWide.current_striker_id, 'BATTER-2', 'Strike must rotate to non-striker on Wide + 1 run');
  assert.strictEqual(updatedInnWide.current_non_striker_id, 'BATTER-1');
  console.log('✅ PASS: Bug 4: Wide + odd runs ran rotates strike correctly');

  // -------------------------------------------------------------------------
  // TEST 5: All Out based on squad size (squad size 8 -> 7 wickets)
  // -------------------------------------------------------------------------
  const matchAllOutId = 'M-ALLOUT-' + Date.now();
  await db.models.Match.create({
    id: matchAllOutId,
    team_a_id: 'TM-SQUAD8',
    team_b_id: 'TM-B',
    team_a_playing_xi: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'], // 8 players
    status: 'LIVE',
    overs_per_side: 20
  });
  const innAllOut = await db.models.Innings.create({
    id: 'INN-' + matchAllOutId + '-1',
    match_id: matchAllOutId,
    innings_number: 1,
    batting_team_id: 'TM-SQUAD8',
    bowling_team_id: 'TM-B',
    total_runs: 50,
    overs: 10,
    balls: 0,
    wickets: 6, // 6 wickets already down
    current_striker_id: 'P7',
    current_non_striker_id: 'P8',
    current_bowler_id: 'BOWLER-1'
  });

  // 7th wicket falls (all out for an 8-player squad)
  await scoringEngine.recordDelivery(matchAllOutId, {
    strikerId: 'P7',
    nonStrikerId: 'P8',
    bowlerId: 'BOWLER-1',
    runsBatter: 0,
    runsExtras: 0,
    wicket: true,
    wicketType: 'BOWLED'
  }, 'SCR-101');

  const finalInnAllOut = await db.models.Innings.findOne({ id: innAllOut.id });
  const finalMatchAllOut = await db.models.Match.findOne({ id: matchAllOutId });
  assert.strictEqual(finalInnAllOut.wickets, 7);
  assert.strictEqual(finalInnAllOut.is_completed, true, 'Innings must be marked completed when 7th wicket falls for 8-player squad');
  assert.strictEqual(finalMatchAllOut.status, 'INNINGS_BREAK', 'Match transitions to INNINGS_BREAK on all out');
  console.log('✅ PASS: Bug 5: Squad size - 1 correctly used for All Out in local/village matches');

  // -------------------------------------------------------------------------
  // TEST 6: Scoring Concurrency Queuing
  // -------------------------------------------------------------------------
  const { acquireMatchLock } = require('../middleware/concurrencyLock');
  const EventEmitter = require('events');

  const matchLockId = 'M-LOCK-' + Date.now();
  await db.models.Match.create({
    id: matchLockId,
    team_a_id: 'TM-1',
    team_b_id: 'TM-2',
    status: 'LIVE',
    overs_per_side: 20
  });

  const req1 = { params: { matchId: matchLockId } };
  const res1 = new EventEmitter();
  let next1Called = false;

  const req2 = { params: { matchId: matchLockId } };
  const res2 = new EventEmitter();
  let next2Called = false;

  // Request 1 acquires lock
  await new Promise(resolve => {
    acquireMatchLock(req1, res1, () => {
      next1Called = true;
      resolve();
    });
  });
  assert.strictEqual(next1Called, true, 'Request 1 must acquire lock immediately');

  // Request 2 arrives while Request 1 is still processing (in-flight)
  let req2Promise = new Promise(resolve => {
    acquireMatchLock(req2, res2, () => {
      next2Called = true;
      resolve();
    });
  });

  // Short delay simulating in-flight processing, then Request 1 finishes
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(next2Called, false, 'Request 2 must wait in queue while Request 1 is in-flight');

  // Finish Request 1
  res1.emit('finish');

  // Request 2 should now automatically dequeue and proceed!
  await req2Promise;
  assert.strictEqual(next2Called, true, 'Request 2 must successfully acquire lock after Request 1 finishes');

  res2.emit('finish');
  console.log('✅ PASS: Bug 6: Scoring concurrency queues concurrent requests and avoids false 409 conflicts');

  // Clean up all temporary test records so they never persist in the database
  try {
    await db.models.Match.deleteMany({ id: { $regex: /^(M-NRR|M-OVERLAP|M-DLS|M-WIDE|M-ALLOUT|M-LOCK)/ } });
    await db.models.Innings.deleteMany({ id: { $regex: /^(INN-M1|INN-OVERLAP|INN-DLS|INN-WIDE|INN-ALLOUT)/ } });
    await db.models.Tournament.deleteMany({ id: { $regex: /^TRN-TEST/ } });
  } catch (_cleanErr) {}

  console.log('\n==================================================');
  console.log('🎉 ALL 6 CRICKET LOGIC AUDIT TESTS PASSED');
  console.log('==================================================\n');
  process.exit(0);
}

runCricketLogicTests().catch(err => {
  console.error('❌ Cricket Logic Audit Test Failed:', err);
  process.exit(1);
});
