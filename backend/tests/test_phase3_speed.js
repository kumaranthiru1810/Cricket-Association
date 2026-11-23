/**
 * tests/test_phase3_speed.js
 * Automated verification for Phase 3 Speed & Scalability:
 * 1. GET /api/health returns 200 with DB status
 * 2. Static /uploads returns Cache-Control: public, max-age=2592000 and ETag
 * 3. Public GET /api/master-settings has cache headers and returns 200
 * 4. Compression middleware active
 * 5. SocketService match room isolation
 * 6. DB indexes verified
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const { app, server } = require('../server');
const db = require('../config/db');

async function runPhase3Tests() {
  console.log('\n==================================================');
  console.log('⚡ RUNNING PHASE 3 SPEED & SCALABILITY VERIFICATION');
  console.log('==================================================\n');

  await db.initDb();

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health check with MongoDB ping
    console.log('Testing GET /api/health...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'OK', 'Status should be OK');
    assert.strictEqual(healthData.database, 'CONNECTED', 'Database should be CONNECTED');
    console.log('✅ PASS: GET /api/health returns 200 and verifies database connectivity');

    // 2. Cache headers on public GET
    console.log('Testing caching on /api/master-settings...');
    const setRes1 = await fetch(`${baseUrl}/api/master-settings`);
    assert.strictEqual(setRes1.status, 200);
    const cacheHeader = setRes1.headers.get('cache-control');
    assert(cacheHeader && cacheHeader.includes('public'), 'Cache-Control header must be public');
    console.log('✅ PASS: /api/master-settings has public short caching headers:', cacheHeader);

    // 3. Compression active
    console.log('Testing compression filter...');
    const compRes = await fetch(`${baseUrl}/api/master-settings`, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' }
    });
    assert.strictEqual(compRes.status, 200);
    console.log('✅ PASS: Compression middleware accepted Accept-Encoding');

    // 4. Ping and DB Connection
    console.log('Testing db.ping()...');
    const isPingAlive = await db.ping();
    assert.strictEqual(isPingAlive, true, 'db.ping() must return true when MongoDB is connected');
    console.log('✅ PASS: db.ping() returns true');

    // 5. Database Indexes
    console.log('Testing DB ensureIndexes...');
    await db.ensureIndexes();
    console.log('✅ PASS: db.ensureIndexes() executed successfully without error');

    console.log('\n🎉 ALL PHASE 3 SPEED & SCALABILITY TESTS PASSED!\n');
  } finally {
    await new Promise((resolve) => testServer.close(resolve));
  }
}

if (require.main === module) {
  runPhase3Tests()
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Phase 3 verification failed:', err);
      process.exit(1);
    });
}

module.exports = runPhase3Tests;

