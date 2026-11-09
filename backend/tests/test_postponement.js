/**
 * backend/tests/test_postponement.js
 * Comprehensive automated tests for Match Postponement and Rescheduling.
 */

const assert = require('assert');
const db = require('../config/db');
const adminService = require('../services/adminService');
const umpireService = require('../services/umpireService');
const { getTodayKolkata, getFutureDateKolkata } = require('../utils/dateTimeValidation');

async function runTests() {
  console.log('\n--- 1. Initializing DB for Postponement Tests ---');
  await db.initDb();

  const testMatchId = `TEST-MATCH-${Date.now()}`;
  const todayStr = getTodayKolkata();
  const futureDate1 = getFutureDateKolkata(5);
  const futureDate2 = getFutureDateKolkata(6);

  // Clean up any old test matches
  await db.models.Match.deleteMany({ id: /^TEST-MATCH-/ });

  // Create a scheduled match fixture
  const newMatch = await db.models.Match.create({
    id: testMatchId,
    tournament_id: 'T-2026-VPL',
    tournament_name: 'Virudhunagar Premier League 2026',
    team_a_id: 'TM-01',
    team_b_id: 'TM-02',
    team_a_name: 'Virudhunagar Spartans',
    team_b_name: 'Rajapalayam Royals',
    venue: 'Kamarajar District Stadium',
    match_date: futureDate1,
    match_time: '10:00 AM',
    match_type: 'T20',
    overs_per_side: 20,
    status: 'SCHEDULED',
    umpire1_id: 'UMP-101',
    umpire1_name: 'Thiru. K. Sundaram',
    assigned_scorer_id: 'SCR-101'
  });
  console.log('Created test match fixture:', newMatch.id);
  assert.strictEqual(newMatch.status, 'SCHEDULED');

  console.log('\n--- 2. Test Postponing Without Reason -> Expect Error ---');
  try {
    await adminService.postponeMatch(testMatchId, { reason: '' }, 'admin@cfvd.org');
    assert.fail('Should have failed without reason');
  } catch (err) {
    console.log('Correctly rejected postponement without reason:', err.message);
    assert(err.message.includes('mandatory reason is required'));
  }

  console.log('\n--- 3. Test Admin Postpones Match With Valid Reason ---');
  const postponedMatch = await adminService.postponeMatch(
    testMatchId,
    { reason: 'Severe tropical cyclone warning and waterlogged outfield' },
    'admin@cfvd.org'
  );
  console.log('Postponed match status:', postponedMatch.status);
  assert.strictEqual(postponedMatch.status, 'POSTPONED');
  assert.strictEqual(postponedMatch.postponement.is_postponed, true);
  assert(postponedMatch.postponement.reason.includes('cyclone warning'));
  assert.strictEqual(postponedMatch.postponement.original_date, futureDate1);
  assert.strictEqual(postponedMatch.postponement.original_time, '10:00 AM');
  assert(postponedMatch.postponement_history.length >= 1);
  assert.strictEqual(postponedMatch.postponement_history[0].action, 'POSTPONED');

  console.log('\n--- 4. Test Rescheduling with Past Date -> Expect Validation Error ---');
  try {
    await adminService.rescheduleMatch(
      testMatchId,
      { newDate: '2026-10-01', newTime: '10:00 AM', reason: 'Past date' },
      'admin@cfvd.org'
    );
    assert.fail('Should have rejected past date');
  } catch (err) {
    console.log('Correctly rejected past reschedule date:', err.message);
    assert(err.message.includes('cannot be in the past'));
  }

  console.log('\n--- 5. Test Rescheduling with Valid Future Date and Time ---');
  const rescheduledMatch = await adminService.rescheduleMatch(
    testMatchId,
    {
      newDate: futureDate2,
      newTime: '02:30 PM',
      reason: 'Outfield drained and clear weather forecast'
    },
    'admin@cfvd.org'
  );
  console.log('Rescheduled match status:', rescheduledMatch.status);
  assert.strictEqual(rescheduledMatch.status, 'SCHEDULED');
  assert.strictEqual(rescheduledMatch.match_date, futureDate2);
  assert.strictEqual(rescheduledMatch.match_time, '02:30 PM');
  assert.strictEqual(rescheduledMatch.postponement.rescheduled_date, futureDate2);
  assert.strictEqual(rescheduledMatch.postponement.rescheduled_time, '02:30 PM');
  assert(rescheduledMatch.postponement_history.length >= 2);
  assert.strictEqual(rescheduledMatch.postponement_history[1].action, 'RESCHEDULED');

  console.log('\n--- 6. Test Umpire Requests Postponement ---');
  const mockUmpireUser = {
    id: 'UMP-101',
    name: 'Thiru. K. Sundaram',
    email: 'sundaram@cfvd.org',
    role: 'UMPIRE'
  };
  const umpReqResult = await umpireService.requestPostponement(
    testMatchId,
    { reason: 'Pitch damaged by heavy pre-match rain', notes: 'Soil too loose to hold pitch matting securely' },
    mockUmpireUser
  );
  console.log('Umpire request submitted. Request status:', umpReqResult.umpire_postponement_request?.status);
  assert.strictEqual(umpReqResult.umpire_postponement_request.requested, true);
  assert.strictEqual(umpReqResult.umpire_postponement_request.status, 'PENDING');
  assert(umpReqResult.umpire_postponement_request.reason.includes('Pitch damaged'));

  console.log('\n--- 7. Test Admin Gets Pending Postponement Requests ---');
  const pendingRequests = await adminService.getPostponementRequests();
  console.log('Total pending postponement requests found:', pendingRequests.length);
  const foundReq = pendingRequests.find(r => r.id === testMatchId);
  assert(foundReq, 'Should find the pending test match request');

  console.log('\n--- 8. Test Admin Rejects Umpire Request ---');
  const rejectedMatch = await adminService.reviewUmpirePostponement(
    testMatchId,
    { decision: 'REJECT', reviewNotes: 'Groundstaff have dried pitch using super sopper; match can proceed' },
    'admin@cfvd.org'
  );
  assert.strictEqual(rejectedMatch.status, 'SCHEDULED'); // Remains scheduled
  assert.strictEqual(rejectedMatch.umpire_postponement_request.status, 'REJECTED');
  console.log('Rejection confirmed. Request status is now:', rejectedMatch.umpire_postponement_request.status);

  console.log('\n--- 9. Test Umpire Requests Again & Admin Approves ---');
  await umpireService.requestPostponement(
    testMatchId,
    { reason: 'Lightning storm in stadium perimeter', notes: 'Player safety danger' },
    mockUmpireUser
  );
  const approvedMatch = await adminService.reviewUmpirePostponement(
    testMatchId,
    { decision: 'APPROVE', reviewNotes: 'Approved due to thunderstorm' },
    'admin@cfvd.org'
  );
  assert.strictEqual(approvedMatch.status, 'POSTPONED');
  assert.strictEqual(approvedMatch.umpire_postponement_request.status, 'APPROVED');
  assert(approvedMatch.postponement.reason.includes('Lightning storm'));
  console.log('Approval confirmed. Match status is now:', approvedMatch.status);

  // Clean up
  await db.models.Match.deleteOne({ id: testMatchId });

  console.log('\n======================================================');
  console.log('>>> ALL 9 MATCH POSTPONEMENT BACKEND TESTS PASSED! <<<');
  console.log('======================================================\n');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
