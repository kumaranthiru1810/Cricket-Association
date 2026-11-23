/**
 * server.js
 * 
 * Express and Socket.IO Backend Server for Cricket Association Scorer & Management System.
 * Fully powered by pure MongoDB database with full Multi-Role & Portal APIs.
 */

require('dotenv').config();

// Critical Startup Check: Enforce strong JWT_SECRET in production
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'cricket_super_secret_jwt_2026' || process.env.JWT_SECRET.length < 16)) {
  console.error('FATAL ERROR: A strong JWT_SECRET environment variable is required in production!');
  process.exit(1);
}

const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const compression = require('compression');
const morgan = require('morgan');

const db = require('./config/db');
const logger = require('./config/logger');
const { initSocket } = require('./services/socketService');
const { cacheResponse } = require('./middleware/cacheMiddleware');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const teamRoutes = require('./routes/teamRoutes');
const playerRoutes = require('./routes/playerRoutes');
const scorerRoutes = require('./routes/scorerRoutes');
const matchRoutes = require('./routes/matchRoutes');
const newsRoutes = require('./routes/newsRoutes');
const portalRoutes = require('./routes/portalRoutes');
const umpireRoutes = require('./routes/umpireRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const cricketLawsRoutes = require('./routes/cricketLawsRoutes');

const helmet = require('helmet');
const {
  sanitizeInput,
  generalRateLimiter,
  authRateLimiter,
  getCorsOptions
} = require('./middleware/securityMiddleware');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Enable reverse proxy support for Render, AWS, and Cloudflare (ensures correct client IP for rate limiting)
app.set('trust proxy', 1);

// Security 1: Hide express fingerprinting
app.disable('x-powered-by');

// Security 2: Security Headers (HSTS, X-Content-Type-Options, Frameguard)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Initialize Socket.IO on HTTP server for real-time live scoring
initSocket(server);

// Graceful shutdown request drain flag
let isShuttingDown = false;
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({ success: false, message: 'Server is currently shutting down.' });
  }
  next();
});

// Performance 1: Compression (gzip/brotli), placed before routes, skipping Socket.IO
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression'] || (req.baseUrl || req.path || '').startsWith('/socket.io')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Security 3: Strict CORS lockdown
app.use(cors(getCorsOptions()));
app.options('*', cors(getCorsOptions()));

// Security 4: Payload size limiting (1MB standard limit; file uploads handled via multer)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());

// Performance 2: Static file serving for uploaded photos with 30-day public caching and ETag
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: 2592000 * 1000, // 30 days
  etag: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  }
}));

// Security 5: Global Rate Limiting
app.use('/api', generalRateLimiter);

// Observability: Structured HTTP logging via Morgan
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
    skip: (req) => req.originalUrl === '/api/health'
  }));
}

// Security 6: Deep Input Sanitization (strip NoSQL injection operators & prototype pollution)
app.use(sanitizeInput);

// Initialize MongoDB connection & default seeding once at startup
db.initDb().catch(err => {
  console.warn('MongoDB initialization warning:', err.message);
});

// Root endpoint & Health Check with MongoDB ping check
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Cricket Association Management & Scoring API',
    version: '1.0.0',
    health: '/api/health'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const isDbAlive = await db.ping();
    if (!isDbAlive) {
      return res.status(503).json({
        status: 'UNAVAILABLE',
        database: 'DISCONNECTED',
        service: 'Cricket Association Management & Scoring API',
        timestamp: new Date().toISOString()
      });
    }
    return res.status(200).json({
      status: 'OK',
      database: 'CONNECTED',
      service: 'Cricket Association Management & Scoring API',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(503).json({
      status: 'ERROR',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

const authController = require('./controllers/authController');

// Security 7: Strict Rate Limiting on Authentication Endpoints (Brute-force protection)
app.post('/api/admin/login', authRateLimiter, (req, res) => authController.adminLogin(req, res));
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/send-otp', authRateLimiter);
app.use('/api/auth/verify-otp', authRateLimiter);

// Authentication APIs (Password Auth & Registration Email OTP)
app.use('/api/auth', authRoutes);

// Admin Management APIs
app.use('/api/admin', adminRoutes);

// Team Registration, Login & Management APIs
app.use('/api/team', teamRoutes);
app.use('/api/teams', teamRoutes);

// Player Registration, Login & Profile APIs
app.use('/api/player', playerRoutes);
app.use('/api/players', playerRoutes);

// Scorer & Live Scoring APIs
app.use('/api/scorer', scorerRoutes);

// Umpire Management & Supervision APIs
app.use('/api/umpire', umpireRoutes);

// Match & Tournament APIs
app.use('/api/matches', matchRoutes);
app.use('/api/tournaments', tournamentRoutes);

// News & Announcements APIs
app.use('/api/news', newsRoutes);

// Portal Public APIs
app.use('/api/portal', portalRoutes);

// Cricket Laws (MCC 2017 Code – Fourth Edition 2026) APIs
app.use('/api/cricket-laws', cricketLawsRoutes);

const { invalidateCache } = require('./middleware/cacheMiddleware');

// Public & Resilient Master Settings Dynamic Options API
const { requireAdminAuth } = require('./middleware/authMiddleware');
const masterSettingController = require('./controllers/masterSettingController');
app.get('/api/master-settings', cacheResponse(30, 'master-settings'), (req, res) => masterSettingController.getSettings(req, res));
app.post('/api/master-settings', requireAdminAuth, (req, res) => {
  invalidateCache('master-settings');
  masterSettingController.createSetting(req, res);
});
app.put('/api/master-settings/:id', requireAdminAuth, (req, res) => {
  invalidateCache('master-settings');
  masterSettingController.updateSetting(req, res);
});
app.delete('/api/master-settings/:id', requireAdminAuth, (req, res) => {
  invalidateCache('master-settings');
  masterSettingController.deleteSetting(req, res);
});

// Security 8: Global Error Handler - Debug mode OFF in production
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    success: false,
    message: isProd && (!err.status || err.status === 500)
      ? 'An unexpected error occurred. Please contact support.'
      : (err.message || 'Internal Server Error'),
    ...(!isProd && { stack: err.stack })
  });
});

function handleGracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}. Gracefully stopping server and closing connections...`);

  server.close(async () => {
    console.log('HTTP and Socket server closed.');
    try {
      await db.close();
      console.log('Database connections closed cleanly.');
    } catch (_) {}
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Graceful shutdown timeout exceeded. Exiting forcefully.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

if (require.main === module) {
  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏏 Cricket Express & Socket.IO Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server };

