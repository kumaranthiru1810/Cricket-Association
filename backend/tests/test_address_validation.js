/**
 * tests/test_address_validation.js
 * Comprehensive edge-case tests for Player Registration Address for Communication validation.
 */

const assert = require('assert');
const { validateAddress, normalizeAddress } = require('../utils/addressValidation');
const { validateBody, playerRegistrationSchema } = require('../middleware/validationMiddleware');
const playerAuth = require('../services/auth/playerAuth');

function runMockValidation(schema, body) {
  let status = 200;
  let jsonResponse = null;
  let nextCalled = false;

  const req = { body };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(payload) {
      jsonResponse = payload;
      return this;
    }
  };
  const next = () => { nextCalled = true; };

  validateBody(schema)(req, res, next);
  return { status, jsonResponse, nextCalled, validatedBody: req.body };
}

async function run() {
  console.log('\n=== ADDRESS VALIDATION EDGE-CASE TESTS ===\n');

  const baseBody = {
    name: 'M. Senthil Kumar',
    fatherName: 'R. Mahalingam',
    email: 'senthil@example.com',
    mobile: '9876543210',
    clubChoice: 'Virudhunagar Cricket Club',
    declarationPlace: 'Virudhunagar',
    declarationDate: '2026-11-28'
  };

  // Mandatory STEP 5 test cases:
  const cases = [
    { input: '@#$FFASFBBH?', expectedValid: false, expectedErr: 'Invalid characters detected. Please enter a valid address.' },
    { input: '@@@@@@@@@@', expectedValid: false, expectedErr: 'Invalid characters detected. Please enter a valid address.' },
    { input: '1234567890', expectedValid: false, expectedErr: 'Address must contain alphabetic characters.' },
    { input: '     ', expectedValid: false, expectedErr: 'Address is required.' },
    { input: 'Sivakasi', expectedValid: false, expectedErr: 'Please enter a complete address (minimum 10 characters).' },
    { input: '12, Main Road, Sivakasi', expectedValid: true },
    { input: 'Door No 12, West Street, Sivakasi', expectedValid: true },
    { input: '12/4, Anna Nagar, Sivakasi - 626123', expectedValid: true }
  ];

  for (const tc of cases) {
    const res = validateAddress(tc.input);
    assert.strictEqual(res.isValid, tc.expectedValid, `validateAddress("${tc.input}") expected ${tc.expectedValid}, got ${res.isValid}`);
    if (!tc.expectedValid) {
      assert.strictEqual(res.error, tc.expectedErr);
    }

    const mw = runMockValidation(playerRegistrationSchema, { ...baseBody, address: tc.input });
    if (tc.expectedValid) {
      assert.strictEqual(mw.nextCalled, true, `Middleware should accept "${tc.input}"`);
      assert.strictEqual(mw.validatedBody.address, normalizeAddress(tc.input));
    } else {
      assert.strictEqual(mw.status, 400, `Middleware should reject "${tc.input}" with 400`);
      assert.strictEqual(mw.jsonResponse.code, 'VALIDATION_ERROR');
      assert.ok(mw.jsonResponse.message.includes(tc.expectedErr));
    }
  }
  console.log('PASS 1: All 8 mandatory STEP 5 test cases passed (validator + middleware)');

  // Additional edge cases:
  assert.strictEqual(validateAddress('##########').isValid, false);
  assert.strictEqual(validateAddress('a.........').isValid, false);
  assert.strictEqual(validateAddress('12, Main Road, ' + 'A'.repeat(186)).isValid, false);
  assert.strictEqual(validateAddress("  #14-A/2, St. Xavier's Colony (East), Sivakasi  ").isValid, true);
  assert.strictEqual(normalizeAddress('  12,   Main   Road,\n  Sivakasi  '), '12, Main Road, Sivakasi');
  console.log('PASS 2: Additional boundary & normalization checks passed');

  // Service-level rejection for '@#$FFASFBBH?' and '     '
  for (const invalidAddr of ['@#$FFASFBBH?', '     ', '1234567890']) {
    let svcErr = null;
    try {
      await playerAuth.registerPlayer({
        ...baseBody,
        email: `unique.addr.${Date.now()}@example.com`,
        mobile: `9${String(Date.now()).slice(-9)}`,
        address: invalidAddr
      });
    } catch (err) {
      svcErr = err;
    }
    assert.ok(svcErr && svcErr.status === 400, `Service must reject "${invalidAddr}" with 400`);
  }
  console.log('PASS 3: Service-level registerPlayer rejects invalid addresses with 400');

  console.log('\nALL ADDRESS VALIDATION TESTS PASSED!\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
