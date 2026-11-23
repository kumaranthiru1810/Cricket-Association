/**
 * tests/test_validation_errors.js
 * Automated tests for Phase 6 Request Body Validation & Standard Error Responses
 */

const assert = require('assert');
const {
  validateBody,
  deliverySchema,
  otpRequestSchema,
  loginSchema,
  penaltySchema
} = require('../middleware/validationMiddleware');

console.log('\n==================================================');
console.log('🛡️ RUNNING REQUEST VALIDATION & ERROR FORMAT TESTS');
console.log('==================================================\n');

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

  const middleware = validateBody(schema);
  middleware(req, res, next);

  return { status, jsonResponse, nextCalled, validatedBody: req.body };
}

// 1. Delivery Validation: Invalid runs (8 runs is illegal in cricket)
{
  const res = runMockValidation(deliverySchema, { runsBatter: 8 });
  assert.strictEqual(res.status, 400, 'Runs > 7 must return 400');
  assert.strictEqual(res.jsonResponse.success, false);
  assert.strictEqual(res.jsonResponse.code, 'VALIDATION_ERROR');
  console.log('✅ PASS: Validation 1: Rejects out-of-range runs (runs > 7) with 400 and VALIDATION_ERROR');
}

// 2. Delivery Validation: Valid runs (0-7) passes
{
  const res = runMockValidation(deliverySchema, { runsBatter: 6, extraType: 'NONE' });
  assert.strictEqual(res.nextCalled, true, 'Valid delivery body must call next()');
  console.log('✅ PASS: Validation 2: Accepts valid legal delivery parameters');
}

// 3. Delivery Validation: Invalid extra type
{
  const res = runMockValidation(deliverySchema, { runsBatter: 1, extraType: 'INVALID_EXTRA' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.jsonResponse.code, 'VALIDATION_ERROR');
  console.log('✅ PASS: Validation 3: Rejects invalid extraType enum with 400');
}

// 4. OTP Request: Invalid email format
{
  const res = runMockValidation(otpRequestSchema, { email: 'not-an-email' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.jsonResponse.success, false);
  console.log('✅ PASS: Validation 4: Rejects malformed email in OTP request with 400');
}

// 5. Penalty Validation: Out of range penalty points
{
  const res = runMockValidation(penaltySchema, { points: 50, reason: 'Test' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.jsonResponse.code, 'VALIDATION_ERROR');
  console.log('✅ PASS: Validation 5: Rejects excessive penalty points with 400');
}

console.log('\n🎉 ALL REQUEST VALIDATION & ERROR FORMAT TESTS PASSED!\n');
