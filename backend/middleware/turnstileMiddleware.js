/**
 * backend/middleware/turnstileMiddleware.js
 * Cloudflare Turnstile verification middleware for OTP, password reset,
 * registration, and contact endpoints.
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function getTurnstileSecret() {
  const raw = process.env.TURNSTILE_SECRET || '';
  return raw.replace(/^"|"$/g, '').trim();
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || undefined;
}

/**
 * Verifies a Cloudflare Turnstile token against siteverify API.
 */
async function verifyTurnstileToken(token, remoteIp) {
  const secret = getTurnstileSecret();
  if (!secret) {
    return { success: true, skipped: true };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return { success: false, error: 'Security verification (Turnstile) token is required.' };
  }

  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token.trim());
  if (remoteIp) {
    params.append('remoteip', remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    return { success: false, error: `Turnstile verification failed (HTTP ${response.status})` };
  }

  const data = await response.json();
  if (!data || data.success !== true) {
    return {
      success: false,
      error: 'Security verification failed. Please complete the challenge and try again.',
      codes: data?.['error-codes'] || []
    };
  }

  return { success: true };
}

/**
 * Express middleware that requires a valid Cloudflare Turnstile token when
 * TURNSTILE_SECRET is configured.
 */
async function requireTurnstile(req, res, next) {
  try {
    const secret = getTurnstileSecret();
    if (!secret) {
      return next();
    }

    const token =
      req.body?.turnstileToken ||
      req.body?.['cf-turnstile-response'] ||
      req.headers['x-turnstile-token'];

    const result = await verifyTurnstileToken(token, getClientIp(req));
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Security verification required.'
      });
    }

    return next();
  } catch (err) {
    console.warn('[Turnstile] Verification error:', err.message);
    return res.status(502).json({
      success: false,
      error: 'Unable to verify security check. Please try again.'
    });
  }
}

module.exports = {
  requireTurnstile,
  verifyTurnstileToken,
  getTurnstileSecret
};

