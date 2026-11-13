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
const path = require('path');

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Static file serving for uploaded photos and media
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Public & Resilient Master Settings Dynamic Options API
const masterSettingController = require('./controllers/masterSettingController');
app.get('/api/master-settings', (req, res) => masterSettingController.getSettings(req, res));
app.post('/api/master-settings', (req, res) => masterSettingController.createSetting(req, res));
app.put('/api/master-settings/:id', (req, res) => masterSettingController.updateSetting(req, res));
app.delete('/api/master-settings/:id', (req, res) => masterSettingController.deleteSetting(req, res));

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
  let isRetrying = false;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (!isRetrying) {
        isRetrying = true;
        console.warn(`\n⚠️ [PORT ${PORT} OCCUPIED] A previous server process is holding port ${PORT}.`);
        console.log(`🔄 Attempting to automatically terminate the old process and free port ${PORT}...`);

        try {
          const { execSync } = require('child_process');
          if (process.platform === 'win32') {
            const output = execSync(`netstat -ano | findstr :${PORT}`).toString();
            const lines = output.split('\n');
            const pids = new Set();
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5 && parts[1].includes(`:${PORT}`) && parts[3] === 'LISTENING') {
                const pid = parts[4];
                if (pid && pid !== String(process.pid) && pid !== '0') {
                  pids.add(pid);
                }
              }
            }

            if (pids.size > 0) {
              pids.forEach((pid) => {
                try {
                  console.log(`🧹 Freeing port ${PORT} by stopping process PID ${pid}...`);
                  execSync(`taskkill /F /PID ${pid}`);
                } catch (_e) {}
              });

              setTimeout(() => {
                console.log(`🚀 Retrying server start on port ${PORT}...`);
                server.listen(PORT, '0.0.0.0', () => {
                  console.log(`🏏 Cricket Express & Socket.IO Server running on http://localhost:${PORT}`);
                });
              }, 1200);
              return;
            }
          }
        } catch (_killErr) {}
      }

      console.error(`\n❌ Could not automatically free port ${PORT}.`);
      console.error(`💡 Please run this command in PowerShell to kill it manually:`);
      console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏏 Cricket Express & Socket.IO Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server };

