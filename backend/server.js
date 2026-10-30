/**
 * server.js
 * 
 * Express and Socket.IO Backend Server for Cricket Association Scorer & Management System.
 * Fully powered by pure MongoDB database with full Multi-Role & Portal APIs.
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const db = require('./config/db');
const { initSocket } = require('./services/socketService');

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

// Security 1: Hide express fingerprinting
app.disable('x-powered-by');

// Security 2: Security Headers (HSTS, X-Content-Type-Options, Frameguard)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Initialize Socket.IO on HTTP server for real-time live scoring
initSocket(server);

// Security 3: Strict CORS lockdown
app.use(cors(getCorsOptions()));
app.options('*', cors(getCorsOptions()));

// Security 4: Payload size limiting (prevent memory exhaustion denial of service)
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Security 5: Global Rate Limiting
app.use('/api', generalRateLimiter);

// Live Request Logger (shows API activity in terminal)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.originalUrl !== '/api/health') {
      const duration = Date.now() - start;
      console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Security 6: Deep Input Sanitization (strip NoSQL injection operators & prototype pollution)
app.use(sanitizeInput);

// Initialize MongoDB connection & default seeding
db.initDb().catch(err => {
  console.warn('MongoDB initialization warning:', err.message);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: 'MongoDB',
    service: 'Cricket Association Management & Scoring API',
    timestamp: new Date().toISOString()
  });
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

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏏 Cricket Express & Socket.IO Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server };

