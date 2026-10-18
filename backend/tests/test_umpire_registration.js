/**
 * backend/tests/test_umpire_registration.js
 * 
 * Comprehensive automated test suite for Umpire Registration flow:
 * 1. Register Umpire WITHOUT mobile, dob, gender, address
 * 2. Verify validation: required fields (name, email, qualification, experience, district, state, password)
 * 3. Verify user created in MongoDB with role='UMPIRE', status='PENDING'
 * 4. Verify login blocked while status='PENDING'
 * 5. Verify admin getAllRegistrations includes Umpire with type='UMPIRE'
 * 6. Verify admin approval flow -> status becomes 'ACTIVE'
 * 7. Verify Umpire login succeeds with role='UMPIRE' and returns umpire_details
 * 8. Verify admin rejection flow -> status becomes 'REJECTED' with rejection reason
 * 9. Verify rejected umpire cannot log in
 */

const mongoose = require('mongoose');
const authService = require('../services/authService');
const { models } = require('../config/db');
const { User, Notification } = models;

async function runUmpireRegistrationTests() {
  console.log('==================================================');
  console.log('⚖️ RUNNING UMPIRE REGISTRATION AUTOMATED TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Connect to database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/cricket_db');
    }

    const testTimestamp = Date.now();
    const testEmail = `test.umpire.${testTimestamp}@cfvd.org`;
    const testRejectEmail = `test.reject.umpire.${testTimestamp}@cfvd.org`;

    // 1. Verify required field validation
    try {
      await authService.registerUmpire({
        name: 'Incomplete Umpire',
        email: 'invalid@cfvd.org'
        // missing qualification, experience, district, state, password
      });
      assert(false, '1. Validation rejects registration with missing required fields');
    } catch (err) {
      assert(
        (err.message || '').includes('required'),
        '1. Validation rejects registration with missing required fields: ' + (err.message || '')
      );
    }

    // 2. Successful Umpire Registration WITHOUT mobile, dob, gender, address
    const regResult = await authService.registerUmpire({
      name: 'Thiru. K. Senthil Nathan',
      email: testEmail,
      qualification: 'BCCI Level 2 Certified Umpire',
      experience: '7 Years',
      experience_years: 7,
      district: 'Virudhunagar',
      state: 'Tamil Nadu',
      certification_number: 'CFVD-UMP-2026-778',
      specialization: 'On-field Umpire',
      previous_organization: 'Tamil Nadu Cricket Association Panel',
      password: 'password123'
      // Note: mobile, dob, gender, address are intentionally omitted!
    });

    assert(
      regResult && regResult.success && regResult.status === 'PENDING' && regResult.umpire && regResult.umpire.role === 'UMPIRE',
      '2. Register Umpire without mobile, dob, gender, address -> role: UMPIRE, status: PENDING'
    );

    // 3. Verify User document in MongoDB
    const userInDb = await User.findOne({ email: testEmail });
    assert(
      userInDb &&
      userInDb.role === 'UMPIRE' &&
      userInDb.status === 'PENDING' &&
      userInDb.umpire_details &&
      userInDb.umpire_details.qualification === 'BCCI Level 2 Certified Umpire' &&
      userInDb.umpire_details.district === 'Virudhunagar' &&
      !userInDb.mobile,
      '3. User document stored in MongoDB with correct umpire_details and role UMPIRE'
    );

    // 4. Umpire login blocked while PENDING
    try {
      await authService.login(testEmail, 'password123');
      assert(false, '4. Umpire login must be BLOCKED while status is PENDING');
    } catch (err) {
      assert(
        (err.message || '').toLowerCase().includes('pending') || (err.message || '').toLowerCase().includes('approval'),
        '4. Umpire login blocked with pending approval notice: ' + (err.message || '')
      );
    }

    // 5. Admin getAllRegistrations includes Umpire
    const allRegistrations = await authService.getAllRegistrations(null, 'UMPIRE');
    const umpireRegistration = allRegistrations.find(r => r.email === testEmail);
    assert(
      umpireRegistration &&
      umpireRegistration.type === 'UMPIRE' &&
      umpireRegistration.name === 'Thiru. K. Senthil Nathan' &&
      umpireRegistration.status === 'PENDING',
      '5. Admin getAllRegistrations retrieves pending Umpire application with all details'
    );

    // 6. Admin Approves Umpire
    const approvalResult = await authService.updateUmpireStatus(testEmail, 'ACTIVE');
    assert(
      approvalResult && approvalResult.success && approvalResult.umpire && approvalResult.umpire.status === 'ACTIVE',
      '6. Admin approves umpire registration -> status becomes ACTIVE'
    );

    // 7. Umpire login succeeds after approval
    const loginResult = await authService.login(testEmail, 'password123');
    assert(
      loginResult &&
      loginResult.user &&
      loginResult.user.role === 'UMPIRE' &&
      loginResult.user.status === 'ACTIVE' &&
      loginResult.token,
      '7. Approved Umpire logs in successfully with role=UMPIRE and receives JWT token'
    );

    // 8. Test rejection flow on second umpire
    await authService.registerUmpire({
      name: 'Thiru. M. Muthukumar',
      email: testRejectEmail,
      qualification: 'District Certified Umpire',
      experience: '2 Years',
      district: 'Sivakasi',
      state: 'Tamil Nadu',
      password: 'password123'
    });

    const rejectionReason = 'Officiating certification credentials expired. Renewal required.';
    const rejectResult = await authService.updateUmpireStatus(testRejectEmail, 'REJECTED', rejectionReason);
    assert(
      rejectResult &&
      rejectResult.success &&
      rejectResult.umpire &&
      rejectResult.umpire.status === 'REJECTED',
      '8. Admin rejects umpire registration with official council reason'
    );

    // 9. Verify rejected umpire cannot log in
    try {
      await authService.login(testRejectEmail, 'password123');
      assert(false, '9. Rejected Umpire login must be BLOCKED');
    } catch (err) {
      assert(
        (err.message || '').toLowerCase().includes('rejected') || (err.message || '').toLowerCase().includes('inactive'),
        '9. Rejected Umpire login blocked: ' + (err.message || '')
      );
    }

    // Cleanup test users and notifications
    await User.deleteMany({ email: { $in: [testEmail, testRejectEmail] } });
    await Notification.deleteMany({ reference_id: { $in: [regResult.umpire.id, testRejectEmail] } });

    console.log('\n==================================================');
    console.log(`TOTAL TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test Suite encountered fatal error:', error);
    process.exit(1);
  }
}

runUmpireRegistrationTests();
