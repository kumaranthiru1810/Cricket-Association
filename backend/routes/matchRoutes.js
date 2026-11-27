/**
 * routes/matchRoutes.js
 * Public Match Centre & Scorecard APIs (No auth required for public scorecards)
 */

const express = require('express');
const router = express.Router();
const scorerService = require('../services/scorerService');
const matchService = require('../services/matchService');
const { sendListResponse } = require('../utils/responseHelper');

// Get Full Scorecard for a match
router.get('/:matchId/scorecard', async (req, res) => {
  try {
    const scorecard = await scorerService.getFullScorecard(req.params.matchId);
    res.json({ success: true, data: scorecard });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message || 'Unable to load scorecard' });
  }
});

// Get Live Match State
router.get('/:matchId/live', async (req, res) => {
  try {
    const liveState = await scorerService.getLiveMatchState(req.params.matchId);
    res.json({ success: true, data: liveState });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message || 'Unable to load live state' });
  }
});

// List all matches
router.get('/', async (req, res) => {
  try {
    const stats = await scorerService.getDashboardStats(null);
    return sendListResponse(res, stats.matches || []);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
