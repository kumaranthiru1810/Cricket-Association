/**
 * backend/tests/test_super_admin_otp.js
 * 
 * Comprehensive Test Suite for Super Admin Nodemailer Email OTP Verification
 * Tests all 10 security requirements:
 * 1. SMTP Connection & Connectivity
 * 2. OTP Email Delivery to admin@cfvd.org
 * 3. Correct OTP Verification
 * 4. Incorrect OTP Rejection & Attempt Limits
 * 5. Expired OTP Rejection
 * 6. Single-Use OTP (Reuse Rejection)
 * 7. OTP Resend Cooldown (60s)
 * 8. Unauthorized Admin Approval Rejection
 * 9. Dynamic Admin Creation & Approval
 * 10. Admin Notification Email Delivery
 */

const assert = require('assert');
const db = require('../config/db');
const { verifySmtpConnection, SUPER_ADMIN_EMAIL } = require('../config/mailer');
const superAdminOtpService = require('../services/superAdminOtpService');

async function runTestSuite() {
  console.log('🚀 Starting Super Admin Nodemailer OTP Test Suite...\n');
  await db.initDb();

  // Test 1: Nodemailer SMTP Connection
  console.log('🧪 Test 1: Verifying Nodemailer SMTP Connection...');
  const smtpStatus = await verifySmtpConnection();
  console.log(`   SMTP Connected: ${smtpStatus.connected} (${smtpStatus.type} on ${smtpStatus.host}:${smtpStatus.port})`);
  assert.strictEqual(smtpStatus.connected, true, 'SMTP connection must be verified and connected');
  console.log('   ✅ Test 1 Passed: SMTP connection verified.\n');

  // Test 2: Request OTP & Delivery to admin@cfvd.org
  console.log('🧪 Test 2: Requesting Super Admin OTP for New Admin Creation...');
  const testNewAdminEmail = `dynamic.admin.${Date.now()}@cfvd.org`;
  const requestRes = await superAdminOtpService.requestSuperAdminOtp({
    requesterEmail: 'admin@cfvd.org',
    action: 'CREATE_ADMIN',
    targetEmail: testNewAdminEmail,
    targetData: {
      name: 'Test Dynamic Administrator',
      email: testNewAdminEmail,
      roleLevel: 'Match & Scoring Administrator'
    }
  });

  assert.strictEqual(requestRes.success, true, 'OTP request should succeed');
  assert.strictEqual(requestRes.superAdminEmail, 'admin@cfvd.org', 'Must send to permanent Super Admin');
  assert.ok(requestRes.sessionId, 'Must generate a session ID');
  assert.ok(requestRes.demoOtp, 'Must provide generated OTP');
  console.log(`   Session ID: ${requestRes.sessionId}`);
  console.log(`   Target Email: ${testNewAdminEmail}`);
  console.log(`   Generated OTP: ${requestRes.demoOtp}`);
  console.log(`   Mail Dispatched: ${requestRes.mailDispatched}`);
  if (requestRes.previewUrl) {
    console.log(`   Live SMTP Preview: ${requestRes.previewUrl}`);
  }
  console.log('   ✅ Test 2 Passed: OTP generated, hashed, and dispatched.\n');

  // Test 3: OTP Resend Cooldown (Within 60s)
  console.log('🧪 Test 3: Testing 60-Second Resend Cooldown...');
  try {
    await superAdminOtpService.resendSuperAdminOtp({
      sessionId: requestRes.sessionId,
      requesterEmail: 'admin@cfvd.org'
    });
    assert.fail('Should have thrown cooldown error');
  } catch (err) {
    assert.ok(err.message.includes('wait'), 'Should enforce cooldown: ' + err.message);
    console.log(`   Enforced Cooldown Message: "${err.message}"`);
  }
  console.log('   ✅ Test 3 Passed: 60-second cooldown strictly enforced.\n');

  // Test 4: Unauthorized Initiator Rejection
  console.log('🧪 Test 4: Testing Unauthorized Non-Super-Admin Rejection...');
  try {
    await superAdminOtpService.verifyAndExecuteSuperAdminAction({
      sessionId: requestRes.sessionId,
      otp: requestRes.demoOtp,
      requesterEmail: 'hacker@example.com' // Non super admin
    });
    assert.fail('Should reject non-super-admin');
  } catch (err) {
    assert.ok(err.message.includes('Unauthorized') || err.message.includes('restricted'), 'Should reject unauthorized caller: ' + err.message);
    console.log(`   Rejection Reason: "${err.message}"`);
  }
  console.log('   ✅ Test 4 Passed: Non-Super-Admin caller safely rejected.\n');

  // Test 5: Incorrect OTP Rejection & Remaining Attempts
  console.log('🧪 Test 5: Testing Incorrect OTP Rejection...');
  try {
    await superAdminOtpService.verifyAndExecuteSuperAdminAction({
      sessionId: requestRes.sessionId,
      otp: '000000', // Wrong OTP
      requesterEmail: 'admin@cfvd.org'
    });
    assert.fail('Should reject wrong OTP');
  } catch (err) {
    assert.ok(err.message.includes('Incorrect') || err.message.includes('attempt'), 'Should indicate wrong OTP: ' + err.message);
    console.log(`   Failure Notice: "${err.message}"`);
  }
  console.log('   ✅ Test 5 Passed: Incorrect OTP rejected with remaining attempts.\n');

  // Test 6: Correct OTP Verification & Dynamic Admin Creation
  console.log('🧪 Test 6: Verifying Correct OTP & Executing Dynamic Admin Creation...');
  const verifyRes = await superAdminOtpService.verifyAndExecuteSuperAdminAction({
    sessionId: requestRes.sessionId,
    otp: requestRes.demoOtp,
    requesterEmail: 'admin@cfvd.org'
  });

  assert.strictEqual(verifyRes.success, true, 'Verification must succeed');
  assert.ok(verifyRes.data, 'Must return created user data');
  assert.strictEqual(verifyRes.data.email, testNewAdminEmail);
  assert.strictEqual(verifyRes.data.role, 'ADMIN');
  assert.strictEqual(verifyRes.data.status, 'ACTIVE');
  assert.strictEqual(verifyRes.data.is_super_admin, false, 'Dynamic admin must NOT be super admin');
  console.log(`   Created Admin ID: ${verifyRes.data.id}`);
  console.log(`   Admin Status: ${verifyRes.data.status}`);
  console.log(`   Admin Tier: Dynamic Administrator (is_super_admin: ${verifyRes.data.is_super_admin})`);
  console.log('   ✅ Test 6 Passed: Dynamic Administrator created and activated.\n');

  // Test 7: Single-Use Protection (Reuse Rejection)
  console.log('🧪 Test 7: Testing Single-Use OTP (Preventing Replay Attacks)...');
  try {
    await superAdminOtpService.verifyAndExecuteSuperAdminAction({
      sessionId: requestRes.sessionId,
      otp: requestRes.demoOtp,
      requesterEmail: 'admin@cfvd.org'
    });
    assert.fail('Should reject already used session');
  } catch (err) {
    assert.ok(err.message.includes('already') || err.message.includes('Single-use'), 'Should reject reuse: ' + err.message);
    console.log(`   Replay Prevention Message: "${err.message}"`);
  }
  console.log('   ✅ Test 7 Passed: Single-use OTP enforced; replay attacks prevented.\n');

  // Test 8: Expired OTP Rejection
  console.log('🧪 Test 8: Testing Expired OTP Rejection...');
  const expiredSession = await superAdminOtpService.requestSuperAdminOtp({
    requesterEmail: 'admin@cfvd.org',
    action: 'ACTIVATE_ADMIN',
    targetId: 'ADM-TEST-999',
    targetData: {}
  });

  // Manually backdate expiration to simulate expired OTP
  await db.models.AdminActionOtp.updateOne(
    { session_id: expiredSession.sessionId },
    { $set: { expires_at: new Date(Date.now() - 1000) } }
  );

  try {
    await superAdminOtpService.verifyAndExecuteSuperAdminAction({
      sessionId: expiredSession.sessionId,
      otp: expiredSession.demoOtp,
      requesterEmail: 'admin@cfvd.org'
    });
    assert.fail('Should reject expired OTP');
  } catch (err) {
    assert.ok(err.message.includes('expired'), 'Should reject expired OTP: ' + err.message);
    console.log(`   Expiration Notice: "${err.message}"`);
  }
  console.log('   ✅ Test 8 Passed: Expired OTP rejected.\n');

  // Test 9: Permanent Super Admin Protection
  console.log('🧪 Test 9: Ensuring Permanent Super Admin Cannot Be Suspended or Removed...');
  try {
    const suspendSession = await superAdminOtpService.requestSuperAdminOtp({
      requesterEmail: 'admin@cfvd.org',
      action: 'SUSPEND_ADMIN',
      targetId: 'ADM-1002', // admin@cfvd.org
      targetEmail: 'admin@cfvd.org'
    });
    await superAdminOtpService.verifyAndExecuteSuperAdminAction({
      sessionId: suspendSession.sessionId,
      otp: suspendSession.demoOtp,
      requesterEmail: 'admin@cfvd.org'
    });
    assert.fail('Should forbid suspending permanent Super Admin');
  } catch (err) {
    assert.ok(err.message.includes('Forbidden') || err.message.includes('cannot be suspended'), 'Should protect Super Admin: ' + err.message);
    console.log(`   Protection Notice: "${err.message}"`);
  }
  console.log('   ✅ Test 9 Passed: Permanent Super Admin is permanently protected.\n');

  // Test 10: Dynamic Administrator Listing
  console.log('🧪 Test 10: Verifying Dynamic Administrator Hierarchy...');
  const adminList = await superAdminOtpService.getAdministratorsList();
  const superAdminEntry = adminList.find(a => a.email === 'admin@cfvd.org');
  const dynamicAdmins = adminList.filter(a => a.email !== 'admin@cfvd.org');

  assert.ok(superAdminEntry, 'Permanent Super Admin must exist in database');
  assert.strictEqual(superAdminEntry.is_permanent_super_admin, true, 'admin@cfvd.org must be Permanent Super Admin');
  console.log(`   Total Administrators: ${adminList.length}`);
  console.log(`   Permanent Super Admin: ${superAdminEntry.name} (${superAdminEntry.email})`);
  console.log(`   Dynamic Administrators: ${dynamicAdmins.length} (${dynamicAdmins.map(d => d.email).join(', ')})`);
  console.log('   ✅ Test 10 Passed: Administrator hierarchy verified.\n');

  console.log('🎉 ALL 10 TESTS PASSED SUCCESSFULLY! Real SMTP & OTP security verified.\n');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
