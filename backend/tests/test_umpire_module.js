/**
 * tests/test_umpire_module.js
 * Comprehensive automated tests for Umpire Module
 */

const assert = require('assert');
const http = require('http');
const db = require('../config/db');
const authService = require('../services/authService');
const { app } = require('../server');

let server;
let baseUrl;

function makeRequest(method, path, body = null, token = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (_e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message || err}`);
    if (err.stack) console.error(`     ${err.stack.split('\n')[1]}`);
    failed++;
  }
}

async function start() {
  console.log('\n==================================================');
  console.log('⚖️ RUNNING UMPIRE MODULE AUTOMATED TEST SUITE');
  console.log('==================================================\n');

  await db.initDb();

  // Reset match fixtures for idempotent test runs
  await db.models.Match.updateOne(
    { id: 'M001' },
    {
      $set: {
        status: 'SCHEDULED',
        umpire1_id: 'UMP-101',
        umpire2_id: 'UMP-102',
        umpire1_name: 'Thiru. K. Sundaram',
        umpire2_name: 'Thiru. M. Ramanathan',
        result_summary: null,
        umpire_result_confirmed: false
      }
    }
  );
  await db.models.Match.updateOne(
    { id: 'M002' },
    {
      $set: {
        status: 'LIVE',
        umpire1_id: 'UMP-101',
        umpire2_id: 'UMP-102',
        umpire1_name: 'Thiru. K. Sundaram',
        umpire2_name: 'Thiru. M. Ramanathan'
      }
    }
  );

  // Start test server on random port
  server = http.createServer(app);
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Authenticate Umpire Sundaram
    let umpireToken = null;
    let scorerToken = null;

    await runTest('1. Authenticate registered umpire (sundaram.umpire@cfvd.org / 1234) -> Role UMPIRE', async () => {
      const res = await makeRequest('POST', '/api/auth/login', {
        email: 'sundaram.umpire@cfvd.org',
        password: '1234',
        role: 'UMPIRE'
      });
      assert.strictEqual(res.status, 200);
      assert(res.data.token, 'Should return JWT token');
      assert.strictEqual(res.data.user.role, 'UMPIRE');
      assert.strictEqual(res.data.user.email, 'sundaram.umpire@cfvd.org');
      umpireToken = res.data.token;
    });

    await runTest('2. Authenticate registered scorer (ramesh@gmail.com / 1234) -> Role SCORER', async () => {
      const res = await makeRequest('POST', '/api/auth/login', {
        email: 'ramesh@gmail.com',
        password: '1234',
        role: 'SCORER'
      });
      assert.strictEqual(res.status, 200);
      assert(res.data.token, 'Should return JWT token');
      assert.strictEqual(res.data.user.role, 'SCORER');
      scorerToken = res.data.token;
    });

    console.log('\n--- 2. ROLE-BASED ACCESS CONTROL & SECURITY ISOLATION ---');

    await runTest('3. SECURITY: Umpire CANNOT access Scorer-only API (GET /api/scorer/dashboard) -> 403 Forbidden', async () => {
      const res = await makeRequest('GET', '/api/scorer/dashboard', null, umpireToken);
      assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
      assert(res.data.message.includes('Forbidden') || res.data.message.includes('SCORER'));
    });

    await runTest('4. SECURITY: Scorer CANNOT access Umpire-only API (GET /api/umpire/profile) -> 403 Forbidden', async () => {
      const res = await makeRequest('GET', '/api/umpire/profile', null, scorerToken);
      assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
      assert(res.data.message.includes('Forbidden') || res.data.message.includes('UMPIRE'));
    });

    await runTest('5. SECURITY: Unauthenticated request to Umpire API -> 401 Unauthorized', async () => {
      const res = await makeRequest('GET', '/api/umpire/profile', null, null);
      assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
    });

    console.log('\n--- 3. UMPIRE PROFILE & MANAGEMENT ---');

    await runTest('6. GET /api/umpire/profile returns logged-in umpire profile & stats', async () => {
      const res = await makeRequest('GET', '/api/umpire/profile', null, umpireToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success);
      assert.strictEqual(res.data.data.role, 'UMPIRE');
      assert(res.data.data.name.includes('Sundaram'));
      assert(res.data.data.stats, 'Should contain stats');
    });

    await runTest('7. PUT /api/umpire/profile updates editable fields (mobile, taluk)', async () => {
      const res = await makeRequest('PUT', '/api/umpire/profile', {
        mobile: '+91 94431 99999',
        taluk: 'Virudhunagar Central',
        experienceYears: 14
      }, umpireToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success);
      assert.strictEqual(res.data.data.mobile, '+91 94431 99999');
      assert.strictEqual(res.data.data.taluk, 'Virudhunagar Central');
    });

    console.log('\n--- 4. ASSIGNED MATCHES & DETAILS ---');

    await runTest('8. GET /api/umpire/matches returns assigned matches', async () => {
      const res = await makeRequest('GET', '/api/umpire/matches', null, umpireToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success);
      assert(Array.isArray(res.data.data.all));
      assert(res.data.data.all.length > 0, 'Should have at least 1 assigned match');
    });

    await runTest('9. GET /api/umpire/matches/:matchId returns complete match information', async () => {
      const res = await makeRequest('GET', '/api/umpire/matches/M002', null, umpireToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success);
      assert.strictEqual(res.data.data.matchId, 'M002');
      assert(res.data.data.teamA && res.data.data.teamB);
      assert(res.data.data.officials);
    });

    await runTest('10. SECURITY: Umpire CANNOT modify a match they are not assigned to -> 403 Forbidden', async () => {
      // Create a test match assigned ONLY to someone else
      await db.models.Match.findOneAndUpdate(
        { id: 'M-OTHER-99' },
        {
          id: 'M-OTHER-99',
          tournament_name: 'Test Cup',
          team_a_id: 'TM-01',
          team_b_id: 'TM-02',
          umpire1_id: 'UMP-999-OTHER',
          umpire2_id: 'UMP-998-OTHER',
          umpire1_name: 'Other Umpire A',
          umpire2_name: 'Other Umpire B',
          status: 'SCHEDULED'
        },
        { upsert: true }
      );

      const res = await makeRequest('PUT', '/api/umpire/matches/M-OTHER-99/status', { status: 'live' }, umpireToken);
      assert.strictEqual(res.status, 403, `Expected 403 Forbidden for unassigned match, got ${res.status}`);
    });

    console.log('\n--- 5. UMPIRE MATCH CONTROL & STATUS TRANSITIONS ---');

    await runTest('11. PUT /api/umpire/matches/:matchId/start starts match with toss', async () => {
      const res = await makeRequest('PUT', '/api/umpire/matches/M001/start', {
        tossWinner: 'TM-01',
        tossDecision: 'BAT'
      }, umpireToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success);
      assert.strictEqual(res.data.status, 'LIVE');

      // Verify in DB
      const m = await db.models.Match.findOne({ id: 'M001' }).lean();
      assert.strictEqual(m.status, 'LIVE');
      assert.strictEqual(m.toss_decision, 'BAT');
    });

    await runTest('12. PUT /api/umpire/matches/:matchId/status transitions through valid statuses', async () => {
      // Pause
      let res = await makeRequest('PUT', '/api/umpire/matches/M001/status', { status: 'paused', reason: 'Rain delay' }, umpireToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'PAUSED');

      // Resume (live)
      res = await makeRequest('PUT', '/api/umpire/matches/M001/status', { status: 'live' }, umpireToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'LIVE');

      // Innings break
      res = await makeRequest('PUT', '/api/umpire/matches/M001/status', { status: 'innings_break' }, umpireToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'INNINGS_BREAK');
    });

    await runTest('13. PUT /api/umpire/matches/:matchId/status rejects invalid status (400)', async () => {
      const res = await makeRequest('PUT', '/api/umpire/matches/M001/status', { status: 'invalid_status_xyz' }, umpireToken);
      assert.strictEqual(res.status, 400);
      assert(!res.data.success);
    });

    console.log('\n--- 6. UMPIRE DECISIONS & SIGNALS ---');

    await runTest('14. POST /api/umpire/matches/:matchId/decisions records Wide decision', async () => {
      const res = await makeRequest('POST', '/api/umpire/matches/M001/decisions', {
        decisionType: 'WIDE',
        description: 'Wide ball signaled by Lead Umpire down leg side',
        inning: 1,
        over: 3,
        ball: 2
      }, umpireToken);
      assert.strictEqual(res.status, 201);
      assert(res.data.success);
      assert.strictEqual(res.data.decision.decisionType, 'WIDE');
    });

    await runTest('15. POST /api/umpire/matches/:matchId/decisions records Out / Wicket decision', async () => {
      const res = await makeRequest('POST', '/api/umpire/matches/M001/decisions', {
        decisionType: 'WICKET',
        description: 'Finger raised for LBW after plumb appeal',
        inning: 1,
        over: 3,
        ball: 4
      }, umpireToken);
      assert.strictEqual(res.status, 201);
      assert(res.data.success);
      assert.strictEqual(res.data.decision.decisionType, 'WICKET');
    });

    await runTest('16. POST /api/umpire/matches/:matchId/decisions records DRS Review status', async () => {
      const res = await makeRequest('POST', '/api/umpire/matches/M001/decisions', {
        decisionType: 'DRS_REVIEW',
        description: 'Player requested DRS review for caught behind. Decision upheld on field.',
        inning: 1,
        over: 4,
        ball: 1
      }, umpireToken);
      assert.strictEqual(res.status, 201);
      assert(res.data.success);
      assert.strictEqual(res.data.decision.decisionType, 'DRS_REVIEW');
    });

    await runTest('17. GET /api/umpire/matches/:matchId/decisions retrieves all match decisions', async () => {
      const res = await makeRequest('GET', '/api/umpire/matches/M001/decisions', null, umpireToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success);
      assert(Array.isArray(res.data.data));
      assert(res.data.data.length >= 3, 'Should have at least 3 decisions');
    });

    console.log('\n--- 7. CONFIRM MATCH RESULT ---');

    await runTest('18. PUT /api/umpire/matches/:matchId/result certifies & confirms final result', async () => {
      const res = await makeRequest('PUT', '/api/umpire/matches/M001/result', {
        resultSummary: 'Virudhunagar Spartans won by 18 runs',
        notes: 'Official match scorecard and boundary count verified by Umpire K. Sundaram',
        playerOfMatch: 'Suresh Kumar'
      }, umpireToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success);
      assert.strictEqual(res.data.status, 'COMPLETED');
      assert.strictEqual(res.data.resultConfirmed, true);

      // Verify in DB
      const m = await db.models.Match.findOne({ id: 'M001' }).lean();
      assert.strictEqual(m.status, 'COMPLETED');
      assert.strictEqual(m.result_summary, 'Virudhunagar Spartans won by 18 runs');
      assert.strictEqual(m.umpire_result_confirmed, true);
      assert.strictEqual(m.player_of_match, 'Suresh Kumar');
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n==================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

start().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
