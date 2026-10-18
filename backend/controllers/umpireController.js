/**
 * controllers/umpireController.js
 * Express Controllers for Official Umpire Module
 */

const umpireService = require('../services/umpireService');

class UmpireController {
  // GET /api/umpire/profile
  async getProfile(req, res) {
    try {
      const data = await umpireService.getProfile(req.user.id, req.user.email);
      res.json({ success: true, data });
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // PUT /api/umpire/profile
  async updateProfile(req, res) {
    try {
      const data = await umpireService.updateProfile(req.user.id, req.user.email, req.body);
      res.json({ success: true, message: 'Profile successfully updated.', data });
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // GET /api/umpire/matches
  async getAssignedMatches(req, res) {
    try {
      const { filter } = req.query;
      const isAdmin = req.user.role === 'ADMIN';
      const data = await umpireService.getAssignedMatches(req.user.id, req.user.email, filter, isAdmin);
      res.json({ success: true, data });
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // GET /api/umpire/matches/:matchId
  async getMatchDetails(req, res) {
    try {
      const { matchId } = req.params;
      const isAdmin = req.user.role === 'ADMIN';
      const data = await umpireService.getMatchDetails(matchId, req.user.id, req.user.email, isAdmin);
      res.json({ success: true, data });
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // PUT /api/umpire/matches/:matchId/start
  async startMatch(req, res) {
    try {
      const { matchId } = req.params;
      const data = await umpireService.startMatch(matchId, req.body, req.user);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // PUT /api/umpire/matches/:matchId/status
  async updateMatchStatus(req, res) {
    try {
      const { matchId } = req.params;
      const { status, reason } = req.body;
      const data = await umpireService.updateMatchStatus(matchId, status, req.user, reason);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // POST /api/umpire/matches/:matchId/decisions
  async recordDecision(req, res) {
    try {
      const { matchId } = req.params;
      const data = await umpireService.recordDecision(matchId, req.body, req.user);
      res.status(201).json(data);
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // GET /api/umpire/matches/:matchId/decisions
  async getDecisions(req, res) {
    try {
      const { matchId } = req.params;
      const data = await umpireService.getDecisions(matchId);
      res.json({ success: true, data });
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // PUT /api/umpire/matches/:matchId/result
  async confirmResult(req, res) {
    try {
      const { matchId } = req.params;
      const data = await umpireService.confirmResult(matchId, req.body, req.user);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
    }
  }
}

module.exports = new UmpireController();
