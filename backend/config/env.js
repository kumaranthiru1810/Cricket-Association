/**
 * config/env.js
 * Centralized environment variable validator and configuration provider
 */

require('dotenv').config();

// Treat unset NODE_ENV as production for fail-safe security
const NODE_ENV = (process.env.NODE_ENV || 'production').trim();
const isDevelopment = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';
const isProduction = !isDevelopment && !isTest;

const KNOWN_DEFAULT_SECRETS = new Set([
  'cricket_super_secret_jwt_2026',
  'super_secret_cricket_federation_jwt_token_2026',
  'cricket_team_jwt_secret_2025',
  'cricket_dual_admin_hmac_secret_2026',
  'cricket_webhook_secret_2026',
  'CHANGE_ME_generate_with_openssl_rand_hex_32',
  'your_jwt_secret_here'
]);

const FORBIDDEN_SECRET_SUBSTRINGS = [
  'change',
  'replace',
  'example',
  'secret_here',
  'cricket_super_secret',
  'super_secret_cricket'
];

function isWeakSecret(val, minLen = 32) {
  if (!val || typeof val !== 'string') return `must be set and at least ${minLen} characters`;
  if (val.length < minLen) return `must be at least ${minLen} characters long`;
  if (KNOWN_DEFAULT_SECRETS.has(val)) return 'must not equal a known default secret';
  const lower = val.toLowerCase();
  for (const sub of FORBIDDEN_SECRET_SUBSTRINGS) {
    if (lower.includes(sub)) return `must not contain forbidden placeholder '${sub}'`;
  }
  return null;
}

const isValidEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

let jwtSecret = process.env.JWT_SECRET;
let otpHmacSecret = process.env.OTP_HMAC_SECRET;
let webhookSecret = process.env.WEBHOOK_SECRET;
let encryptionKey = process.env.ENCRYPTION_KEY;

// In development or test, provide deterministic keys only if not set
if (isDevelopment || isTest) {
  if (!jwtSecret) jwtSecret = 'dev_only_jwt_signing_key_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c';
  if (!otpHmacSecret) otpHmacSecret = 'dev_only_otp_hmac_key_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
  if (!webhookSecret) webhookSecret = 'dev_only_webhook_key_4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b';
  if (!encryptionKey) encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

if (isProduction) {
  const missing = [];

  const jwtErr = isWeakSecret(jwtSecret, 32);
  if (jwtErr) missing.push(`JWT_SECRET ${jwtErr}`);

  const otpErr = isWeakSecret(otpHmacSecret, 16);
  if (otpErr) missing.push(`OTP_HMAC_SECRET ${otpErr}`);

  const whErr = isWeakSecret(webhookSecret, 16);
  if (whErr) missing.push(`WEBHOOK_SECRET ${whErr}`);

  if (!process.env.MONGODB_URI) {
    missing.push('MONGODB_URI is required outside development/test');
  }
  if (allowedOrigins.length === 0) {
    missing.push('ALLOWED_ORIGINS is required outside development/test');
  }

  if (process.env.ADMIN_INITIAL_EMAIL && !isValidEmail(process.env.ADMIN_INITIAL_EMAIL)) {
    missing.push('ADMIN_INITIAL_EMAIL must be a valid email address');
  }
  if (process.env.ADMIN_INITIAL_PASSWORD) {
    const admPassErr = isWeakSecret(process.env.ADMIN_INITIAL_PASSWORD, 12);
    if (admPassErr) missing.push(`ADMIN_INITIAL_PASSWORD ${admPassErr}`);
  }

  const hasBrevo = Boolean(process.env.BREVO_API_KEY);
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  if (!hasBrevo && !hasResend && !hasSmtp) {
    missing.push('A working email provider config (BREVO_API_KEY, RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASSWORD) is required');
  }

  if (missing.length > 0) {
    console.error('FATAL CONFIGURATION ERROR: The server cannot start due to missing or insecure environment variables:');
    missing.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
}

module.exports = {
  NODE_ENV,
  isDevelopment,
  isTest,
  isProduction,
  isWeakSecret,
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || (
    isTest
      ? 'mongodb://127.0.0.1:27017/cricket_test_db'
      : 'mongodb://127.0.0.1:27017/cricket_db'
  ),
  JWT_SECRET: jwtSecret,
  OTP_HMAC_SECRET: otpHmacSecret,
  WEBHOOK_SECRET: webhookSecret,
  ENCRYPTION_KEY: encryptionKey || null,
  FRONTEND_URL: process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:8081' : ''),
  ALLOWED_ORIGINS: allowedOrigins,
  ADMIN_INITIAL_EMAIL: process.env.ADMIN_INITIAL_EMAIL ? process.env.ADMIN_INITIAL_EMAIL.trim().toLowerCase() : null,
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD || null,
  SUPER_ADMIN_EMAIL: (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_INITIAL_EMAIL || 'system@localhost.invalid').trim().toLowerCase(),
  DEV_ADMIN_BYPASS: isDevelopment && process.env.DEV_ADMIN_BYPASS === 'true',
  DEV_ADMIN_EMAIL: isDevelopment ? (process.env.DEV_ADMIN_EMAIL || 'dev-admin@localhost.test') : null,
  DEV_ADMIN_OTP: isDevelopment ? (process.env.DEV_ADMIN_OTP || null) : null,
  EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER || '').toLowerCase(),
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM
};

