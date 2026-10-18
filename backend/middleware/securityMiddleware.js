/**
 * middleware/securityMiddleware.js
 * Comprehensive Security Suite:
 * 1. Input Sanitization & NoSQL Injection Protection
 * 2. Rate Limiting (General & Auth/Brute-force)
 * 3. CORS Whitelisting
 * 4. File Upload Validation (MIME & Extension)
 * 5. Webhook Signature Verification (HMAC-SHA256)
 * 6. IDOR / Row-Level Security Checkers
 */

const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

/**
 * 1. NoSQL Injection & Prototype Pollution Sanitizer
 * Recursively strips keys starting with '$' or containing '.' from req.body, req.query, req.params
 */
function sanitizeInput(req, res, next) {
  function clean(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(clean);
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Reject dangerous keys that could perform NoSQL operator injection or prototype pollution
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
        continue;
      }
      sanitized[key] = clean(value);
    }
    return sanitized;
  }

  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  if (req.params) req.params = clean(req.params);

  next();
}

/**
 * 2. Rate Limiters
 */
// General API Rate Limiter
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.'
  }
});

// Strict Auth / Sensitive Endpoint Rate Limiter (Brute-force protection)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login / OTP attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

/**
 * 3. CORS Whitelist Policy
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000'
];

function getCorsOptions() {
  const allowed = [...DEFAULT_ALLOWED_ORIGINS];
  if (process.env.ALLOWED_ORIGINS) {
    allowed.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean));
  }

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: Origin '${origin}' is not authorized.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Webhook-Signature', 'X-User-Role']
  };
}

/**
 * 4. File Upload Validator
 * Validates allowed MIME types, extensions and file size limit
 */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'pdf'
]);

function validateFileUpload({ maxSizeBytes = 5 * 1024 * 1024 } = {}) {
  return (req, res, next) => {
    if (!req.file && !req.files) return next();

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

    for (const f of files) {
      if (!f) continue;

      if (f.size > maxSizeBytes) {
        return res.status(400).json({
          success: false,
          message: `File size exceeds maximum permitted limit (${Math.round(maxSizeBytes / (1024 * 1024))}MB).`
        });
      }

      if (f.mimetype && !ALLOWED_MIME_TYPES.has(f.mimetype.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type '${f.mimetype}'. Only JPEG, PNG, WEBP, and PDF files are allowed.`
        });
      }

      const ext = (f.originalname || '').split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return res.status(400).json({
          success: false,
          message: `File extension '.${ext}' is prohibited.`
        });
      }
    }

    next();
  };
}

/**
 * 5. Webhook Signature Verifier (HMAC-SHA256)
 */
function verifyWebhookSignature(secretEnvVar = 'WEBHOOK_SECRET') {
  return (req, res, next) => {
    const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
    const secret = process.env[secretEnvVar] || 'cricket_webhook_secret_key_2026';

    if (!signature) {
      return res.status(401).json({
        success: false,
        message: 'Missing webhook signature header (x-webhook-signature).'
      });
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature.'
      });
    }

    next();
  };
}

/**
 * 6. IDOR Guard: Verify that requesting user owns the resource or is ADMIN
 */
function requireOwnershipOrAdmin(getOwnerId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (req.user.role === 'ADMIN') {
      return next();
    }
    const ownerId = typeof getOwnerId === 'function' ? getOwnerId(req) : req.params[getOwnerId];
    if (req.user.id !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to access or modify this resource.'
      });
    }
    next();
  };
}

module.exports = {
  sanitizeInput,
  generalRateLimiter,
  authRateLimiter,
  getCorsOptions,
  validateFileUpload,
  verifyWebhookSignature,
  requireOwnershipOrAdmin
};
