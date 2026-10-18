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

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO on HTTP server for real-time live scoring
initSocket(server);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

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

// Direct Admin Login endpoint
app.post('/api/admin/login', (req, res) => authController.adminLogin(req, res));

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

// News & Announcements APIs
app.use('/api/news', newsRoutes);

// Portal Public APIs
app.use('/api/portal', portalRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏏 Cricket Express & Socket.IO Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server };

