/**
 * backend/tests/test_date_time_validation.js
 * Test suite for match schedule date and time validation.
 */

const assert = require('assert');
const {
  TIMEZONE,
  getKolkataNow,
  getTodayKolkata,
  formatTime12,
  parseTimeString,
  validateScheduleDate,
  validateScheduleDateTime
} = require('../utils/dateTimeValidation');

async function runTests() {
  console.log('\n--- 1. Testing Timezone & Current Time in Asia/Kolkata ---');
  assert.strictEqual(TIMEZONE, 'Asia/Kolkata');
  const now = getKolkataNow();
  console.log('Current Asia/Kolkata time:', now);
  assert(now.dateStr.match(/^\d{4}-\d{2}-\d{2}$/));
  assert(typeof now.totalMinutes === 'number' && now.totalMinutes >= 0 && now.totalMinutes < 1440);

  console.log('\n--- 2. Testing Case 1: Yesterday Date -> Reject ---');
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const yParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterday);
  const yesterdayResult = validateScheduleDateTime(yParts, '10:00 AM');
  console.log(`Testing yesterday (${yParts}):`, yesterdayResult);
  assert.strictEqual(yesterdayResult.isValid, false);
  assert.strictEqual(yesterdayResult.isPastDate, true);
  assert(yesterdayResult.error.includes('cannot be in the past'));

  console.log('\n--- 3. Testing Case 2: Today Date with Past Time -> Reject ---');
  // Past time today (e.g. 00:01 AM or 1 hour ago)
  const pastMinutes = Math.max(0, now.totalMinutes - 15);
  const pastH = Math.floor(pastMinutes / 60);
  const pastM = pastMinutes % 60;
  const pastTimeStr = formatTime12(pastH, pastM);
  const todayPastResult = validateScheduleDateTime(now.dateStr, pastTimeStr);
  console.log(`Testing today (${now.dateStr}) with past time (${pastTimeStr}):`, todayPastResult);
  assert.strictEqual(todayPastResult.isValid, false);
  assert.strictEqual(todayPastResult.isPastTime, true);
  assert(todayPastResult.error.includes('already passed for today'));

  console.log('\n--- 4. Testing Case 3: Today Date with Future Time -> Accept ---');
  if (now.totalMinutes < 1430) {
    const futureMinutes = Math.min(1439, now.totalMinutes + 30);
    const futH = Math.floor(futureMinutes / 60);
    const futM = futureMinutes % 60;
    const futTimeStr = formatTime12(futH, futM);
    const todayFutResult = validateScheduleDateTime(now.dateStr, futTimeStr);
    console.log(`Testing today (${now.dateStr}) with future time (${futTimeStr}):`, todayFutResult);
    assert.strictEqual(todayFutResult.isValid, true);
    assert.strictEqual(todayFutResult.error, null);
  } else {
    console.log('Skipping today future time test as it is the final minute of the day.');
  }

  console.log('\n--- 5. Testing Case 4: Tomorrow Date with Any Valid Time -> Accept ---');
  // Tomorrow's date in Asia/Kolkata
  const tomorrow = new Date(Date.now() + 26 * 3600 * 1000);
  const tomParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(tomorrow);
  const tomMorningResult = validateScheduleDateTime(tomParts, '07:00 AM');
  console.log(`Testing tomorrow (${tomParts}) with 07:00 AM:`, tomMorningResult);
  assert.strictEqual(tomMorningResult.isValid, true);
  assert.strictEqual(tomMorningResult.error, null);

  const tomEveningResult = validateScheduleDateTime(tomParts, '07:30 PM');
  console.log(`Testing tomorrow (${tomParts}) with 07:30 PM:`, tomEveningResult);
  assert.strictEqual(tomEveningResult.isValid, true);
  assert.strictEqual(tomEveningResult.error, null);

  console.log('\n--- 6. Testing Case 5: Empty or Invalid Date / Time -> Reject ---');
  const emptyDateRes = validateScheduleDateTime('', '09:30 AM');
  console.log('Empty date result:', emptyDateRes);
  assert.strictEqual(emptyDateRes.isValid, false);
  assert(emptyDateRes.error.includes('Match date is required'));

  const emptyTimeRes = validateScheduleDateTime(tomParts, '');
  console.log('Empty time result:', emptyTimeRes);
  assert.strictEqual(emptyTimeRes.isValid, false);
  assert(emptyTimeRes.error.includes('Match start time is required'));

  const invalidDateRes = validateScheduleDateTime('2026-02-31', '09:30 AM');
  console.log('Invalid calendar date result:', invalidDateRes);
  assert.strictEqual(invalidDateRes.isValid, false);

  const invalidTimeRes = validateScheduleDateTime(tomParts, 'invalid-time');
  console.log('Invalid time format result:', invalidTimeRes);
  assert.strictEqual(invalidTimeRes.isValid, false);
  assert(invalidTimeRes.error.includes('Invalid match time format'));

  console.log('\n--- 7. Testing 24-hour and 12-hour Time Parser Variations ---');
  const t1 = parseTimeString('14:30');
  assert.strictEqual(t1.formatted12, '02:30 PM');
  assert.strictEqual(t1.totalMinutes, 870);

  const t2 = parseTimeString('09:30 AM');
  assert.strictEqual(t2.formatted12, '09:30 AM');
  assert.strictEqual(t2.totalMinutes, 570);

  const t3 = parseTimeString('12:00 AM');
  assert.strictEqual(t3.totalMinutes, 0);

  const t4 = parseTimeString('12:00 PM');
  assert.strictEqual(t4.totalMinutes, 720);

  console.log('\n--- 8. Testing Specific Past Date 9/10/2026 (DD/MM/YYYY) ---');
  // With valid time: ONLY date error should appear, time error must be null
  const pastSlashRes = validateScheduleDateTime('9/10/2026', '09:30 AM');
  console.log('Past date 9/10/2026 with valid time:', pastSlashRes);
  assert.strictEqual(pastSlashRes.isValid, false);
  assert.strictEqual(pastSlashRes.isPastDate, true);
  assert(pastSlashRes.dateError && pastSlashRes.dateError.includes('cannot be in the past'));
  assert.strictEqual(pastSlashRes.timeError, null);

  console.log('\n--- 9. Testing Both Date and Time Invalid -> Dual Errors ---');
  const bothInvalidRes = validateScheduleDateTime('9/10/2026', '');
  console.log('Both invalid result:', bothInvalidRes);
  assert.strictEqual(bothInvalidRes.isValid, false);
  assert(bothInvalidRes.dateError && bothInvalidRes.dateError.includes('cannot be in the past'));
  assert(bothInvalidRes.timeError && bothInvalidRes.timeError.includes('Match start time is required'));

  console.log('\n>>> ALL 9 VALIDATION TESTS PASSED SUCCESSFULLY! <<<');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

