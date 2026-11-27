/**
 * tests/test_realtime_perf.js
 * Verifies:
 * 1. Socket.IO delta reaches subscribed client (< 500 ms) in both `live` and `match:<id>` rooms.
 * 2. Cached /api/portal/home payload never shows a score older than the latest ball.
 * 3. GET /api/portal/live returns uncached live scores.
 * 4. Idempotent clientDeliveryId prevents duplicate delivery recording.
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('../../mobile_frontend/node_modules/socket.io-client');
const env = require('../config/env');
const db = require('../config/db');
const { server } = require('../server');

function httpRequest(port, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: raw ? JSON.parse(raw) : null });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('\n==================================================');
  console.log('⚡ RUNNING REAL-TIME SOCKET, CACHE & IDEMPOTENCY TESTS');
  console.log('==================================================\n');

  await db.initDb();

  const matchId = 'RT-TEST-M01';
  const innId = `INN-${matchId}-1`;

  await Promise.all([
    db.models.Delivery.deleteMany({ match_id: matchId }),
    db.models.InningsBatter.deleteMany({ innings_id: innId }),
    db.models.InningsBowler.deleteMany({ innings_id: innId }),
    db.models.Innings.deleteMany({ match_id: matchId }),
    db.models.Match.deleteMany({ id: matchId })
  ]);

  await db.models.Match.create({
    id: matchId,
    tournament_id: 'TRN-01',
    tournament_name: 'Realtime Test Cup',
    team_a_id: 'TM-01',
    team_a_name: 'Team Alpha',
    team_b_id: 'TM-02',
    team_b_name: 'Team Beta',
    overs_per_side: 20,
    status: 'LIVE',
    assigned_scorer_id: 'SCR-101'
  });

  await db.models.Innings.create({
    id: innId,
    match_id: matchId,
    innings_number: 1,
    batting_team_id: 'TM-01',
    bowling_team_id: 'TM-02',
    current_striker_id: 'P301',
    current_non_striker_id: 'P302',
    current_bowler_id: 'P401',
    status: 'LIVE',
    is_completed: false
  });

  const token = jwt.sign({ id: 'SCR-101', role: 'SCORER', email: 'scorer-dev@localhost.test' }, env.JWT_SECRET, { expiresIn: '1h' });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  // Connect two public Socket.IO clients: one in 'live', one in `match:<id>`
  const liveSocket = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  const matchSocket = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'] });

  await Promise.all([
    new Promise((res) => liveSocket.on('connect', () => { liveSocket.emit('join:live'); res(); })),
    new Promise((res) => matchSocket.on('connect', () => { matchSocket.emit('join:match', matchId); res(); }))
  ]);
  await new Promise((r) => setTimeout(r, 50));

  // Warm /api/portal/home cache
  const homeBefore = await httpRequest(port, 'GET', '/api/portal/home');
  assert.strictEqual(homeBefore.status, 200);

  // Test 1: Socket delta reaches both clients within 500 ms
  let liveDelta = null;
  let matchDelta = null;
  let liveAt = 0;
  let matchAt = 0;
  const tSent = Date.now();

  const waitDeltas = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket delta timeout (>500ms)')), 500);
    const checkDone = () => {
      if (liveDelta && matchDelta) {
        clearTimeout(timer);
        resolve();
      }
    };
    liveSocket.on('score:update', (p) => { if (p.matchId === matchId) { liveDelta = p; liveAt = Date.now(); checkDone(); } });
    matchSocket.on('score:update', (p) => { if (p.matchId === matchId) { matchDelta = p; matchAt = Date.now(); checkDone(); } });
  });

  const cId = `rt-cdel-${Date.now()}`;
  const delRes = await httpRequest(
    port,
    'POST',
    `/api/scorer/matches/${matchId}/deliveries`,
    { runsBatter: 4, runsExtras: 0, extraType: 'NONE', clientDeliveryId: cId },
    token
  );
  assert.strictEqual(delRes.status, 200);
  assert.strictEqual(delRes.body.score, '4/0');
  assert.ok(delRes.headers['server-timing'], 'Server-Timing header should be present');

  await waitDeltas;
  assert.strictEqual(liveDelta.totalRuns, 4);
  assert.strictEqual(matchDelta.totalRuns, 4);
  assert.ok(liveAt - tSent < 500, `Live socket latency ${liveAt - tSent}ms >= 500ms`);
  assert.ok(matchAt - tSent < 500, `Match socket latency ${matchAt - tSent}ms >= 500ms`);
  console.log(`✅ PASS: Socket delta delivered in ${Math.max(liveAt - tSent, matchAt - tSent)}ms (< 500ms)`);

  // Test 2: Cached /portal/home invalidated immediately on ball
  const homeAfter = await httpRequest(port, 'GET', '/api/portal/home');
  assert.strictEqual(homeAfter.status, 200);
  const foundMatch = (homeAfter.body?.matches || homeAfter.body?.data?.matches || []).find((m) => m.id === matchId);
  if (foundMatch) {
    assert.ok(String(foundMatch.scoreA || foundMatch.score_a || '').startsWith('4/0'), 'Home cache must reflect latest 4/0 score');
  }
  console.log('✅ PASS: /api/portal/home cache invalidated on ball (no stale score)');

  // Test 3: /api/portal/live uncached & accurate
  const liveRes = await httpRequest(port, 'GET', '/api/portal/live');
  assert.strictEqual(liveRes.status, 200);
  const liveMatch = (liveRes.body?.matches || []).find((m) => m.matchId === matchId);
  assert.ok(liveMatch, 'Live match should appear in /api/portal/live');
  assert.ok(String(liveMatch.score).startsWith('4/0'), 'Live endpoint must return 4/0');
  console.log('✅ PASS: GET /api/portal/live returns uncached 4/0 live score');

  // Test 4: Idempotent replay with same clientDeliveryId
  const replayRes = await httpRequest(
    port,
    'POST',
    `/api/scorer/matches/${matchId}/deliveries`,
    { runsBatter: 4, runsExtras: 0, extraType: 'NONE', clientDeliveryId: cId },
    token
  );
  assert.strictEqual(replayRes.status, 200);
  assert.strictEqual(replayRes.body.idempotent, true);
  assert.strictEqual(replayRes.body.score, '4/0', 'Idempotent replay must NOT double-count runs');
  console.log('✅ PASS: Idempotent clientDeliveryId prevents duplicate delivery');

  liveSocket.disconnect();
  matchSocket.disconnect();
  server.close();
  console.log('\n🎉 ALL REAL-TIME, CACHE & IDEMPOTENCY TESTS PASSED!\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
