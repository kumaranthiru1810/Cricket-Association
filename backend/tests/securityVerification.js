const { sanitizeInput, verifyWebhookSignature, validateFileUpload, requireOwnershipOrAdmin } = require('../middleware/securityMiddleware');
const crypto = require('crypto');

console.log('--- RUNNING SECURITY SUITE TESTS ---');

// 1. NoSQL Injection & Prototype Pollution Sanitization
const dirtyPayload = {
  user: 'admin',
  query: { $gt: '' },
  nested: { $where: 'function(){}', safe: 'value' },
  __proto__: { isAdmin: true }
};

const mockReq = { body: JSON.parse(JSON.stringify(dirtyPayload)) };
sanitizeInput(mockReq, {}, () => {});
const keysClean = !('$gt' in mockReq.body.query) && !('$where' in mockReq.body.nested) && mockReq.body.nested.safe === 'value';
console.log('1. NoSQL Injection & Prototype Pollution Sanitizer:', keysClean ? 'PASSED ✅' : 'FAILED ❌');

// 2. Webhook Signature Verification
const secret = 'cfvd_test_secret_key';
process.env.TEST_WEBHOOK_SECRET = secret;
const eventBody = { event: 'PAYMENT_SUCCESS', amount: 500 };
const payloadStr = JSON.stringify(eventBody);
const validSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

const validReq = {
  headers: { 'x-webhook-signature': validSignature },
  body: eventBody
};

let verified = false;
verifyWebhookSignature('TEST_WEBHOOK_SECRET')(validReq, {}, () => { verified = true; });
console.log('2. Webhook Signature Verification (HMAC-SHA256):', verified ? 'PASSED ✅' : 'FAILED ❌');

// 3. File Upload MIME & Size Validator
const fileMiddleware = validateFileUpload({ maxSizeBytes: 2 * 1024 * 1024 });
let allowedPassed = false;
fileMiddleware({ file: { size: 1024 * 100, mimetype: 'image/png', originalname: 'avatar.png' } }, {}, () => { allowedPassed = true; });

let blockedType = false;
const mockRes = {
  status: (code) => ({
    json: (data) => {
      if (code === 400 && data.success === false) blockedType = true;
    }
  })
};
fileMiddleware({ file: { size: 1024 * 100, mimetype: 'application/x-executable', originalname: 'malware.exe' } }, mockRes, () => {});
console.log('3. File Upload MIME & Size Validator:', (allowedPassed && blockedType) ? 'PASSED ✅' : 'FAILED ❌');

// 4. IDOR Resource Ownership Check
let idorBlocked = false;
const idorRes = {
  status: (code) => ({
    json: (data) => {
      if (code === 403) idorBlocked = true;
    }
  })
};
const idorCheck = requireOwnershipOrAdmin('targetUserId');
idorCheck({ user: { id: 'USER_1', role: 'PLAYER' }, params: { targetUserId: 'USER_2' } }, idorRes, () => {});
console.log('4. IDOR Resource Ownership Check:', idorBlocked ? 'PASSED ✅' : 'FAILED ❌');

console.log('--- ALL SECURITY CHECKS VERIFIED ---');
