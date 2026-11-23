/**
 * config/env.js
 * Centralized environment variable validator and configuration provider
 */

require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';

const KNOWN_DEFAULT_SECRETS = new Set([
  'cricket_super_secret_jwt_2026',
  'super_secret_cricket_federation_jwt_token_2026',
  'cricket_team_jwt_secret_2025',
  'CHANGE_ME_generate_with_openssl_rand_hex_32',
  'your_jwt_secret_here'
]);

let jwtSecret = process.env.JWT_SECRET;

// In development or test, provide a deterministic long key if not set
if (!jwtSecret && (isDevelopment || isTest)) {
  jwtSecret = 'cricket_super_secret_jwt_2026_dev_mode_only_secret_key_32_chars';
}

if (!isDevelopment && !isTest) {
  const missing = [];

  if (!jwtSecret) {
    missing.push('JWT_SECRET environment variable is missing');
  } else {
    if (jwtSecret.length < 32) {
      missing.push('JWT_SECRET must be at least 32 characters long');
    }
    if (KNOWN_DEFAULT_SECRETS.has(jwtSecret)) {
      missing.push('JWT_SECRET must not use an insecure default placeholder');
    }
  }

  if (NODE_ENV === 'production') {
    if (!process.env.MONGODB_URI) {
      missing.push('MONGODB_URI is required in production');
    }
    if (!process.env.ALLOWED_ORIGINS) {
      missing.push('ALLOWED_ORIGINS is required in production');
    }
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
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cricket_db',
  JWT_SECRET: jwtSecret || 'cricket_super_secret_jwt_2026_dev_mode_only_secret_key_32_chars',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8081',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [],
  ADMIN_INITIAL_EMAIL: process.env.ADMIN_INITIAL_EMAIL || null,
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD || null,
  DEV_ADMIN_BYPASS: isDevelopment && process.env.DEV_ADMIN_BYPASS === 'true',
  DEV_ADMIN_EMAIL: process.env.DEV_ADMIN_EMAIL || 'admin@example.com',
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM
};

