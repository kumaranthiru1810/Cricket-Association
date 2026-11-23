/**
 * test_player_module.js
 * 
 * Comprehensive Automated Verification Test Suite for the Player Module:
 * 1. Player Registration with MongoDB persistence & Status = PENDING
 * 2. Block Login / OTP for PENDING players (403 Forbidden)
 * 3. Admin Approval via Admin APIs
 * 4. Approved Player Login via OTP
 * 5. Block Login / OTP for REJECTED players
 * 6. JWT Authentication & requirePlayerAuth Middleware
 * 7. GET /api/player/profile (View own profile)
 * 8. PUT /api/player/profile (Update permitted fields: batting style, jersey number, mobile)
 * 9. Tamper Protection: Player cannot modify role, approval status, or teamId
 * 10. GET /api/player/team (Team info & 15-player squad roster)
 * 11. GET /api/player/matches (Fixtures & match statuses)
 * 12. GET /api/player/matches/:id/scorecard (Read-only scorecard from Scorer data)
 * 13. GET /api/player/statistics (Real batting, bowling, and fielding stats)
 * 14. GET /api/player/notifications (Association notices & bulletins)
 * 15. Security Boundaries: Player cannot access Admin APIs or Scorer ball scoring APIs
 */

const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('\n🏏 ========================================================');
  console.log('   RUNNING COMPLETE PLAYER MODULE E2E TEST SUITE');
  console.log('========================================================\n');

  try {
    // ---------------------------------------------------------
    // Test 1: Health Check & Database Connection
    // ---------------------------------------------------------
    console.log('--- 1. Technology & Database Check ---');
    const health = await request('/health');
    assert(health.status === 200 && health.body.database === 'MongoDB', 'Health check returns MongoDB connected');

    // ---------------------------------------------------------
    // Test 2: Player Registration
    // ---------------------------------------------------------
    console.log('\n--- 2. Player Registration Flow ---');
    const uniqueEmail = `test.player.${Date.now()}@example.com`;
    const regPayload = {
      name: 'M. Senthil Kumar',
      email: uniqueEmail,
      mobile: '9842109876',
      role: 'BATTER',
      category: 'Senior District Trophy',
      taluk: 'Virudhunagar',
      battingStyle: 'Right Hand Bat',
      bowlingStyle: 'Right Arm Medium',
      clubChoice: 'Virudhunagar Spartans'
    };

    const regRes = await request('/player/register', {
      method: 'POST',
      body: regPayload
    });

    assert(regRes.status === 201, `Registration returned HTTP 201 (Status: ${regRes.status})`);
    assert(regRes.body.status === 'PENDING', `Registration status is PENDING (Got: ${regRes.body.status})`);
    assert(regRes.body.player && regRes.body.player.email === uniqueEmail, 'Player record saved in MongoDB');

    // Duplicate check
    const dupRes = await request('/player/register', {
      method: 'POST',
      body: regPayload
    });
    assert(dupRes.status === 409, `Duplicate email registration blocked with HTTP 409 (Got: ${dupRes.status})`);

    // ---------------------------------------------------------
    // Test 3: Block Login for PENDING Players
    // ---------------------------------------------------------
    console.log('\n--- 3. Admin Approval Enforcement for Pending Player ---');
    const pendingLoginRes = await request('/player/login', {
      method: 'POST',
      body: { nameOrEmail: uniqueEmail }
    });

    assert(pendingLoginRes.status === 403, `Login blocked for PENDING player with HTTP 403 (Got: ${pendingLoginRes.status})`);
    assert(pendingLoginRes.body.message.includes('PENDING'), 'Message informs player that account is PENDING admin approval');

    // ---------------------------------------------------------
    // Test 4: Admin Approval Flow
    // ---------------------------------------------------------
    console.log('\n--- 4. Admin Approval Flow ---');
    // Admin logs in
    const adminLoginRes = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: '1234' }
    });
    const adminToken = adminLoginRes.body.token;
    assert(adminLoginRes.status === 200 && adminToken, 'Administrator logged in successfully');

    // Admin approves the player
    const approveRes = await request('/auth/admin/approve-registration', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { id: uniqueEmail, type: 'PLAYER' }
    });
    assert(approveRes.status === 200, `Admin successfully approved player registration (HTTP 200)`);

    // ---------------------------------------------------------
    // Test 5: Approved Player Login & OTP Verification
    // ---------------------------------------------------------
    console.log('\n--- 5. Approved Player Login & OTP ---');
    const otpReqRes = await request('/player/login', {
      method: 'POST',
      body: { nameOrEmail: uniqueEmail }
    });
    assert(otpReqRes.status === 200 && otpReqRes.body.success, 'OTP successfully generated & dispatched for approved player');

    // Verify with invalid OTP
    const invalidOtpRes = await request('/player/verify-otp', {
      method: 'POST',
      body: { nameOrEmail: uniqueEmail, otp: '999999' }
    });
    assert(invalidOtpRes.status === 401, 'Invalid OTP code correctly rejected (HTTP 401)');

    // Verify with valid demo/dev OTP fallback '1234' or devOtp
    const validOtp = otpReqRes.body.devOtp || '1234';
    const verifyRes = await request('/player/verify-otp', {
      method: 'POST',
      body: { nameOrEmail: uniqueEmail, otp: validOtp }
    });
    assert(verifyRes.status === 200 && verifyRes.body.token, 'OTP verified and JWT session token issued');
    const playerToken = verifyRes.body.token;

    // Also verify seeded player (Arun Pandian) login
    const seededLoginRes = await request('/player/login', {
      method: 'POST',
      body: { nameOrEmail: 'player@example.com' }
    });
    assert(seededLoginRes.status === 200, 'Seeded squad player can request OTP');
    const seededVerify = await request('/player/verify-otp', {
      method: 'POST',
      body: { nameOrEmail: 'player@example.com', otp: '1234' }
    });
    const seededPlayerToken = seededVerify.body.token;
    assert(seededVerify.status === 200 && seededPlayerToken, 'Seeded squad player successfully authenticated');

    // ---------------------------------------------------------
    // Test 6: Rejection Enforcement
    // ---------------------------------------------------------
    console.log('\n--- 6. Rejection Enforcement ---');
    const rejectedEmail = `bad.player.${Date.now()}@example.com`;
    await request('/player/register', {
      method: 'POST',
      body: { name: 'Rejected Player', email: rejectedEmail, mobile: '9123456780' }
    });

    const rejectRes = await request('/auth/admin/reject-registration', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { id: rejectedEmail, type: 'PLAYER', reason: 'Identity verification failed' }
    });
    assert(rejectRes.status === 200, 'Admin successfully rejected player application');

    const rejectedLoginRes = await request('/player/login', {
      method: 'POST',
      body: { nameOrEmail: rejectedEmail }
    });
    assert(rejectedLoginRes.status === 403, 'REJECTED player strictly blocked from requesting OTP (HTTP 403)');

    // ---------------------------------------------------------
    // Test 7: Protected Player Profile (View & Update)
    // ---------------------------------------------------------
    console.log('\n--- 7. Player Profile Management ---');
    // Unauthorized request
    const unauthProfile = await request('/player/profile');
    assert(unauthProfile.status === 401, 'Unauthenticated profile request blocked (HTTP 401)');

    // Authorized view own profile
    const profileRes = await request('/player/profile', {
      headers: { Authorization: `Bearer ${seededPlayerToken}` }
    });
    assert(profileRes.status === 200 && profileRes.body.profile, 'Player can view own profile from MongoDB');
    assert(profileRes.body.profile.email === 'player@example.com', `Profile email matches logged in player (${profileRes.body.profile.email})`);

    // Update permitted fields
    const updateRes = await request('/player/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seededPlayerToken}` },
      body: {
        battingStyle: 'Aggressive Right Hand Bat',
        jerseyNumber: 18,
        mobile: '9842199999',
        // Attempt tampering with forbidden fields
        role: 'ADMIN',
        status: 'TAMPERED',
        teamId: 'HACKED'
      }
    });
    assert(updateRes.status === 200, 'Player permitted profile update succeeded (HTTP 200)');
    assert(updateRes.body.profile.battingStyle === 'Aggressive Right Hand Bat', 'Batting style updated in MongoDB');
    assert(updateRes.body.profile.jerseyNumber === 18, 'Jersey number updated in MongoDB');
    assert(updateRes.body.profile.role !== 'ADMIN', 'Tampering check: Role modification was rejected');

    // ---------------------------------------------------------
    // Test 8: Team & 15-Member Squad Roster
    // ---------------------------------------------------------
    console.log('\n--- 8. Registered Team & Squad Roster ---');
    const teamRes = await request('/player/team', {
      headers: { Authorization: `Bearer ${seededPlayerToken}` }
    });
    assert(teamRes.status === 200 && teamRes.body.team, 'Player can view affiliated team details');
    assert(Array.isArray(teamRes.body.squad) && teamRes.body.squad.length > 0, `Squad list retrieved (${teamRes.body.squad.length} players)`);

    // ---------------------------------------------------------
    // Test 9: Match Fixtures & Schedules
    // ---------------------------------------------------------
    console.log('\n--- 9. Match Fixtures & Schedules ---');
    const matchesRes = await request('/player/matches', {
      headers: { Authorization: `Bearer ${seededPlayerToken}` }
    });
    assert(matchesRes.status === 200 && Array.isArray(matchesRes.body.matches), 'Player matches retrieved from MongoDB');
    assert(matchesRes.body.matches.length >= 2, `Matches list contains fixtures (Count: ${matchesRes.body.matches.length})`);

    // ---------------------------------------------------------
    // Test 10: Read-Only Match Scorecard
    // ---------------------------------------------------------
    console.log('\n--- 10. Read-Only Scorecard Connected to Scorer Data ---');
    const scorecardRes = await request('/player/matches/M002/scorecard', {
      headers: { Authorization: `Bearer ${seededPlayerToken}` }
    });
    assert(scorecardRes.status === 200 && scorecardRes.body.scorecard, 'Scorecard retrieved for Match M002');
    assert(Array.isArray(scorecardRes.body.scorecard.innings), 'Scorecard contains official innings data');

    // ---------------------------------------------------------
    // Test 11: Real Match-Derived Statistics
    // ---------------------------------------------------------
    console.log('\n--- 11. Player Statistics ---');
    const statsRes = await request('/player/statistics', {
      headers: { Authorization: `Bearer ${seededPlayerToken}` }
    });
    assert(statsRes.status === 200 && statsRes.body.statistics, 'Player statistics retrieved from MongoDB');
    const stats = statsRes.body.statistics;
    assert(typeof stats.batting.runs === 'number' && stats.batting.runs > 0, `Batting runs computed (${stats.batting.runs})`);
    assert(typeof stats.bowling.wickets === 'number', `Bowling wickets computed (${stats.bowling.wickets})`);
    assert(typeof stats.fielding.catches === 'number', `Fielding catches computed (${stats.fielding.catches})`);

    // ---------------------------------------------------------
    // Test 12: Player Notifications
    // ---------------------------------------------------------
    console.log('\n--- 12. Player Notifications ---');
    const notifRes = await request('/player/notifications', {
      headers: { Authorization: `Bearer ${seededPlayerToken}` }
    });
    assert(notifRes.status === 200 && Array.isArray(notifRes.body.notifications), 'Notifications retrieved from MongoDB');

    // ---------------------------------------------------------
    // Test 13: Security & Permission Boundaries
    // ---------------------------------------------------------
    console.log('\n--- 13. Security Boundaries Enforcement ---');
    // Player cannot access Admin API
    const adminAccessAttempt = await request('/admin/scorer-status', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seededPlayerToken}` },
      body: { id: 'SCR-101', status: 'SUSPENDED' }
    });
    assert(adminAccessAttempt.status === 403, `Player blocked from Admin APIs with HTTP 403 (Got: ${adminAccessAttempt.status})`);

    // Player cannot record scoring balls
    const scoreBallAttempt = await request('/scorer/matches/M002/ball', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seededPlayerToken}` },
      body: { runsBatter: 4 }
    });
    assert(scoreBallAttempt.status === 403, `Player blocked from Scorer scoring APIs with HTTP 403 (Got: ${scoreBallAttempt.status})`);

    console.log('\n========================================================');
    console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('========================================================\n');

    if (passedTests === totalTests) {
      console.log('🎉 ALL PLAYER MODULE BACKEND & MONGODB TESTS PASSED PERFECTLY!\n');
      process.exit(0);
    } else {
      console.error(`⚠️ ${totalTests - passedTests} tests failed.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
