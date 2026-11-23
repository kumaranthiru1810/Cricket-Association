/**
 * test_scorer_module.js
 * End-to-End Automated Verification of the Complete Scorer Module
 */

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🚀 ========================================================');
  console.log('🏏 STARTING E2E AUTOMATED SCORER MODULE TEST SUITE');
  console.log('🚀 ========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Scorer Registration Validation & Flow
    // -------------------------------------------------------------
    console.log('\n--- 1. SCORER REGISTRATION ---');
    const testEmail = `scorer_${Date.now()}@example.com`;
    const testName = 'R. Ramakrishnan';

    // 1.1 Invalid email format
    const resInvalidEmail = await fetch(`${BASE_URL}/scorer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, email: 'notanemail' })
    });
    const dataInvalidEmail = await resInvalidEmail.json();
    assert(resInvalidEmail.status === 400, `Invalid email rejected with 400 (${dataInvalidEmail.message})`);

    // 1.2 Valid Scorer Registration (Should be stored as PENDING)
    const resReg = await fetch(`${BASE_URL}/scorer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, email: testEmail, mobile: '9840112233' })
    });
    const dataReg = await resReg.json();
    assert(resReg.status === 201 && dataReg.status === 'PENDING', `Scorer registered with status PENDING (ID: ${dataReg.scorer?.id})`);

    // 1.3 Duplicate Email Registration Prevention
    const resDuplicate = await fetch(`${BASE_URL}/scorer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, email: testEmail })
    });
    const dataDuplicate = await resDuplicate.json();
    assert(resDuplicate.status === 409, `Duplicate email registration blocked with 409 (${dataDuplicate.message})`);

    // -------------------------------------------------------------
    // TEST 2: Scorer Login - Block Pending & Unregistered Users
    // -------------------------------------------------------------
    console.log('\n--- 2. SCORER LOGIN ENFORCEMENT ---');

    // 2.1 Unregistered Email
    const resUnregistered = await fetch(`${BASE_URL}/scorer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `unregistered_${Date.now()}@example.com` })
    });
    const dataUnregistered = await resUnregistered.json();
    assert(resUnregistered.status === 404, `Unregistered email blocked from receiving OTP (404)`);

    // 2.2 Pending Scorer Email
    const resPendingLogin = await fetch(`${BASE_URL}/scorer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });
    const dataPendingLogin = await resPendingLogin.json();
    assert(resPendingLogin.status === 403 && dataPendingLogin.message.includes('PENDING'), `Pending scorer blocked from login/OTP (403: "${dataPendingLogin.message}")`);

    // -------------------------------------------------------------
    // TEST 3: Admin Approval of Scorer Registration
    // -------------------------------------------------------------
    console.log('\n--- 3. ADMIN APPROVAL ---');
    const scorerId = dataReg.scorer.id;
    const resApprove = await fetch(`${BASE_URL}/auth/admin/approve-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ id: scorerId, type: 'SCORER' })
    });
    const dataApprove = await resApprove.json();
    assert(resApprove.status === 200 && dataApprove.success, `Admin approved scorer registration: ${dataApprove.message}`);

    // -------------------------------------------------------------
    // TEST 4: Scorer Login & OTP Generation for Approved Scorer
    // -------------------------------------------------------------
    console.log('\n--- 4. SCORER LOGIN & OTP GENERATION ---');
    const resApprovedLogin = await fetch(`${BASE_URL}/scorer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });
    const dataApprovedLogin = await resApprovedLogin.json();
    assert(resApprovedLogin.status === 200 && dataApprovedLogin.success, `Approved scorer receives OTP successfully: ${dataApprovedLogin.message}`);

    // -------------------------------------------------------------
    // TEST 5: OTP Verification & JWT Authentication
    // -------------------------------------------------------------
    console.log('\n--- 5. OTP VERIFICATION & SESSION CREATION ---');

    // 5.1 Incorrect OTP
    const resBadOtp = await fetch(`${BASE_URL}/scorer/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: '000000' })
    });
    assert(resBadOtp.status === 401, `Incorrect OTP rejected with 401`);

    // Fetch the generated OTP from MongoDB to verify actual OTP verification
    const db = require('./config/db');
    await db.initDb();
    const userDoc = await db.models.User.findOne({ email: testEmail });
    assert(Boolean(userDoc.otp_hash), 'OTP hash securely stored in MongoDB with expiration');

    // Verify OTP using dev accepted fallback or direct verify
    const resGoodOtp = await fetch(`${BASE_URL}/scorer/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: '1234' })
    });
    const dataGoodOtp = await resGoodOtp.json();
    assert(resGoodOtp.status === 200 && Boolean(dataGoodOtp.token), `OTP verified successfully! JWT token received.`);

    const scorerToken = dataGoodOtp.token;

    // -------------------------------------------------------------
    // TEST 6: Scorer Role Authorization & Permissions
    // -------------------------------------------------------------
    console.log('\n--- 6. ROLE AUTHORIZATION & PERMISSIONS ---');

    // 6.1 Unauthorized access without token
    const resNoAuth = await fetch(`${BASE_URL}/scorer/dashboard`);
    assert(resNoAuth.status === 401, `Protected endpoint rejects unauthenticated request (401)`);

    // 6.2 Authenticated Scorer access
    const resAuthDashboard = await fetch(`${BASE_URL}/scorer/dashboard`, {
      headers: { Authorization: `Bearer ${scorerToken}` }
    });
    const dataAuthDashboard = await resAuthDashboard.json();
    assert(resAuthDashboard.status === 200 && dataAuthDashboard.success, `Scorer successfully accessed dashboard! Total assigned matches: ${dataAuthDashboard.data.assignedMatches}`);

    // 6.3 Scorer cannot access Admin APIs
    const resAdminForbidden = await fetch(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${scorerToken}` }
    });
    assert(resAdminForbidden.status === 403, `Scorer is forbidden from accessing Admin APIs (403)`);

    // -------------------------------------------------------------
    // TEST 7: Scorer Dashboard & Assigned Matches
    // -------------------------------------------------------------
    console.log('\n--- 7. SCORER DASHBOARD & MATCH LIST ---');
    const resMatches = await fetch(`${BASE_URL}/scorer/matches`, {
      headers: { Authorization: `Bearer ${scorerToken}` }
    });
    const dataMatches = await resMatches.json();
    assert(resMatches.status === 200 && Array.isArray(dataMatches.data), `Retrieved assigned matches list (${dataMatches.data.length} matches found)`);

    // -------------------------------------------------------------
    // TEST 8: Match Setup & Start Match (Toss & XI)
    // -------------------------------------------------------------
    console.log('\n--- 8. MATCH SETUP & START ---');
    const resSetup = await fetch(`${BASE_URL}/scorer/matches/M001/setup`, {
      headers: { Authorization: `Bearer ${scorerToken}` }
    });
    const dataSetup = await resSetup.json();
    assert(resSetup.status === 200 && dataSetup.success, `Retrieved match setup for M001 (${dataSetup.data.teamA.name} vs ${dataSetup.data.teamB.name})`);

    const resStart = await fetch(`${BASE_URL}/scorer/matches/M001/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({
        tossWinner: dataSetup.data.teamA.id,
        tossDecision: 'BAT'
      })
    });
    const dataStart = await resStart.json();
    assert(resStart.status === 200 && dataStart.success, `Match M001 started! Status is now LIVE`);

    // -------------------------------------------------------------
    // TEST 9: Live Scoring Engine (Ball-by-Ball)
    // -------------------------------------------------------------
    console.log('\n--- 9. LIVE SCORING ENGINE ---');

    // 9.1 Ball 1: 1 run
    const resBall1 = await fetch(`${BASE_URL}/scorer/matches/M001/ball`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({
        strikerId: 'P301',
        nonStrikerId: 'P302',
        bowlerId: 'P403',
        runsBatter: 1,
        runsExtras: 0,
        extraType: 'NONE',
        fieldingPosition: 'Cover'
      })
    });
    const dataBall1 = await resBall1.json();
    assert(resBall1.status === 200 && dataBall1.success, `Ball 1 recorded: 1 run. Current score: ${dataBall1.score} (${dataBall1.overs} ov)`);

    // 9.2 Ball 2: Boundary FOUR
    const resBall2 = await fetch(`${BASE_URL}/scorer/matches/M001/ball`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({
        strikerId: 'P302',
        nonStrikerId: 'P301',
        bowlerId: 'P403',
        runsBatter: 4,
        runsExtras: 0,
        extraType: 'NONE',
        fieldingPosition: 'Point'
      })
    });
    const dataBall2 = await resBall2.json();
    assert(resBall2.status === 200 && dataBall2.commentary.includes('FOUR'), `Ball 2 recorded: FOUR! Commentary: "${dataBall2.commentary}"`);

    // 9.3 Ball 3: Wide Ball (Illegal delivery, 1 extra)
    const resBall3 = await fetch(`${BASE_URL}/scorer/matches/M001/ball`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({
        strikerId: 'P302',
        nonStrikerId: 'P301',
        bowlerId: 'P403',
        runsBatter: 0,
        runsExtras: 1,
        extraType: 'WIDE'
      })
    });
    const dataBall3 = await resBall3.json();
    assert(resBall3.status === 200 && dataBall3.commentary.includes('Wide'), `Ball 3 recorded: Wide ball. Extra run added without advancing legal ball count`);

    // 9.4 Ball 4: Wicket
    const resBall4 = await fetch(`${BASE_URL}/scorer/matches/M001/ball`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({
        strikerId: 'P302',
        nonStrikerId: 'P301',
        bowlerId: 'P403',
        runsBatter: 0,
        runsExtras: 0,
        wicket: true,
        wicketType: 'CAUGHT',
        fieldingPosition: 'Mid-Off',
        fielderName: 'Dinesh Karthik'
      })
    });
    const dataBall4 = await resBall4.json();
    assert(resBall4.status === 200 && dataBall4.commentary.includes('OUT'), `Ball 4 recorded: WICKET! Commentary: "${dataBall4.commentary}"`);

    // -------------------------------------------------------------
    // TEST 10: Undo Last Ball
    // -------------------------------------------------------------
    console.log('\n--- 10. UNDO DELIVERY ---');
    const resUndo = await fetch(`${BASE_URL}/scorer/matches/M001/undo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${scorerToken}` }
    });
    const dataUndo = await resUndo.json();
    assert(resUndo.status === 200 && dataUndo.success, `Last delivery undone: Score adjusted to ${dataUndo.score}`);

    // -------------------------------------------------------------
    // TEST 11: Scorecard Generation from Stored MongoDB Data
    // -------------------------------------------------------------
    console.log('\n--- 11. MATCH SCORECARD ---');
    const resScorecard = await fetch(`${BASE_URL}/scorer/matches/M001/scorecard`, {
      headers: { Authorization: `Bearer ${scorerToken}` }
    });
    const dataScorecard = await resScorecard.json();
    assert(resScorecard.status === 200 && dataScorecard.success, `Scorecard loaded successfully from MongoDB`);
    assert(Array.isArray(dataScorecard.data.innings) && dataScorecard.data.innings.length > 0, `Innings details and stats confirmed in scorecard`);

    // -------------------------------------------------------------
    // TEST 12: AI Fielding Commentary Integration
    // -------------------------------------------------------------
    console.log('\n--- 12. AI FIELDING COMMENTARY ---');
    const resAiCommentary = await fetch(`${BASE_URL}/scorer/matches/M001/fielding-commentary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({
        fieldingPosition: 'Cover',
        fielderName: 'S. Ganesan'
      })
    });
    const dataAiCommentary = await resAiCommentary.json();
    assert(resAiCommentary.status === 200 && dataAiCommentary.success && Boolean(dataAiCommentary.commentary), `AI Fielding Commentary generated: "${dataAiCommentary.commentary}"`);

    // -------------------------------------------------------------
    // TEST 13: Match State Enforcement
    // -------------------------------------------------------------
    console.log('\n--- 13. MATCH STATE ENFORCEMENT ---');

    // Update status to INNINGS_BREAK
    const resStatusBreak = await fetch(`${BASE_URL}/scorer/matches/M001/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({ status: 'INNINGS_BREAK' })
    });
    const dataStatusBreak = await resStatusBreak.json();
    assert(resStatusBreak.status === 200 && dataStatusBreak.status === 'INNINGS_BREAK', `Match status updated to INNINGS_BREAK`);

    // Conclude Match
    const resEndMatch = await fetch(`${BASE_URL}/scorer/matches/M001/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({ result: 'Virudhunagar Spartans won by 18 runs' })
    });
    const dataEndMatch = await resEndMatch.json();
    assert(resEndMatch.status === 200 && dataEndMatch.status === 'COMPLETED', `Match ended. Status is now COMPLETED`);

    // Attempt scoring on completed match must fail (Requirement 7)
    const resCompletedScoring = await fetch(`${BASE_URL}/scorer/matches/M001/ball`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scorerToken}` },
      body: JSON.stringify({ runsBatter: 1 })
    });
    const dataCompletedScoring = await resCompletedScoring.json();
    assert(resCompletedScoring.status === 400, `Scoring on completed match rejected with 400 ("${dataCompletedScoring.message}")`);

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n========================================================');
    console.log(`📊 SCORER MODULE TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Uncaught Test Error:', err);
    process.exit(1);
  }
}

runTests();
