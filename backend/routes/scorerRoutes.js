/**
 * routes/scorerRoutes.js
 * Comprehensive Scorer Portal REST APIs
 * Fully connected to MongoDB
 */

const express = require('express');
const router = express.Router();

const authService = require('../services/authService');
const scorerService = require('../services/scorerService');
const scoringEngine = require('../services/scoringEngine');
const matchService = require('../services/matchService');
const { requireScorerAuth, verifyMatchPermission } = require('../middleware/authMiddleware');
const { acquireMatchLock } = require('../middleware/concurrencyLock');
const { broadcastScoreUpdate } = require('../services/socketService');

// ==========================================
// 1. PUBLIC AUTH ROUTES
// ==========================================

// Scorer Registration (Requirement 1 & 12)
router.post('/register', async (req, res) => {
  try {
    const result = await authService.registerScorer(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
  }
});

// Scorer Login - Step 1: Request OTP or Direct Verify (Requirement 2 & 12)
router.post('/login', async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Scorer email is required.' });
    }

    if (otp || password) {
      const result = await authService.verifyOtp(email, otp || password);
      return res.json({ success: true, ...result });
    }

    // Generate & send OTP (enforcing approved status)
    const result = await authService.requestOtp(email, 'SCORER');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
  }
});

// Scorer Login - Request OTP explicitly
router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.requestOtp(email, 'SCORER');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
  }
});

// Scorer Login - Step 2: Verify OTP (Requirement 3 & 12)
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await authService.verifyOtp(email, otp);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 401).json({ success: false, message: err.message, error: err.message });
  }
});

// ==========================================
// 2. PROTECTED SCORER ROUTES
// Verified by requireScorerAuth (Role=SCORER/ADMIN, Status=ACTIVE/APPROVED)
// ==========================================
router.use(requireScorerAuth);

// Scorer Profile
router.get(['/profile', '/me'], async (req, res) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Scorer Dashboard Stats (Requirement 4 & 12)
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await scorerService.getDashboardStats(req.user.id, req.user.email);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Assigned Matches List (Requirement 4 & 12)
router.get('/matches', async (req, res) => {
  try {
    const { filter } = req.query;
    const stats = await scorerService.getDashboardStats(req.user.id, req.user.email);
    let list = stats.matches || [];
    if (filter) {
      list = list.filter(m => m.status.toLowerCase() === filter.toLowerCase());
    }
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Match Details / Live State alias
router.get('/matches/:matchId', async (req, res) => {
  try {
    const liveState = await scorerService.getLiveMatchState(req.params.matchId);
    res.json({ success: true, data: liveState });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Match Setup before match starts
router.get('/matches/:matchId/setup', async (req, res) => {
  try {
    const setup = await matchService.getMatchSetup(req.params.matchId);
    res.json({ success: true, data: setup });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Start Match (Toss, Playing XI)
router.post('/matches/:matchId/start', verifyMatchPermission, async (req, res) => {
  try {
    const result = await matchService.startMatch(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Live Scoring Screen State (Requirement 5)
router.get('/matches/:matchId/live', async (req, res) => {
  try {
    const liveState = await scorerService.getLiveMatchState(req.params.matchId);
    res.json({ success: true, data: liveState });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Record Delivery (Ball-by-Ball) (Requirement 5, 8 & 12)
// Supports both /deliveries and /ball
const handleRecordDelivery = async (req, res) => {
  try {
    const result = await scoringEngine.recordDelivery(req.params.matchId, req.body, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
  }
};

router.post('/matches/:matchId/deliveries', acquireMatchLock, verifyMatchPermission, handleRecordDelivery);
router.post('/matches/:matchId/ball', acquireMatchLock, verifyMatchPermission, handleRecordDelivery);

// Full Scorecard (Requirement 6 & 12)
router.get('/matches/:matchId/scorecard', async (req, res) => {
  try {
    const scorecard = await scorerService.getFullScorecard(req.params.matchId);
    res.json({ success: true, data: scorecard });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// AI Fielding Commentary Integration (Requirement 9)
router.post('/matches/:matchId/fielding-commentary', async (req, res) => {
  try {
    const result = await scorerService.generateFieldingCommentary(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Update Match State (Requirement 7 & 12)
router.put('/matches/:matchId/status', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.updateMatchStatus(req.params.matchId, req.body.status);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// End Over
router.post('/matches/:matchId/end-over', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.endOver(req.params.matchId, req.body.nextBowlerId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// End Innings
router.post('/matches/:matchId/end-innings', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.endInnings(req.params.matchId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Start Next / 2nd Innings
router.post('/matches/:matchId/start-next-innings', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.startNextInnings(req.params.matchId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Undo Last Delivery
router.post('/matches/:matchId/undo', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.undoLastDelivery(req.params.matchId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Swap Strike
router.post('/matches/:matchId/swap-strike', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.swapStrike(req.params.matchId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Change / Substitute Active Batter
router.post('/matches/:matchId/change-batter', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.changeBatter(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Change / Substitute Active Bowler
router.post('/matches/:matchId/change-bowler', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.changeBowler(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Conclude / End Match
router.post('/matches/:matchId/end', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.endMatch(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Revised Overs & Revised Target
router.post('/matches/:matchId/revised-overs', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.setRevisedOvers(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Playing XI Edit
router.post('/matches/:matchId/playing-xi', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.editPlayingXI(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Start Super Over
router.post('/matches/:matchId/super-over', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.startSuperOver(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Breaks (Add / Update)
router.post('/matches/:matchId/breaks', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.addBreak(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Resume play / End active break
router.post('/matches/:matchId/end-break', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.endBreak(req.params.matchId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Sessions (Add / End Session)
router.post('/matches/:matchId/sessions', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.addSession(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: End Day
router.post('/matches/:matchId/end-day', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.addEndDay(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Declare Innings
router.post('/matches/:matchId/declare-innings', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.declareInnings(req.params.matchId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Match Start & End Time
router.post('/matches/:matchId/match-times', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.updateMatchTimes(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Penalty Points (Batting or Bowling 5 points)
router.post('/matches/:matchId/penalty', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.addPenalty(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Other Wicket (Absent Hurt, Timed Out, Mankading, Retired Out, Retired Hurt)
router.post('/matches/:matchId/other-wicket', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.recordOtherWicket(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Change Ball
router.post('/matches/:matchId/change-ball', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.recordBallChange(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Umpire Assessment
router.post('/matches/:matchId/umpire-assessment', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.saveUmpireAssessment(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// Slide Menu: Change Team (Before first ball)
router.post('/matches/:matchId/change-team', verifyMatchPermission, async (req, res) => {
  try {
    const result = await scoringEngine.changeTeamBeforeStart(req.params.matchId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
