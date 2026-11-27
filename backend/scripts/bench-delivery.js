/**
 * scripts/bench-delivery.js
 * Seeds 5,000 Players + 500 TeamRegistrations + 1 live match,
 * then benchmarks 30 sequential deliveries to POST /api/scorer/matches/:id/deliveries.
 * Prints p50, p95, p99, min, max, and explain() stats.
 */

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.BENCH_MONGODB_URI || 'mongodb://127.0.0.1:27017/cricket_bench_db';

const http = require('http');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const { app, server } = require('../server');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

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
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: raw ? JSON.parse(raw) : null
            });
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

async function main() {
  await db.initDb();

  // Clean and seed benchmark data
  const matchId = 'BENCH-M01';
  const innId = `INN-${matchId}-1`;

  await Promise.all([
    db.models.Player.deleteMany({ id: /^BENCH-P/ }),
    db.models.TeamRegistration.deleteMany({ id: /^BENCH-TR/ }),
    db.models.Delivery.deleteMany({ match_id: matchId }),
    db.models.InningsBatter.deleteMany({ innings_id: innId }),
    db.models.InningsBowler.deleteMany({ innings_id: innId }),
    db.models.Innings.deleteMany({ match_id: matchId }),
    db.models.Match.deleteMany({ id: matchId }),
    db.models.Team.deleteMany({ id: /^BENCH-TM/ })
  ]);

  const existingPlayers = await db.models.Player.countDocuments();
  if (existingPlayers < 5000) {
    const need = 5000 - existingPlayers;
    const pBulk = [];
    for (let i = 0; i < need; i++) {
      pBulk.push({
        id: `BENCH-P-${i}`,
        name: `Bench Player ${i}`,
        role: i % 3 === 0 ? 'BOWLER' : 'BATTER',
        team_id: `BENCH-TM-${i % 2}`
      });
    }
    await db.models.Player.insertMany(pBulk, { ordered: false });
  }

  const existingRegs = await db.models.TeamRegistration.countDocuments();
  if (existingRegs < 500) {
    const need = 500 - existingRegs;
    const trBulk = [];
    for (let i = 0; i < need; i++) {
      trBulk.push({
        id: `BENCH-TR-${i}`,
        team_name: `Bench Club ${i}`,
        coach_name: `Coach ${i}`,
        coach_email: `benchcoach${i}@test.local`,
        status: 'APPROVED',
        players: [{ name: `Reg Player ${i}`, role: 'BATTER' }]
      });
    }
    await db.models.TeamRegistration.insertMany(trBulk, { ordered: false });
  }

  await db.models.Team.insertMany([
    { id: 'BENCH-TM-A', name: 'Bench Team A' },
    { id: 'BENCH-TM-B', name: 'Bench Team B' }
  ]);

  await db.models.Match.create({
    id: matchId,
    tournament_id: 'TRN-BENCH',
    tournament_name: 'Benchmark Cup',
    team_a_id: 'BENCH-TM-A',
    team_a_name: 'Bench Team A',
    team_b_id: 'BENCH-TM-B',
    team_b_name: 'Bench Team B',
    overs_per_side: 20,
    status: 'LIVE',
    assigned_scorer_id: 'SCR-101',
    team_a_playing_xi: ['BENCH-P-0', 'BENCH-P-1', 'BENCH-P-2'],
    team_b_playing_xi: ['BENCH-P-3', 'BENCH-P-4', 'BENCH-P-5']
  });

  await db.models.Innings.create({
    id: innId,
    match_id: matchId,
    innings_number: 1,
    batting_team_id: 'BENCH-TM-A',
    bowling_team_id: 'BENCH-TM-B',
    current_striker_id: 'BENCH-P-0',
    current_non_striker_id: 'BENCH-P-1',
    current_bowler_id: 'BENCH-P-3',
    status: 'LIVE',
    is_completed: false
  });

  const token = jwt.sign({ id: 'SCR-101', role: 'SCORER', email: 'scorer-dev@localhost.test' }, env.JWT_SECRET, { expiresIn: '1h' });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const pCount = await db.models.Player.countDocuments();
  const trCount = await db.models.TeamRegistration.countDocuments();
  console.log(`Seeded DB ready: Players=${pCount}, TeamRegistrations=${trCount}`);

  const timings = [];
  let lastServerTiming = '';
  for (let i = 0; i < 30; i++) {
    // Rotate bowler every 6 balls to avoid over-complete lock
    if (i > 0 && i % 6 === 0) {
      const nextBowler = i % 12 === 0 ? 'BENCH-P-3' : 'BENCH-P-4';
      await httpRequest(port, 'POST', `/api/scorer/matches/${matchId}/end-over`, { nextBowlerId: nextBowler }, token);
    }
    const t0 = process.hrtime.bigint();
    const res = await httpRequest(
      port,
      'POST',
      `/api/scorer/matches/${matchId}/deliveries`,
      {
        runsBatter: i % 2 === 0 ? 1 : 4,
        runsExtras: 0,
        extraType: 'NONE',
        clientDeliveryId: `bench-del-${Date.now()}-${i}`
      },
      token
    );
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (res.status !== 200) {
      console.error(`Delivery ${i} failed:`, res.status, res.body);
      process.exit(1);
    }
    timings.push(ms);
    if (res.headers['server-timing']) lastServerTiming = res.headers['server-timing'];
  }

  const sorted = [...timings].sort((a, b) => a - b);
  console.log('--- DELIVERY BENCHMARK RESULTS (30 sequential balls) ---');
  console.log(`Min: ${sorted[0].toFixed(2)} ms`);
  console.log(`p50: ${percentile(sorted, 50).toFixed(2)} ms`);
  console.log(`p95: ${percentile(sorted, 95).toFixed(2)} ms`);
  console.log(`p99: ${percentile(sorted, 99).toFixed(2)} ms`);
  console.log(`Max: ${sorted[sorted.length - 1].toFixed(2)} ms`);
  if (lastServerTiming) console.log(`Sample Server-Timing: ${lastServerTiming}`);

  // Verify query plans (no COLLSCAN)
  const explains = await Promise.all([
    db.models.Delivery.find({ match_id: matchId, innings_id: innId, over_number: 1, ball_number: 1 }).explain('executionStats'),
    db.models.InningsBatter.find({ innings_id: innId, player_id: 'BENCH-P-0' }).explain('executionStats'),
    db.models.InningsBowler.find({ innings_id: innId, player_id: 'BENCH-P-3' }).explain('executionStats'),
    db.models.Innings.find({ match_id: matchId, innings_number: 1 }).explain('executionStats'),
    db.models.Match.find({ id: matchId }).explain('executionStats')
  ]);
  const names = ['Delivery', 'InningsBatter', 'InningsBowler', 'Innings', 'Match'];
  explains.forEach((ex, idx) => {
    const stage = ex?.queryPlanner?.winningPlan?.stage || ex?.queryPlanner?.winningPlan?.inputStage?.stage;
    const inputStage = ex?.queryPlanner?.winningPlan?.inputStage?.stage || '';
    console.log(`Explain [${names[idx]}]: stage=${stage}${inputStage ? ` -> ${inputStage}` : ''}`);
  });

  server.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

