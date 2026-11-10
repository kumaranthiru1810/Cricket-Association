process.env.NODE_ENV = 'test';
const userModel = require('../models/userModel');
const crypto = require('crypto');
const { requireAdminAuth, requireScorerAuth } = require('../middleware/authMiddleware');
const otpService = require('../services/otpService');
﻿/**
 * tests/runTests.js
 * Comprehensive automated test suite for Cricket Full-Stack Scorer System
 */

const assert = require('assert');
const authService = require('../services/authService');
const scorerService = require('../services/scorerService');
const scoringEngine = require('../services/scoringEngine');
const matchService = require('../services/matchService');
const db = require('../config/db');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message || err}`);
    if (err.stack) console.error(`     ${err.stack.split('\n')[1]}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('\n==================================================');
  console.log('🏏 RUNNING CRICKET SCORER AUTOMATED TEST SUITE');
  console.log('==================================================\n');

  // Initialize MongoDB for test suite
  await db.initDb();

  // Idempotent test fixture reset before each run
  await db.models.Match.deleteMany({ id: { $nin: ['M001', 'M002', 'M003'] } });
  await db.models.Match.updateOne({ id: 'M001' }, { status: 'SCHEDULED', team_a_id: 'TM-01', team_b_id: 'TM-02', current_innings_number: 1, result_summary: null, assigned_scorer_id: 'SCR-101' });
  await db.models.Match.updateOne({ id: 'M002' }, { status: 'LIVE', team_a_id: 'TM-01', team_b_id: 'TM-02', current_innings_number: 1, result_summary: null, assigned_scorer_id: 'SCR-101' });
  await db.models.Match.updateOne({ id: 'M003' }, { status: 'COMPLETED', team_a_id: 'TM-01', team_b_id: 'TM-02', result_summary: 'Virudhunagar Strikers won by 7 wickets', assigned_scorer_id: 'SCR-101' });
  await db.models.Innings.updateOne({ id: 'INN-M002-1' }, { is_completed: false, is_over_complete: false, wickets: 3, total_runs: 142, overs: 16, balls: 2 });
  await db.models.Innings.deleteOne({ id: 'INN-M002-2' });
  await db.models.Team.updateOne({ id: 'TM-01' }, { name: 'Sattur Spartans' });
  await db.models.Team.updateOne({ id: 'TM-02' }, { name: 'Virudhunagar Strikers' });

  console.log('--- 1. AUTHENTICATION & AUTHORIZATION ---');
  let authToken = null;
  let scorerUser = null;

  await test('CASE 1: Development Admin Login (admin@example.com + 1234) -> Role ADMIN', async () => {
    const res = await authService.verifyOtp('admin@example.com', '1234');
    assert(res.token, 'Token should be returned');
    assert.strictEqual(res.user.role, 'ADMIN');
    assert.strictEqual(res.user.email, 'admin@example.com');
  });

  await test('CASE 2: Normal registered Gmail + correct OTP -> LOGIN SUCCESS (Role: SCORER)', async () => {
    otpService.resetRateLimit('ramesh@gmail.com');
    const reqRes = await authService.requestOtp('ramesh@gmail.com');
    assert.strictEqual(reqRes.success, true);
    assert(!reqRes.otp, 'OTP must NOT be returned in API response');

    // Fetch user from MongoDB to get the generated OTP hash
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', ['ramesh@gmail.com']);
    assert(rows && rows.length > 0, 'User must exist');
    assert(rows[0].otp_hash, 'otp_hash must be set in MongoDB');
    assert(rows[0].otp_expires_at, 'otp_expires_at must be set in MongoDB');

    // Simulate known OTP verification by storing deterministic hash
    const knownOtp = '582910';
    const knownHash = otpService.hashOtp(knownOtp);
    await userModel.updateOtp(rows[0].id, {
      otp_hash: knownHash,
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000)
    });

    const verifyRes = await authService.verifyOtp('ramesh@gmail.com', knownOtp);
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(verifyRes.user.role, 'SCORER');
    assert.strictEqual(verifyRes.user.email, 'ramesh@gmail.com');
    assert(verifyRes.token, 'JWT token must be issued');
    authToken = verifyRes.token;
    scorerUser = verifyRes.user;
  });

  await test('CASE 3: Normal Gmail + wrong OTP -> LOGIN FAILED (401)', async () => {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', ['ramesh@gmail.com']);
    const knownOtp = '771122';
    const knownHash = otpService.hashOtp(knownOtp);
    await userModel.updateOtp(rows[0].id, {
      otp_hash: knownHash,
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000)
    });

    try {
      await authService.verifyOtp('ramesh@gmail.com', '999999'); // wrong OTP
      assert.fail('Should have rejected wrong OTP');
    } catch (err) {
      assert.strictEqual(err.status, 401);
      assert(err.message.toLowerCase().includes('invalid'));
    }
  });

  await test('CASE 4: Normal Gmail + expired OTP -> LOGIN FAILED (401)', async () => {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', ['ramesh@gmail.com']);
    const knownOtp = '334455';
    const knownHash = otpService.hashOtp(knownOtp);
    const pastTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    await userModel.updateOtp(rows[0].id, {
      otp_hash: knownHash,
      otp_expires_at: pastTime
    });

    try {
      await authService.verifyOtp('ramesh@gmail.com', knownOtp);
      assert.fail('Should have rejected expired OTP');
    } catch (err) {
      assert.strictEqual(err.status, 401);
      assert(err.message.toLowerCase().includes('expired'));
    }
  });

  await test('CASE 5: Normal Gmail + old OTP after resend -> LOGIN FAILED (401)', async () => {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', ['ramesh@gmail.com']);
    const oldOtp = '111111';
    const newOtp = '222222';
    const newHash = otpService.hashOtp(newOtp);
    // User requests new OTP, overwriting old OTP in MongoDB
    await userModel.updateOtp(rows[0].id, {
      otp_hash: newHash,
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000)
    });

    try {
      await authService.verifyOtp('ramesh@gmail.com', oldOtp);
      assert.fail('Old OTP should be rejected');
    } catch (err) {
      assert.strictEqual(err.status, 401);
      assert(err.message.toLowerCase().includes('invalid'));
    }
  });

  await test('CASE 6: Unregistered email -> 404 proper error', async () => {
    try {
      await authService.requestOtp('unregistered_scorer_99@test.com');
      assert.fail('Unregistered email should fail');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert(err.message.toLowerCase().includes('not registered') || err.message.toLowerCase().includes('not found'));
    }
  });

  await test('CASE 7: SCORER trying to access ADMIN API -> 403 Forbidden', async () => {
    assert(authToken, 'Scorer token must be present');
    const req = { headers: { 'authorization': `Bearer ${authToken}` } };
    let capturedStatus = null;
    let capturedBody = null;
    const res = {
      status: (s) => {
        capturedStatus = s;
        return { json: (b) => { capturedBody = b; } };
      }
    };
    requireAdminAuth(req, res, () => {});
    assert.strictEqual(capturedStatus, 403, 'Must return HTTP 403 Forbidden for Scorer accessing Admin route');
    assert.strictEqual(capturedBody.success, false);
  });

  await test('CASE 8: Unauthenticated user trying to access scorer API -> 401 Unauthorized', async () => {
    const req = { headers: {} }; // No token
    let capturedStatus = null;
    let capturedBody = null;
    const res = {
      status: (s) => {
        capturedStatus = s;
        return { json: (b) => { capturedBody = b; } };
      }
    };
    requireScorerAuth(req, res, () => {});
    assert.strictEqual(capturedStatus, 401, 'Must return HTTP 401 Unauthorized when token missing');
    assert.strictEqual(capturedBody.success, false);
  });

  await test('Fetch authenticated scorer profile', async () => {
    const profile = await authService.getProfile('SCR-101');
    assert.strictEqual(profile.id, 'SCR-101');
    assert.strictEqual(profile.name, 'S. Ramesh');
  });

  console.log('\n--- 1b. DEDICATED SCORER OTP & SECURITY TESTS ---');

  await test('SCORER TEST 1: POST /api/auth/scorer/send-otp for registered scorer -> OTP stored in DB, no plain OTP in response', async () => {
    otpService.resetRateLimit('scorer@cfvd.org');
    const res = await authService.requestScorerOtp('scorer@cfvd.org');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.message, 'OTP sent successfully');
    assert(!res.otp, 'Plain OTP must NOT be returned');
    assert(!res.devOtp, 'devOtp must NOT be returned');

    const user = await userModel.findByEmail('scorer@cfvd.org');
    assert(user.otp_hash, 'otp_hash must be saved in database');
    assert(user.otp_expires_at, 'otp_expires_at must be saved');
  });

  await test('SCORER TEST 2: POST /api/auth/scorer/send-otp rate limiting cooldown enforcement', async () => {
    try {
      await authService.requestScorerOtp('scorer@cfvd.org');
      assert.fail('Should have been blocked by 30s cooldown rate limit');
    } catch (err) {
      assert.strictEqual(err.status, 429);
      assert(err.message.includes('Please wait') || err.message.includes('attempts'));
    }
    otpService.resetRateLimit('scorer@cfvd.org');
  });

  await test('SCORER TEST 3: POST /api/auth/scorer/send-otp with unregistered email -> 404 Not Found', async () => {
    try {
      await authService.requestScorerOtp('unknown_scorer@example.com');
      assert.fail('Should have rejected unregistered email');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert(err.message.toLowerCase().includes('not found') || err.message.toLowerCase().includes('register'));
    }
  });

  await test('SCORER TEST 4: POST /api/auth/scorer/send-otp with non-scorer role -> 403 Forbidden', async () => {
    try {
      await authService.requestScorerOtp('player@example.com');
      assert.fail('Should have rejected non-scorer role');
    } catch (err) {
      assert.strictEqual(err.status, 403);
      assert(err.message.toLowerCase().includes('not registered as a scorer'));
    }
  });

  await test('SCORER TEST 5: POST /api/auth/scorer/verify-otp with valid OTP -> JWT token & role SCORER', async () => {
    const user = await userModel.findByEmail('scorer@cfvd.org');
    const knownOtp = '654321';
    const knownHash = otpService.hashOtp(knownOtp);
    await userModel.updateOtp(user.id, {
      otp_hash: knownHash,
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      otp_attempts: 0
    });

    const verifyRes = await authService.verifyScorerOtp('scorer@cfvd.org', knownOtp);
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(verifyRes.user.role, 'SCORER');
    assert(verifyRes.token, 'JWT token must be issued');

    // Invalidate check: OTP should be cleared from database after verification
    const refreshed = await userModel.findByEmail('scorer@cfvd.org');
    assert(!refreshed.otp_hash, 'otp_hash must be cleared after verification');
  });

  await test('SCORER TEST 6: POST /api/auth/scorer/verify-otp reusing previously used OTP -> Fails', async () => {
    try {
      await authService.verifyScorerOtp('scorer@cfvd.org', '654321');
      assert.fail('Reused OTP must be rejected');
    } catch (err) {
      assert.strictEqual(err.status, 400);
      assert(err.message.toLowerCase().includes('no active otp') || err.message.toLowerCase().includes('request an otp'));
    }
  });

  await test('SCORER TEST 7: POST /api/auth/scorer/verify-otp with wrong OTP increments attempts', async () => {
    const user = await userModel.findByEmail('scorer@cfvd.org');
    const knownOtp = '345678';
    const knownHash = otpService.hashOtp(knownOtp);
    await userModel.updateOtp(user.id, {
      otp_hash: knownHash,
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      otp_attempts: 0
    });

    try {
      await authService.verifyScorerOtp('scorer@cfvd.org', '999999');
      assert.fail('Should fail on wrong OTP');
    } catch (err) {
      assert.strictEqual(err.status, 400);
      assert(err.message.toLowerCase().includes('invalid otp'));
    }

    const refreshed = await userModel.findByEmail('scorer@cfvd.org');
    assert.strictEqual(refreshed.otp_attempts, 1);
  });

  await test('SCORER TEST 8: POST /api/auth/scorer/verify-otp with expired OTP -> Fails', async () => {
    const user = await userModel.findByEmail('scorer@cfvd.org');
    const knownOtp = '223344';
    const knownHash = otpService.hashOtp(knownOtp);
    await userModel.updateOtp(user.id, {
      otp_hash: knownHash,
      otp_expires_at: new Date(Date.now() - 1000), // Expired 1 second ago
      otp_attempts: 0
    });

    try {
      await authService.verifyScorerOtp('scorer@cfvd.org', knownOtp);
      assert.fail('Should fail on expired OTP');
    } catch (err) {
      assert.strictEqual(err.status, 400);
      assert(err.message.toLowerCase().includes('expired'));
    }
  });

  console.log('\n--- 2. SCORER DASHBOARD & ASSIGNMENTS ---');
  await test('GET /api/scorer/dashboard calculates stats from database', async () => {
    const dashboard = await scorerService.getDashboardStats('SCR-101');
    assert.strictEqual(dashboard.liveMatches, 1, 'Should have 1 live match');
    assert.strictEqual(dashboard.upcomingMatches, 1, 'Should have 1 upcoming match');
    assert.strictEqual(dashboard.completedMatches, 1, 'Should have 1 completed match');
    assert.strictEqual(dashboard.assignedMatches, 3, 'Should have 3 assigned matches');
    assert(dashboard.matches.length >= 3, 'Should list assigned matches');
  });

  console.log('\n--- 3. MATCH LIFECYCLE & SETUP ---');
  await test('Get Match Setup information (teams, squads, venue)', async () => {
    const setup = await matchService.getMatchSetup('M001');
    assert.strictEqual(setup.matchId, 'M001');
    assert(setup.teamA && setup.teamB, 'Teams must be present');
    assert(setup.teamAPlayers.length > 0, 'Team A squad should have players');
    assert(setup.teamBPlayers.length > 0, 'Team B squad should have players');
  });

  await test('Start Match with Toss (transitions SCHEDULED -> LIVE)', async () => {
    const res = await matchService.startMatch('M001', {
      tossWinner: 'T001',
      tossDecision: 'BAT'
    });
    assert(res.success);
    assert.strictEqual(res.battingTeamId, 'T001');
  });

  console.log('\n--- 4. BALL-BY-BALL SCORING ENGINE ---');
  // Use M002 for delivery tests (Live Match)
  const matchId = 'M002';
  const strikerId = 'P301';
  const nonStrikerId = 'P303';
  const bowlerId = 'P401';

  await test('Record Dot Ball (0 runs, legal delivery, bowler ball increment)', async () => {
    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId,
      nonStrikerId,
      bowlerId,
      runsBatter: 0,
      extraType: 'NONE'
    }, 'SCR-101');
    assert(res.success);
    assert.strictEqual(res.data.lastDelivery.runsBatter, 0);
  });

  await test('Record 1 Run with Strike Rotation', async () => {
    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId,
      nonStrikerId,
      bowlerId,
      runsBatter: 1,
      extraType: 'NONE'
    }, 'SCR-101');
    assert(res.success);
    // Strike should rotate on odd runs
    assert.strictEqual(res.data.strikerId, nonStrikerId, 'Strike should rotate to non-striker');
    assert.strictEqual(res.data.nonStrikerId, strikerId);
  });

  await test('Record 2 Runs (Strike remains with batter)', async () => {
    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId: nonStrikerId,
      nonStrikerId: strikerId,
      bowlerId,
      runsBatter: 2,
      extraType: 'NONE'
    }, 'SCR-101');
    assert(res.success);
    assert.strictEqual(res.data.strikerId, nonStrikerId, 'Strike should remain unchanged on even runs');
  });

  await test('Record 4 Runs (Boundary credited to batter)', async () => {
    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId: nonStrikerId,
      nonStrikerId: strikerId,
      bowlerId,
      runsBatter: 4,
      extraType: 'NONE'
    }, 'SCR-101');
    assert(res.success);
    assert.strictEqual(res.data.lastDelivery.runsBatter, 4);
  });

  await test('Record 6 Runs (Maximum credited to batter)', async () => {
    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId: nonStrikerId,
      nonStrikerId: strikerId,
      bowlerId,
      runsBatter: 6,
      extraType: 'NONE'
    }, 'SCR-101');
    assert(res.success);
    assert.strictEqual(res.data.lastDelivery.runsBatter, 6);
  });

  console.log('\n--- 5. EXTRAS & ILLEGAL DELIVERIES ---');
  await test('Record Wide Ball (1 extra, illegal delivery, no legal ball consumed)', async () => {
    const beforeState = await scorerService.getLiveMatchState(matchId);
    const beforeBalls = beforeState.innings.overs;

    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId: nonStrikerId,
      nonStrikerId: strikerId,
      bowlerId,
      runsBatter: 0,
      runsExtras: 1,
      extraType: 'WIDE'
    }, 'SCR-101');

    assert(res.success);
    assert.strictEqual(res.data.lastDelivery.extraType, 'WIDE');
    assert.strictEqual(res.data.overs, beforeBalls, 'Overs/balls must NOT increment for Wide');
  });

  await test('Record No Ball (1 extra + runs off bat, illegal delivery)', async () => {
    const beforeState = await scorerService.getLiveMatchState(matchId);
    const beforeBalls = beforeState.innings.overs;

    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId: nonStrikerId,
      nonStrikerId: strikerId,
      bowlerId,
      runsBatter: 2,
      runsExtras: 1,
      extraType: 'NO_BALL'
    }, 'SCR-101');

    assert(res.success);
    assert.strictEqual(res.data.lastDelivery.extraType, 'NO_BALL');
    assert.strictEqual(res.data.overs, beforeBalls, 'Overs/balls must NOT increment for No Ball');
  });

  await test('Record Bye & Leg Bye (Legal deliveries, runs to extras not batter)', async () => {
    const resBye = await scoringEngine.recordDelivery(matchId, {
      strikerId: nonStrikerId,
      nonStrikerId: strikerId,
      bowlerId,
      runsBatter: 0,
      runsExtras: 1,
      extraType: 'BYE'
    }, 'SCR-101');
    assert(resBye.success);
    assert.strictEqual(resBye.data.lastDelivery.extraType, 'BYE');
  });

  console.log('\n--- 6. WICKETS & REPLACEMENT BATTER ---');
  await test('Record Wicket (BOWLED, credits bowler, updates innings wickets)', async () => {
    const beforeState = await scorerService.getLiveMatchState(matchId);
    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId: nonStrikerId,
      nonStrikerId: strikerId,
      bowlerId,
      runsBatter: 0,
      wicket: true,
      wicketType: 'BOWLED',
      replacementBatterId: 'P306'
    }, 'SCR-101');

    assert(res.success);
    assert.strictEqual(res.data.wickets, beforeState.innings.wickets + 1);
  });

  console.log('\n--- 7. UNDO TRANSACTION-SAFE CORRECTION ---');
  await test('Undo Last Delivery (reverses runs, balls, bowler & batter figures)', async () => {
    const beforeUndo = await scorerService.getLiveMatchState(matchId);
    const undoRes = await scoringEngine.undoLastDelivery(matchId);
    assert(undoRes.success);
    const afterUndo = await scorerService.getLiveMatchState(matchId);
    assert.strictEqual(afterUndo.innings.wickets, beforeUndo.innings.wickets - 1, 'Wicket count should revert by 1');
  });

  console.log('\n--- 8. INNINGS COMPLETION, CHASE & TARGET LOGIC ---');
  await test('End 1st Innings sets target for 2nd Innings', async () => {
    const endInnRes = await scoringEngine.endInnings(matchId);
    assert(endInnRes.success);
    assert(endInnRes.data.target > 0, 'Target should be set to 1st innings total + 1');
  });

  await test('Chasing team reaching target completes match automatically', async () => {
    // 2nd innings target
    const [inn2Rows] = await db.query('SELECT * FROM innings WHERE match_id = ? AND status = ?', [matchId, 'LIVE']);
    const inn2 = inn2Rows[0];
    assert(inn2, 'Innings 2 should be active');

    // Score enough runs to pass target
    const targetRuns = inn2.target || 160;
    const res = await scoringEngine.recordDelivery(matchId, {
      strikerId: 'P403',
      nonStrikerId: 'P404',
      bowlerId: 'P307',
      runsBatter: targetRuns + 2,
      extraType: 'NONE'
    }, 'SCR-101');

    assert(res.success);
    assert.strictEqual(res.data.isMatchCompleted, true, 'Match must be marked COMPLETED when target reached');
  });

  console.log('\n--- 9. FULL SCORECARD VERIFICATION ---');
  await test('GET /api/scorer/matches/:matchId/scorecard returns complete MongoDB data', async () => {
    const scorecard = await scorerService.getFullScorecard('M003');
    assert.strictEqual(scorecard.matchId, 'M003');
    assert(scorecard.tournament.includes('VPL') || scorecard.tournament.includes('Virudhunagar'), 'Tournament check');
    assert.strictEqual(scorecard.match.teamA, 'Sattur Spartans');
    assert.strictEqual(scorecard.match.teamB, 'Virudhunagar Strikers');
    assert.strictEqual(scorecard.match.result, 'Virudhunagar Strikers won by 7 wickets');

    // Innings 1 checks
    const inn1 = scorecard.innings[0];
    assert.strictEqual(inn1.battingTeam, 'Sattur Spartans');
    assert.strictEqual(inn1.totalRuns, 160);
    assert.strictEqual(inn1.wickets, 8);
    assert.strictEqual(inn1.overs, '20.0');

    // Batter checks: Suresh Kumar 42 (30), Muthu Raj 12 (10), Vijay 18 (14)
    const suresh = inn1.batters.find(b => b.name === 'Suresh Kumar');
    assert(suresh, 'Suresh Kumar must be in batting card');
    assert.strictEqual(suresh.runs, 42);
    assert.strictEqual(suresh.balls, 30);
    assert.strictEqual(suresh.fours, 4);
    assert.strictEqual(suresh.sixes, 1);

    const muthu = inn1.batters.find(b => b.name === 'Muthu Raj');
    assert(muthu, 'Muthu Raj must be in batting card');
    assert.strictEqual(muthu.runs, 12);
    assert.strictEqual(muthu.balls, 10);

    const vijay = inn1.batters.find(b => b.name === 'Vijay');
    assert(vijay, 'Vijay must be in batting card');
    assert.strictEqual(vijay.runs, 18);
    assert.strictEqual(vijay.balls, 14);

    // Extras: 11 (wd 6, nb 1, b 2, lb 2)
    assert.strictEqual(inn1.extras.total, 11);
    assert.strictEqual(inn1.extras.wide, 6);
    assert.strictEqual(inn1.extras.noBall, 1);
    assert.strictEqual(inn1.extras.bye, 2);
    assert.strictEqual(inn1.extras.legBye, 2);

    // Bowlers in Innings 1 and Innings 2
    const dk = inn1.bowlers.find(b => b.name === 'Dinesh Karthik' || b.name === 'Karthik N');
    assert(dk, 'Dinesh Karthik / Karthik N must be in bowling card');
    assert.strictEqual(dk.overs, '4.0');

    const inn2 = scorecard.innings[1];
    assert(inn2, 'Innings 2 must be present in full scorecard');
    const saravanan = (inn2.bowlers || []).find(b => b.name === 'Saravanan');
    assert(saravanan, 'Saravanan must be in Innings 2 bowling card');
    assert.strictEqual(saravanan.overs, '4.0');
    assert.strictEqual(saravanan.wickets, 2);

    // Fall of Wickets & Partnerships
    assert(inn1.fallOfWickets.length > 0, 'Fall of wickets must be calculated');
    assert(inn1.partnerships.length > 0, 'Partnerships must be calculated');
  });

  await test('GET scorecard for non-existent match throws 404 (No fake data)', async () => {
    try {
      await scorerService.getFullScorecard('M999');
      assert.fail('Should throw 404 error');
    } catch (err) {
      assert(err.status === 404 || err.message.includes('not found'), 'Must fail with not found');
    }
  });

  
  console.log('\n--- 10. EDIT DELIVERY & MATCH END ---');
  await test('Edit Delivery with Innings Recalculation', async () => {
    // Deliveries in Innings 1 of M002
    const [dels] = await db.query('SELECT * FROM deliveries WHERE innings_id = ?', ['INN-M002-1']);
    assert(dels && dels.length > 0, 'Must have deliveries');
    const targetDel = dels[0];

    const editRes = await scoringEngine.editDelivery('M002', targetDel.id, {
      runsBatter: 4,
      extraType: 'NONE'
    }, 'SCR-101');
    assert(editRes.success);
    assert.strictEqual(editRes.data.action, 'EDIT_DELIVERY');
  });

  await test('Manual Match Conclusion / End Match', async () => {
    const endRes = await scoringEngine.endMatch('M001', {
      resultText: 'Match Concluded by Scorer',
      winnerTeamId: 'T001',
      status: 'COMPLETED'
    });
    assert(endRes.success);
    assert.strictEqual(endRes.data.status, 'COMPLETED');
  });

  await test('Duplicate / Stale Delivery Protection (State Conflict)', async () => {
    try {
      await scoringEngine.recordDelivery('M002', {
        strikerId: 'P301',
        nonStrikerId: 'P303',
        bowlerId: 'P401',
        runsBatter: 1,
        expectedOver: 99, // Stale over expectation
        expectedBall: 99
      }, 'SCR-101');
      assert.fail('Should reject with 409 conflict');
    } catch (err) {
      assert(err.status === 409 || err.status === 400 || err.message.includes('Conflict') || err.message.includes('not'));
    }
  });

  
  console.log('\n--- 11. SCORER REGISTRATION, ADMIN APPROVAL & LOGIN FLOW ---');
  await db.models.User.deleteMany({ email: { $in: ['athi.new@example.com', 'candidate.reject@example.com'] } });
  await db.models.Scorer.deleteMany({ email: { $in: ['athi.new@example.com', 'candidate.reject@example.com'] } });
  let newScorerId = null;

  await test('REGISTER: New scorer submits registration -> Status PENDING in MySQL', async () => {
    const regRes = await authService.registerScorer({
      full_name: 'Athi Lingam',
      email: 'athi.new@example.com',
      mobile: '9876543299',
      association: 'Virudhunagar District Cricket Association'
    });

    assert.strictEqual(regRes.success, true);
    assert.strictEqual(regRes.status, 'PENDING');
    assert(regRes.scorer.id, 'Scorer ID must be generated');
    newScorerId = regRes.scorer.id;

    // Verify row in MySQL scorers table
    const [rows] = await db.query('SELECT * FROM scorers WHERE email = ?', ['athi.new@example.com']);
    assert(rows && rows.length > 0, 'Scorer must exist in MySQL scorers table');
    assert.strictEqual(rows[0].status, 'PENDING', 'MySQL status must be PENDING');
    assert.strictEqual(rows[0].full_name, 'Athi Lingam');
    assert.strictEqual(rows[0].mobile, '9876543299');
    assert.strictEqual(rows[0].association, 'Virudhunagar District Cricket Association');
  });

  await test('REGISTER: Duplicate registration returns PENDING status without duplication', async () => {
    const dupRes = await authService.registerScorer({
      full_name: 'Athi Lingam',
      email: 'athi.new@example.com',
      mobile: '9876543299',
      association: 'Virudhunagar District Cricket Association'
    });

    assert.strictEqual(dupRes.success, true);
    assert.strictEqual(dupRes.status, 'PENDING');
  });

  await test('LOGIN ATTEMPT: PENDING Scorer cannot request login OTP (403)', async () => {
    try {
      await authService.requestScorerOtp('athi.new@example.com');
      assert.fail('Should block pending scorer from requesting OTP');
    } catch (err) {
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.scorerStatus, 'PENDING');
      assert(err.message.includes('pending admin approval'));
    }
  });

  await test('LOGIN ATTEMPT: Unregistered email returns 404 with notFound: true', async () => {
    try {
      await authService.requestScorerOtp('completely_unknown@example.com');
      assert.fail('Should reject unregistered email');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.notFound, true);
    }
  });

  await test('ADMIN: List pending scorer requests includes new registration', async () => {
    const pending = await authService.getPendingScorers();
    assert(Array.isArray(pending), 'Must return array of pending scorers');
    const athi = pending.find(s => s.email === 'athi.new@example.com');
    assert(athi, 'New scorer must appear under Pending Scorer Requests');
    assert.strictEqual(athi.full_name, 'Athi Lingam');
    assert.strictEqual(athi.status, 'PENDING');
    assert.strictEqual(athi.association, 'Virudhunagar District Cricket Association');
  });

  await test('ADMIN: Approve scorer -> status changes to APPROVED with approved_at timestamp', async () => {
    const approveRes = await authService.approveScorer(newScorerId);
    assert.strictEqual(approveRes.success, true);
    assert.strictEqual(approveRes.scorer.status, 'APPROVED');
    assert(approveRes.scorer.approved_at, 'approved_at timestamp must be set');

    // Verify in database
    const [rows] = await db.query('SELECT * FROM scorers WHERE id = ?', [newScorerId]);
    assert.strictEqual(rows[0].status, 'APPROVED');
    assert(rows[0].approved_at, 'approved_at must be populated in DB');
  });

  await test('SCORER LOGIN AFTER APPROVAL: Request OTP & verify -> Success & JWT token', async () => {
    otpService.resetRateLimit('athi.new@example.com');
    const otpRes = await authService.requestScorerOtp('athi.new@example.com');
    assert.strictEqual(otpRes.success, true);
    assert.strictEqual(otpRes.message, 'OTP sent successfully');

    // Deterministic verify
    const testOtp = '819203';
    const testHash = otpService.hashOtp(testOtp);
    await userModel.updateOtp(newScorerId, {
      otp_hash: testHash,
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      otp_attempts: 0
    });
    const scorerModel = require('../models/scorerModel');
    await scorerModel.updateOtp(newScorerId, {
      otp_hash: testHash,
      otp_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      otp_attempts: 0
    });

    const verifyRes = await authService.verifyScorerOtp('athi.new@example.com', testOtp);
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(verifyRes.user.role, 'SCORER');
    assert(verifyRes.token, 'JWT token must be issued on successful login');
  });

  await test('ADMIN: Reject scorer -> status changes to REJECTED with rejected_at timestamp', async () => {
    // Register candidate to reject
    const regReject = await authService.registerScorer({
      full_name: 'Rejected Candidate',
      email: 'candidate.reject@example.com',
      mobile: '9876543288',
      association: 'Sivakasi Taluk'
    });

    const rejectRes = await authService.rejectScorer(regReject.scorer.id, 'Certification documentation invalid');
    assert.strictEqual(rejectRes.success, true);
    assert.strictEqual(rejectRes.scorer.status, 'REJECTED');
    assert(rejectRes.scorer.rejected_at, 'rejected_at timestamp must be set');
    assert.strictEqual(rejectRes.scorer.rejection_reason, 'Certification documentation invalid');

    // Verify in database
    const [rows] = await db.query('SELECT * FROM scorers WHERE id = ?', [regReject.scorer.id]);
    assert.strictEqual(rows[0].status, 'REJECTED');
  });

  await test('LOGIN ATTEMPT: REJECTED Scorer cannot request login OTP (403)', async () => {
    try {
      await authService.requestScorerOtp('candidate.reject@example.com');
      assert.fail('Should block rejected scorer from requesting OTP');
    } catch (err) {
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.scorerStatus, 'REJECTED');
      assert(err.message.includes('rejected'));
    }
  });

  console.log('\n==================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('==================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

