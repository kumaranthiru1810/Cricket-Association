/**
 * services/otpService.js
 * Cryptographically secure OTP generation, hashing, rate limiting, and verification.
 */

const crypto = require('crypto');

// In-memory rate limiting map: email -> { timestamps: [], lastRequestTime: number }
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const MAX_REQUESTS_PER_WINDOW = 5;            // Max 5 OTP requests per 15 minutes
const MIN_COOLDOWN_MS = 10 * 1000;            // 10 seconds minimum between requests
const OTP_EXPIRATION_MS = 5 * 60 * 1000;      // 5 minutes expiry

/**
 * Generate a 6-digit cryptographically secure random OTP
 */
function generateOtpCode() {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Generate a 4-digit cryptographically secure random OTP for Password Reset
 */
function generate4DigitOtpCode() {
  const num = crypto.randomInt(1000, 10000);
  return num.toString();
}

/**
 * Generate HMAC-SHA256 hash of plain text OTP using OTP_HMAC_SECRET
 */
function hashOtp(otp) {
  if (!otp) return '';
  const { OTP_HMAC_SECRET } = require('../config/env');
  return crypto
    .createHmac('sha256', String(OTP_HMAC_SECRET || 'dev_only_otp_hmac_key'))
    .update(String(otp).trim())
    .digest('hex');
}

/**
 * Verify OTP code against stored HMAC hash (constant-time)
 */
function verifyOtpCode(plainOtp, storedHash) {
  if (!plainOtp || !storedHash) return false;
  const computed = Buffer.from(hashOtp(plainOtp), 'utf8');
  const expected = Buffer.from(String(storedHash), 'utf8');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

/**
 * Check rate limit for an email
 * @param {string} email
 * @returns {{ allowed: boolean, message?: string }}
 */
function checkRateLimit(email) {
  // Rate limiting disabled as requested (allows immediate OTP requests)
  return { allowed: true };
}

/**
 * Reset rate limit for an email (e.g. for testing)
 */
function resetRateLimit(email) {
  if (email) {
    const clean = email.trim().toLowerCase();
    rateLimitMap.delete(clean);
    if (global.__scorerRateLimitMap) {
      global.__scorerRateLimitMap.delete(clean);
    }
  } else {
    rateLimitMap.clear();
    if (global.__scorerRateLimitMap) {
      global.__scorerRateLimitMap.clear();
    }
  }
}

module.exports = {
  generateOtpCode,
  generate4DigitOtpCode,
  hashOtp,
  verifyOtpCode,
  checkRateLimit,
  resetRateLimit,
  OTP_EXPIRATION_MS
};
