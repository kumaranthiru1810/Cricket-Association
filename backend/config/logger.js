/**
 * config/logger.js
 * Centralized, secure application logger:
 * - Structured log format with log levels (info, warn, error, debug)
 * - Automatically masks passwords, OTPs, auth tokens, and session secrets
 * - Never prints raw credentials to terminal or file logs
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'current_password',
  'new_password',
  'otp',
  'rawotp',
  'otp_hash',
  'devotp',
  'token',
  'authorization',
  'jwt_secret',
  'secret',
  'aadhaar',
  'smtp_password'
]);

function maskSensitiveData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = maskSensitiveData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  if (meta !== undefined) {
    const maskedMeta = maskSensitiveData(meta);
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(maskedMeta)}`;
  }
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

const logger = {
  info: (msg, meta) => {
    console.log(formatMessage('info', msg, meta));
  },
  warn: (msg, meta) => {
    console.warn(formatMessage('warn', msg, meta));
  },
  error: (msg, meta) => {
    console.error(formatMessage('error', msg, meta));
  },
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatMessage('debug', msg, meta));
    }
  }
};

module.exports = logger;

