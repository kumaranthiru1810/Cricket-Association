/**
 * routes/playerRoutes.js
 * 
 * Complete Player Module REST API Endpoints:
 * - Registration & Admin Approval
 * - OTP Login & Verification
 * - Profile Management (Read & Update permitted fields)
 * - Team & Squad Roster
 * - Matches & Read-Only Scorecard
 * - Performance Statistics (Batting, Bowling, Fielding)
 * - Notifications
 * Strictly protected with requirePlayerAuth authorization middleware.
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const playerService = require('../services/playerService');
const playerRatingService = require('../services/playerRatingService');
const { requirePlayerAuth } = require('../middleware/authMiddleware');

// -------------------------------------------------------------
// 1. PUBLIC AUTHENTICATION & REGISTRATION ENDPOINTS
// -------------------------------------------------------------

/**
 * POST /api/player/register
 * Individual player registration -> Status = PENDING -> Awaiting Admin Approval
 */
router.post('/register', async (req, res) => {
  try {
    const result = await authService.registerPlayer(req.body);
    res.status(201).json(result);
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({
      success: false,
      message: err.message || 'Player registration failed'
    });
  }
});

/**
 * POST /api/player/login
 * Step 1: Request OTP for registered player name / email
 * Strictly verifies player exists & admin approval status before generating & dispatching OTP
 */
router.post('/login', async (req, res) => {
  try {
    const { name, email, playerName, nameOrEmail, emailOrPhone, input } = req.body;
    const identifier = playerName || nameOrEmail || emailOrPhone || input || email || name;
    const result = await authService.requestPlayerOtp(identifier);
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({
      success: false,
      message: err.message || 'Player login failed'
    });
  }
});

const authController = require('../controllers/authController');

/**
 * POST /api/player/verify-otp
 * Step 2: Verify OTP and return authenticated session token
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { name, email, playerName, nameOrEmail, emailOrPhone, input, otp } = req.body;
    const identifier = playerName || nameOrEmail || emailOrPhone || input || email || name;
    const result = await authService.verifyPlayerOtp(identifier, otp);
    if (result && result.token) {
      authController.setAuthCookies(res, result.token);
    }
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 401;
    res.status(status).json({
      success: false,
      message: err.message || 'Player OTP verification failed'
    });
  }
});

// -------------------------------------------------------------
// 2. PROTECTED PLAYER ENDPOINTS (Require Active Player Authentication)
// -------------------------------------------------------------

/**
 * GET /api/player/profile
 * View own player profile from MongoDB
 */
router.get('/profile', requirePlayerAuth, async (req, res) => {
  try {
    const profile = await playerService.getProfile(req.user.id, req.user.email);
    res.status(200).json({ success: true, profile });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/player/profile
 * Update allowed profile fields (batting style, bowling style, jersey number, mobile, taluk)
 * Modifying role, status, or credentials is strictly blocked.
 */

/**
 * POST /api/player/upload-photo
 * Upload or update player profile photo and image path
 */
router.post('/upload-photo', requirePlayerAuth, async (req, res) => {
  try {
    const photo = req.body.photo || req.body.image || req.body.image_path || req.body.imagePath;
    const updated = await playerService.updateProfile(req.user.id, req.user.email, { photo });
    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully!',
      photo: updated.photo,
      image_path: updated.image_path,
      profile: updated
    });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({
      success: false,
      message: err.message || 'Photo upload failed'
    });
  }
});

router.put('/profile', requirePlayerAuth, async (req, res) => {
  try {
    const updated = await playerService.updateProfile(req.user.id, req.user.email, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      profile: updated
    });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/player/team
 * Retrieve player's registered team details and full 15-player squad roster
 */
router.get('/team', requirePlayerAuth, async (req, res) => {
  try {
    const teamData = await playerService.getTeam(req.user.id, req.user.email);
    res.status(200).json({ success: true, ...teamData });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/player/matches
 * Retrieve upcoming, live, and recent matches for the player's team
 */
router.get('/matches', requirePlayerAuth, async (req, res) => {
  try {
    const matches = await playerService.getMatches(req.user.id, req.user.email);
    res.status(200).json({ success: true, matches });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/player/matches/:id
 * Retrieve specific match information
 */
router.get('/matches/:id', requirePlayerAuth, async (req, res) => {
  try {
    const match = await playerService.getMatchById(req.params.id);
    res.status(200).json({ success: true, match });
  } catch (err) {
    const status = err.status || 404;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/player/matches/:id/scorecard
 * Read-only scorecard connected to scorer match records in MongoDB
 */
router.get('/matches/:id/scorecard', requirePlayerAuth, async (req, res) => {
  try {
    const scorecard = await playerService.getScorecard(req.params.id);
    res.status(200).json({ success: true, scorecard });
  } catch (err) {
    const status = err.status || 404;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/player/statistics
 * Real batting, bowling, and fielding statistics computed from MongoDB matches
 */
router.get('/statistics', requirePlayerAuth, async (req, res) => {
  try {
    const statistics = await playerService.getStatistics(req.user.id, req.user.email);
    res.status(200).json({ success: true, statistics });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/player/notifications
 * Official association and match notifications for the player
 */
router.get('/notifications', requirePlayerAuth, async (req, res) => {
  try {
    const notifications = await playerService.getNotifications(req.user.id, req.user.email);
    res.status(200).json({ success: true, notifications });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// 3. PLAYER PERFORMANCE & CAREER RATING SYSTEM ENDPOINTS
// -------------------------------------------------------------

/**
 * GET /api/players/leaderboards/ratings or /api/player/leaderboards/ratings
 * Public leaderboard of top rated players across format / category
 */
router.get('/leaderboards/ratings', async (req, res) => {
  try {
    const { category = 'overall', format = 'ALL', limit = 10 } = req.query;
    const leaders = await playerRatingService.getRatingsLeaderboard({ category, format, limit });
    res.status(200).json({ success: true, category, format, leaders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/players/matches/:matchId/recalculate-ratings
 * Idempotently trigger rating computation for all players in a match
 */
router.post('/matches/:matchId/recalculate-ratings', async (req, res) => {
  try {
    const result = await playerRatingService.recalculateMatchRatings(req.params.matchId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Authenticated Player's Own Rating Endpoints
 */
router.get('/ratings', requirePlayerAuth, async (req, res) => {
  try {
    const ratings = await playerRatingService.getPlayerMatchRatings(req.user.id);
    res.status(200).json({ success: true, ratings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/career-ratings', requirePlayerAuth, async (req, res) => {
  try {
    const career = await playerRatingService.getCareerRatings(req.user.id);
    res.status(200).json({ success: true, career });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/form', requirePlayerAuth, async (req, res) => {
  try {
    const matchLimit = req.query.matches ? parseInt(req.query.matches, 10) : 5;
    const form = await playerRatingService.getPlayerForm(req.user.id, matchLimit);
    res.status(200).json({ success: true, form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Public / Generic Player Rating Endpoints by Player ID
 */
router.get('/:id/ratings', async (req, res) => {
  try {
    const ratings = await playerRatingService.getPlayerMatchRatings(req.params.id);
    res.status(200).json({ success: true, playerId: req.params.id, ratings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/career-ratings', async (req, res) => {
  try {
    const career = await playerRatingService.getCareerRatings(req.params.id);
    res.status(200).json({ success: true, playerId: req.params.id, career });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/form', async (req, res) => {
  try {
    const matchLimit = req.query.matches ? parseInt(req.query.matches, 10) : 5;
    const form = await playerRatingService.getPlayerForm(req.params.id, matchLimit);
    res.status(200).json({ success: true, playerId: req.params.id, form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
