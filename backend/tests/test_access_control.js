/**
 * backend/tests/test_access_control.js
 *
 * Automated Security & Integrity Test Suite for Dual-Admin Approval
 * and SUPER_ADMIN / ADMIN Role System.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const adminAccessService = require('../services/adminAccessService');
const { requireAdminAuth } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'cricket_super_secret_jwt_2026';
const OTP_SECRET = process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET || 'cricket_dual_admin_hmac_secret_2026';

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

async function main() {
  console.log('\n=============================================================');
  console.log('🔒 RUNNING DUAL-ADMIN ACCESS CONTROL & SECURITY TEST SUITE');
  console.log('=============================================================\n');

  await db.initDb();

  const User = db.models.User;
  const AdminRequest = db.models.AdminRequest;

  // Setup unique test fixtures
  const timestamp = Date.now();
  const superAdminEmail = `super.test.${timestamp}@cfvd.org`;
  const admin1Email = `admin1.test.${timestamp}@cfvd.org`;
  const admin2Email = `admin2.test.${timestamp}@cfvd.org`;
  const admin3Email = `admin3.test.${timestamp}@cfvd.org`;
  const candidateEmail = `candidate.test.${timestamp}@cfvd.org`;
  const bystanderEmail = `bystander.test.${timestamp}@cfvd.org`;

  // Seed test users
  const superAdmin = await User.create({
    id: `SA-${timestamp}`,
    name: 'Super Admin Test',
    email: superAdminEmail,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    token_version: 0
  });

  const admin1 = await User.create({
    id: `ADM1-${timestamp}`,
    name: 'Admin One Test',
    email: admin1Email,
    role: 'ADMIN',
    status: 'ACTIVE',
    token_version: 0
  });

  const admin2 = await User.create({
    id: `ADM2-${timestamp}`,
    name: 'Admin Two Test',
    email: admin2Email,
    role: 'ADMIN',
    status: 'ACTIVE',
    token_version: 0
  });

  const admin3 = await User.create({
    id: `ADM3-${timestamp}`,
    name: 'Admin Three Test',
    email: admin3Email,
    role: 'ADMIN',
    status: 'ACTIVE',
    token_version: 0
  });

  const candidate = await User.create({
    id: `CAN-${timestamp}`,
    name: 'Candidate Test',
    email: candidateEmail,
    role: 'USER',
    status: 'ACTIVE',
    token_version: 0
  });

  const bystander = await User.create({
    id: `BYS-${timestamp}`,
    name: 'Bystander Admin Test',
    email: bystanderEmail,
    role: 'ADMIN',
    status: 'ACTIVE',
    token_version: 0
  });

  const admin1Caller = {
    id: admin1.id,
    email: admin1.email,
    name: admin1.name,
    role: admin1.role
  };

  console.log('--- 1. SUPER_ADMIN IMMUNITY & SELF-REMOVAL RULES ---');

  await runTest('SUPER_ADMIN cannot be removed or demoted through remove request', async () => {
    try {
      await adminAccessService.requestRemove({
        targetAdminId: superAdmin.id,
        requestedBy: admin1Caller,
        ip: '127.0.0.1'
      });
      assert.fail('Should have rejected removing SUPER_ADMIN');
    } catch (err) {
      assert.strictEqual(err.status, 403, 'Must return 403 Forbidden');
      assert.ok(
        err.message.includes('Super Administrator account cannot be removed') ||
        err.message.includes('SUPER_ADMIN')
      );
    }
  });

  await runTest('Self-approval is blocked (requester cannot approve their own request)', async () => {
    const reqRes = await adminAccessService.requestPromote({
      email: candidateEmail,
      name: 'Candidate Test',
      requestedBy: admin1Caller,
      ip: '127.0.0.1'
    });
    assert.ok(reqRes.requestId, 'Request created');
    assert.strictEqual(reqRes.approvers.length, 2, 'Must pick 2 approvers');
    for (const app of reqRes.approvers) {
      assert.notStrictEqual(app.id, admin1.id, 'Requester must not be an approver');
    }
    await AdminRequest.deleteMany({ target_user_id: candidate.id });
  });

  console.log('\n--- 2. MINIMUM ACTIVE ADMIN ENFORCEMENT ---');

  await runTest('Removal blocked if active admins < 3', async () => {
    const allActiveAdmins = await User.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' });
    const preserveIds = [superAdmin.id, bystander.id];
    const toDeactivate = allActiveAdmins.filter(a => !preserveIds.includes(a.id)).map(a => a.id);

    await User.updateMany({ id: { $in: toDeactivate } }, { status: 'INACTIVE' });
    try {
      await adminAccessService.requestRemove({
        targetAdminId: bystander.id,
        requestedBy: { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN', name: superAdmin.name },
        ip: '127.0.0.1'
      });
      assert.fail('Should reject when active admins < 3');
    } catch (err) {
      assert.strictEqual(err.status, 400, 'Must return 400 Bad Request');
      assert.ok(err.message.includes('At least 3 active administrators'));
    } finally {
      await User.updateMany({ id: { $in: toDeactivate } }, { status: 'ACTIVE' });
    }
  });

  console.log('\n--- 3. CRYPTOGRAPHIC DUAL OTP & ATTEMPTS LOCKOUT ---');

  let activeRequestId = null;

  await runTest('Promote request generates HMAC-SHA256 hashed codes and conceals plain OTPs', async () => {
    const res = await adminAccessService.requestPromote({
      email: candidateEmail,
      name: 'Candidate Test',
      requestedBy: admin1Caller,
      ip: '127.0.0.1'
    });
    assert.ok(res.requestId, 'Session request ID returned');
    assert.strictEqual(res.approvers.length, 2);
    assert.strictEqual(res.otp1, undefined, 'Plain OTP1 must NEVER be returned');
    assert.strictEqual(res.otp2, undefined, 'Plain OTP2 must NEVER be returned');

    activeRequestId = res.requestId;

    const dbReq = await AdminRequest.findOne({ id: activeRequestId });
    assert.ok(dbReq.approver1_otp_hash, 'Hash 1 must exist');
    assert.ok(dbReq.approver2_otp_hash, 'Hash 2 must exist');
    assert.strictEqual(dbReq.status, 'PENDING');
  });

  await runTest('Incorrect OTP attempts increment attempt counter', async () => {
    try {
      await adminAccessService.verifyDualOtp({
        requestId: activeRequestId,
        otp1: '000000',
        otp2: '111111',
        ip: '127.0.0.1'
      });
      assert.fail('Should have rejected wrong OTP');
    } catch (err) {
      assert.ok(err.message.includes('Invalid') || err.message.includes('attempt') || err.message.includes('remaining'));
      const dbReq = await AdminRequest.findOne({ id: activeRequestId });
      assert.strictEqual(dbReq.attempts, 1, 'Attempts counter should be 1');
    }
  });

  await runTest('5 consecutive incorrect OTPs LOCK the request permanently', async () => {
    for (let i = 2; i <= 5; i++) {
      try {
        await adminAccessService.verifyDualOtp({
          requestId: activeRequestId,
          otp1: '000000',
          otp2: '111111',
          ip: '127.0.0.1'
        });
      } catch (err) {
        // Expected
      }
    }
    const dbReq = await AdminRequest.findOne({ id: activeRequestId });
    assert.strictEqual(dbReq.status, 'LOCKED', 'Request status must be LOCKED after 5 failed attempts');

    try {
      await adminAccessService.verifyDualOtp({
        requestId: activeRequestId,
        otp1: '123456',
        otp2: '654321',
        ip: '127.0.0.1'
      });
      assert.fail('Locked request should not accept verification');
    } catch (err) {
      assert.ok(err.message.includes('locked'), 'Should indicate request is locked');
    }
  });

  console.log('\n--- 4. ATOMIC ROLE UPDATE & TOKEN VERSION ISOLATION ---');

  await runTest('Dual removal executes atomically and affects ONLY target user', async () => {
    const initialTargetUser = await User.findOne({ id: bystander.id });
    const initialSuperAdmin = await User.findOne({ id: superAdmin.id });
    const initialAdmin1 = await User.findOne({ id: admin1.id });
    const initialAdmin2 = await User.findOne({ id: admin2.id });

    const removeRes = await adminAccessService.requestRemove({
      targetAdminId: bystander.id,
      requestedBy: admin1Caller,
      ip: '127.0.0.1'
    });

    const removeReqId = removeRes.requestId;

    const testOtp1 = '849201';
    const testOtp2 = '319482';
    const hash1 = crypto.createHmac('sha256', OTP_SECRET).update(testOtp1).digest('hex');
    const hash2 = crypto.createHmac('sha256', OTP_SECRET).update(testOtp2).digest('hex');

    await AdminRequest.updateOne(
      { id: removeReqId },
      { approver1_otp_hash: hash1, approver2_otp_hash: hash2 }
    );

    const verifyRes = await adminAccessService.verifyRemove({
      requestId: removeReqId,
      otp1: testOtp1,
      otp2: testOtp2,
      ip: '127.0.0.1'
    });

    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(verifyRes.user.role, 'USER');

    const updatedTargetUser = await User.findOne({ id: bystander.id });
    assert.strictEqual(updatedTargetUser.role, 'USER', 'Target role must be downgraded to USER');
    assert.strictEqual(
      updatedTargetUser.token_version,
      initialTargetUser.token_version + 1,
      'Target token_version must be incremented by 1'
    );

    const currentSuperAdmin = await User.findOne({ id: superAdmin.id });
    assert.strictEqual(currentSuperAdmin.role, 'SUPER_ADMIN');
    assert.strictEqual(currentSuperAdmin.token_version, initialSuperAdmin.token_version);

    const currentAdmin1 = await User.findOne({ id: admin1.id });
    assert.strictEqual(currentAdmin1.role, 'ADMIN');
    assert.strictEqual(currentAdmin1.token_version, initialAdmin1.token_version);

    const currentAdmin2 = await User.findOne({ id: admin2.id });
    assert.strictEqual(currentAdmin2.role, 'ADMIN');
    assert.strictEqual(currentAdmin2.token_version, initialAdmin2.token_version);
  });

  console.log('\n--- 5. IMMEDIATE SESSION INVALIDATION (TOKEN_VERSION CHECK) ---');

  await runTest('Revoked user token is immediately rejected by requireAdminAuth', async () => {
    // Stale token signed with old token_version (0) for bystander (now role=USER, tv=1)
    const staleToken = jwt.sign(
      { id: bystander.id, email: bystander.email, role: 'ADMIN', tv: 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const mockReq = {
      headers: { authorization: `Bearer ${staleToken}` },
      user: null
    };

    let statusCode = null;
    let errorResponse = null;
    let nextCalled = false;

    await new Promise(resolve => {
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              errorResponse = data;
              resolve();
            }
          };
        }
      };

      requireAdminAuth(mockReq, mockRes, () => {
        nextCalled = true;
        resolve();
      });
    });

    assert.strictEqual(nextCalled, false, 'Next middleware must NOT be called for revoked token');
    assert.ok(statusCode === 401 || statusCode === 403, 'Must reject with 401 or 403, got: ' + statusCode);
  });

  await runTest('Active admin token with valid token_version passes requireAdminAuth', async () => {
    const validToken = jwt.sign(
      { id: admin1.id, email: admin1.email, role: 'ADMIN', tv: admin1.token_version },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const mockReq = {
      headers: { authorization: `Bearer ${validToken}` },
      user: null
    };

    let nextCalled = false;

    await new Promise(resolve => {
      const mockRes = {
        status: (c) => ({
          json: (d) => {
            console.error('Unexpected res.status in pass test:', c, d);
            resolve();
          }
        })
      };

      requireAdminAuth(mockReq, mockRes, () => {
        nextCalled = true;
        resolve();
      });
    });

    assert.strictEqual(nextCalled, true, 'Valid admin token must be permitted');
    assert.strictEqual(mockReq.user.role, 'ADMIN');
  });

  // Clean up test data
  await User.deleteMany({ id: { $in: [superAdmin.id, admin1.id, admin2.id, admin3.id, candidate.id, bystander.id] } });
  await AdminRequest.deleteMany({ target_user_id: { $in: [candidate.id, bystander.id] } });

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
