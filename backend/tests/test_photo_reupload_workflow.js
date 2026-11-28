/**
 * backend/tests/test_photo_reupload_workflow.js
 * End-to-End Test: Admin Reject -> Player Login -> Re-upload -> Pending Review -> Repeated Reject -> Admin Approve
 */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const { app } = require('../server');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'cfvd-cricket-association-secret-2026';

async function makeValidPngDataUri() {
  const svg = Buffer.from(
    '<svg width="360" height="450" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="360" height="450" fill="#eef2f7"/>' +
    '<circle cx="180" cy="170" r="70" fill="#d9a88f" stroke="#222" stroke-width="3"/>' +
    '<rect x="100" y="250" width="160" height="160" rx="24" fill="#1e3a8a" stroke="#111" stroke-width="3"/>' +
    '</svg>'
  );
  const buf = await sharp(svg).png().toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function request(server, method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
          } catch (_e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  await db.initDb();
  const VALID_PNG_DATA_URI = await makeValidPngDataUri();
  const prefix = `PRW-${Date.now()}`;
  const playerId = `PLY-${prefix}-1`;
  const playerEmail = `${prefix.toLowerCase()}@test.local`;
  const adminEmail = `admin-${prefix.toLowerCase()}@test.local`;

  const server = app.listen(0, '127.0.0.1');
  try {
    await db.models.User.create({
      id: `ADM-${prefix}`,
      name: 'Test Admin',
      email: adminEmail,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    await db.models.User.create({
      id: playerId,
      name: 'Test Photo Player',
      email: playerEmail,
      role: 'PLAYER',
      status: 'ACTIVE',
      photo: VALID_PNG_DATA_URI,
      image_path: VALID_PNG_DATA_URI,
      photo_verification_status: 'PENDING_REVIEW'
    });
    await db.models.Player.create({
      id: playerId,
      team_id: 'TM-01',
      name: 'Test Photo Player',
      email: playerEmail,
      role: 'BATTER',
      status: 'ACTIVE',
      photo: VALID_PNG_DATA_URI,
      image_path: VALID_PNG_DATA_URI,
      photo_verification_status: 'PENDING_REVIEW'
    });

    const adminToken = jwt.sign({ id: `ADM-${prefix}`, email: adminEmail, role: 'ADMIN', tv: 0 }, JWT_SECRET);
    const playerToken = jwt.sign({ id: playerId, email: playerEmail, role: 'PLAYER', tv: 0 }, JWT_SECRET);
    const scorerToken = jwt.sign({ id: `SCR-${prefix}`, email: `scr-${prefix}@test.local`, role: 'SCORER', tv: 0 }, JWT_SECRET);

    // 1. Admin reject without reason -> 400
    const noReasonRes = await request(server, 'PATCH', `/api/admin/users/${playerId}/photo-verification`, {
      token: adminToken,
      body: { status: 'REJECTED', reason: '' }
    });
    assert.strictEqual(noReasonRes.status, 400, 'Rejecting without reason must fail with 400');

    // 2. Admin reject with reason -> 200, registration status stays ACTIVE
    const rejectRes1 = await request(server, 'PATCH', `/api/admin/users/${playerId}/photo-verification`, {
      token: adminToken,
      body: { status: 'REJECTED', reason: 'Blurry face in portrait' }
    });
    assert.strictEqual(rejectRes1.status, 200);
    assert.strictEqual(rejectRes1.body.photo_verification_status, 'REJECTED');
    const userAfterReject = await db.models.User.findOne({ id: playerId }).lean();
    assert.strictEqual(userAfterReject.status, 'ACTIVE', 'Registration status must remain ACTIVE when photo is rejected');

    // 3. Player login / profile fetch sees REJECTED & reason
    const profileRes1 = await request(server, 'GET', '/api/player/profile', { token: playerToken });
    assert.strictEqual(profileRes1.status, 200);
    assert.strictEqual(profileRes1.body.profile.photo_verification_status, 'REJECTED');
    assert.strictEqual(profileRes1.body.profile.photo_verification_reason, 'Blurry face in portrait');
    assert.strictEqual(profileRes1.body.profile.status, 'APPROVED');

    // 4. Unauthorized upload (no token / wrong role)
    const unauthRes = await request(server, 'PUT', '/api/player/profile', {
      body: { photo: VALID_PNG_DATA_URI }
    });
    assert.strictEqual(unauthRes.status, 401);
    const wrongRoleRes = await request(server, 'PUT', '/api/player/profile', {
      token: scorerToken,
      body: { photo: VALID_PNG_DATA_URI }
    });
    assert([401, 403].includes(wrongRoleRes.status), 'Non-player role must be rejected');

    // 5. Invalid file format -> 400
    const invalidFileRes = await request(server, 'PUT', '/api/player/profile', {
      token: playerToken,
      body: { photo: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }
    });
    assert.strictEqual(invalidFileRes.status, 400, 'Invalid image format (GIF) must be rejected');

    // 6. Player re-uploads valid PNG -> PENDING_REVIEW, preserves history, notifies admin
    const reuploadRes = await request(server, 'PUT', '/api/player/profile', {
      token: playerToken,
      body: { photo: VALID_PNG_DATA_URI, image_path: VALID_PNG_DATA_URI }
    });
    assert.strictEqual(reuploadRes.status, 200);
    assert.strictEqual(reuploadRes.body.profile.photo_verification_status, 'PENDING_REVIEW');
    assert.strictEqual(reuploadRes.body.profile.id, playerId, 'Player ID must not change');
    assert.strictEqual(reuploadRes.body.profile.status, 'APPROVED', 'Registration status must remain APPROVED');
    assert(
      reuploadRes.body.profile.photo_verification_history.some(h => h.status === 'REJECTED' && h.reason === 'Blurry face in portrait'),
      'Previous rejection reason must be preserved in history'
    );
    const adminNotif = await db.models.Notification.findOne({ type: 'PHOTO_REUPLOAD', reference_id: playerId }).lean();
    assert(adminNotif, 'Admin notification must be created on replacement photo upload');

    // 7. Repeated rejection -> history preserves both rejections
    const rejectRes2 = await request(server, 'PATCH', `/api/admin/users/${playerId}/photo-verification`, {
      token: adminToken,
      body: { status: 'REJECTED', reason: 'Background too dark' }
    });
    assert.strictEqual(rejectRes2.status, 200);
    assert.strictEqual(rejectRes2.body.photo_verification_history.length, 3);

    // 8. Admin approves replacement photo -> Player sees VERIFIED
    const approveRes = await request(server, 'PATCH', `/api/admin/users/${playerId}/photo-verification`, {
      token: adminToken,
      body: { status: 'VERIFIED', reason: 'Clear passport photo approved.' }
    });
    assert.strictEqual(approveRes.status, 200);
    const profileResFinal = await request(server, 'GET', '/api/player/profile', { token: playerToken });
    assert.strictEqual(profileResFinal.body.profile.photo_verification_status, 'VERIFIED');
    assert.strictEqual(profileResFinal.body.profile.id, playerId);

    console.log('✅ All Player Photo Rejection & Re-upload E2E tests passed!');
  } finally {
    server.close();
    await Promise.all([
      db.models.User.deleteMany({ id: { $in: [playerId, `ADM-${prefix}`] } }),
      db.models.Player.deleteMany({ id: playerId }),
      db.models.Notification.deleteMany({ $or: [{ target_user_id: playerId }, { reference_id: playerId }] })
    ]);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Photo re-upload E2E test failed:', err);
    process.exit(1);
  });
