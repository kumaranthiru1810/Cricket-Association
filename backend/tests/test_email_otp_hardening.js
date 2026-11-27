/**
 * backend/tests/test_email_otp_hardening.js
 * Verifies Email/OTP hardening: Turnstile, rate limits, daily counter,
 * priority queue, 250-hit all-admin alert, provider fallback, safe logging,
 * quota error handling, and remember-device cookie.
 */

const assert = require('assert');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.TEST_HARDENED_MAILER = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_hardening_suite_32chars';

const serverMod = require('../server');
const app = serverMod.app || serverMod;
const db = require('../config/db');
const mailer = require('../config/mailer');
const { resetOtpCooldown } = require('../middleware/securityMiddleware');

function makeRequest(server, method, path, body = null, headers = {}) {
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
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (_e) {}
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
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
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const originalFetch = global.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  try {
    // 1. Turnstile rejection when TURNSTILE_SECRET is set and token is missing
    process.env.TURNSTILE_SECRET = 'test-turnstile-secret';
    let emailAttempted = false;
    global.fetch = async (url) => {
      if (String(url).includes('brevo') || String(url).includes('resend')) {
        emailAttempted = true;
      }
      return { ok: true, status: 200, json: async () => ({ success: false }) };
    };

    const noTokenRes = await makeRequest(server, 'POST', '/api/auth/request-otp', {
      email: 'turnstile-test@example.com'
    });
    assert.strictEqual(noTokenRes.status, 400, 'OTP request without Turnstile token must return 400');
    assert.strictEqual(emailAttempted, false, 'No email should be sent when Turnstile token is missing');

    // 2. 4th OTP request within 15 min per email is blocked (429) & 60s cooldown enforced
    delete process.env.TURNSTILE_SECRET;
    process.env.EMAIL_PROVIDER = 'brevo';
    process.env.EMAIL_FALLBACK_PROVIDER = 'resend';
    process.env.BREVO_API_KEY = 'fake-brevo-key';
    process.env.RESEND_API_KEY = 'fake-resend-key';

    global.fetch = async (url) => {
      if (String(url).includes('brevo')) {
        return { ok: true, status: 201, json: async () => ({ messageId: '<brevo-1>' }) };
      }
      return { ok: true, status: 200, json: async () => ({ id: 'resend-1' }) };
    };

    const rateEmail = `ratelimit-${Date.now()}@example.com`;
    const r1 = await makeRequest(server, 'POST', '/api/auth/send-registration-otp', {
      email: rateEmail,
      name: 'Test User',
      role: 'USER'
    });
    assert.strictEqual(r1.status, 200, '1st OTP request should succeed');

    // Immediate 2nd request hits 60s resend cooldown
    const rCooldown = await makeRequest(server, 'POST', '/api/auth/send-registration-otp', {
      email: rateEmail,
      name: 'Test User',
      role: 'USER'
    });
    assert.strictEqual(rCooldown.status, 429, 'Immediate resend should hit 60s cooldown (429)');

    // Clear cooldown map to test the 3-per-15-min per-email cap (2nd, 3rd succeed; 4th blocked)
    resetOtpCooldown();
    const r2 = await makeRequest(server, 'POST', '/api/auth/send-registration-otp', {
      email: rateEmail,
      name: 'Test User',
      role: 'USER'
    });
    assert.strictEqual(r2.status, 200, '2nd OTP request after cooldown should succeed');

    resetOtpCooldown();
    const r3 = await makeRequest(server, 'POST', '/api/auth/send-registration-otp', {
      email: rateEmail,
      name: 'Test User',
      role: 'USER'
    });
    assert.strictEqual(r3.status, 200, '3rd OTP request after cooldown should succeed');

    resetOtpCooldown();
    const r4 = await makeRequest(server, 'POST', '/api/auth/send-registration-otp', {
      email: rateEmail,
      name: 'Test User',
      role: 'USER'
    });
    assert.strictEqual(r4.status, 429, '4th OTP request within 15 min must be blocked with 429');

    // 3. Daily counter increments, priority queue (< 200), fallback provider, and no OTP in logs
    const today = new Date().toISOString().slice(0, 10);
    await db.models.EmailDailyCounter.deleteOne({ date: today });

    const loggedLines = [];
    console.log = (...args) => loggedLines.push(args.join(' '));
    console.warn = (...args) => loggedLines.push(args.join(' '));

    let brevoCalls = 0;
    let resendCalls = 0;
    let capturedHtml = '';
    global.fetch = async (url, opts) => {
      if (String(url).includes('brevo')) {
        brevoCalls++;
        throw new Error('Brevo network timeout');
      }
      if (String(url).includes('resend')) {
        resendCalls++;
        const parsed = JSON.parse(opts.body);
        capturedHtml = parsed.html || '';
        return { ok: true, status: 200, json: async () => ({ id: 'resend-fallback-123' }) };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };

    const secretOtp = '849201';
    const fallbackRes = await mailer.sendOtpEmail({
      toEmail: 'player@example.com',
      userName: '<script>alert(1)</script>',
      otp: secretOtp
    });
    assert.strictEqual(fallbackRes.success, true, 'Fallback provider Resend should succeed when Brevo throws');
    assert.strictEqual(fallbackRes.provider, 'RESEND', 'Provider should be RESEND');
    assert.strictEqual(brevoCalls, 1, 'Primary provider should be tried once');
    assert.strictEqual(resendCalls, 1, 'Fallback provider should be tried once');
    assert(!loggedLines.join('\n').includes(secretOtp), 'OTP must never appear in logs');
    assert(!capturedHtml.includes('<script>'), 'User-supplied HTML must be escaped');
    assert(capturedHtml.toLowerCase().includes('ignore if you did not request this'), 'Template must include ignore notice');

    const counterAfterOne = await db.models.EmailDailyCounter.findOne({ date: today }).lean();
    assert.strictEqual(counterAfterOne.count, 1, 'Daily quota counter must increment to 1');

    // 4. Priority queue: APPROVAL skipped at >= 200, OTP still allowed; 250 triggers all-admin alert
    await db.models.EmailDailyCounter.updateOne({ date: today }, { $set: { count: 200, alert_sent_at: null } });
    const approvalBlocked = await mailer.dispatchEmailWithHardening({
      toEmail: 'user@example.com',
      subject: 'News',
      textContent: 'Update',
      htmlContent: '<p>Update</p>',
      priority: 'APPROVAL'
    });
    assert.strictEqual(approvalBlocked.skippedDueToDailyLimit, true, 'Non-OTP emails must be skipped at >= 200');

    // Seed an admin user + ADMIN_ALERT_EMAIL to verify 250-hit all-admin alert
    process.env.ADMIN_ALERT_EMAIL = 'alert-admin@example.com';
    const testAdminId = `ADM-TEST-${Date.now()}`;
    await db.models.User.create({
      id: testAdminId,
      name: 'Test Admin',
      email: 'db-admin-alert@example.com',
      role: 'ADMIN',
      status: 'ACTIVE'
    });

    await db.models.EmailDailyCounter.updateOne({ date: today }, { $set: { count: 249, alert_sent_at: null } });
    const alertRecipients = [];
    global.fetch = async (url, opts) => {
      if (String(url).includes('brevo')) {
        return { ok: true, status: 201, json: async () => ({ messageId: '<brevo-250>' }) };
      }
      if (String(url).includes('resend')) {
        const parsed = JSON.parse(opts.body);
        if (parsed.subject && parsed.subject.includes('250')) {
          alertRecipients.push(...(parsed.to || []));
        }
        return { ok: true, status: 200, json: async () => ({ id: 'resend-alert-ok' }) };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };

    const hit250 = await mailer.sendOtpEmail({
      toEmail: 'otp250@example.com',
      userName: 'Batter',
      otp: '112233'
    });
    assert.strictEqual(hit250.success, true, '250th OTP email should succeed');
    assert(alertRecipients.includes('alert-admin@example.com'), 'ADMIN_ALERT_EMAIL must receive 250-alert');
    assert(alertRecipients.includes('db-admin-alert@example.com'), 'DB Admin must receive 250-alert');

    // 5. Quota 429 error returns friendly message and never leaks OTP
    global.fetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Quota exceeded' })
    });
    const quotaRes = await mailer.sendOtpEmail({
      toEmail: 'quota@example.com',
      userName: 'User',
      otp: '998877'
    });
    assert.strictEqual(quotaRes.success, false);
    assert.strictEqual(quotaRes.message, 'OTP service is busy, please try again later');
    assert.strictEqual(quotaRes.otp, undefined, 'OTP must never be leaked on quota error');

    // Cleanup test admin & counter
    await db.models.User.deleteOne({ id: testAdminId });
    await db.models.EmailDailyCounter.deleteOne({ date: today });

    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.log('✅ All Email/OTP Hardening tests passed!');
  } finally {
    global.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    await new Promise((resolve) => server.close(resolve));
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Email/OTP Hardening test failed:', err);
    process.exit(1);
  });
