/**
 * controllers/tournamentController.js
 * Controller handling Tournament CRUD, dynamic match generation,
 * team allocation, live points table, and statistics endpoints.
 */

const tournamentService = require('../services/tournamentService');

class TournamentController {
  /**
   * GET /api/tournaments
   * Query tournaments with optional status filter and search term
   */
  async getTournaments(req, res) {
    try {
      const { status, search } = req.query;
      const tournaments = await tournamentService.getTournaments({ status, search });
      res.json({
        success: true,
        count: tournaments.length,
        tournaments,
        data: tournaments // support both access patterns
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve tournaments.'
      });
    }
  }

  /**
   * GET /api/tournaments/:id
   * Get single tournament by ID with full details, participating teams, matches, points table & stats
   */
  async getTournamentById(req, res) {
    try {
      const tournament = await tournamentService.getTournamentById(req.params.id);
      res.json({
        success: true,
        tournament,
        data: tournament
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve tournament details.'
      });
    }
  }

  /**
   * POST /api/tournaments
   * Create a new tournament
   */
  async createTournament(req, res) {
    try {
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const tournament = await tournamentService.createTournament(req.body, adminEmail);
      res.status(201).json({
        success: true,
        message: `Tournament '${tournament.name}' created successfully.`,
        tournament,
        data: tournament
      });
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to create tournament.'
      });
    }
  }

  /**
   * PUT /api/tournaments/:id
   * Update tournament
   */
  async updateTournament(req, res) {
    try {
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const tournament = await tournamentService.updateTournament(req.params.id, req.body, adminEmail);
      res.json({
        success: true,
        message: `Tournament '${tournament.name}' updated successfully.`,
        tournament,
        data: tournament
      });
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to update tournament.'
      });
    }
  }

  /**
   * DELETE /api/tournaments/:id
   * Delete or deactivate tournament
   */
  async deleteTournament(req, res) {
    try {
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const result = await tournamentService.deleteTournament(req.params.id, adminEmail);
      res.json(result);
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to delete tournament.'
      });
    }
  }

  /**
   * POST /api/tournaments/:id/teams
   * Add participating teams to tournament
   */
  async addTeams(req, res) {
    try {
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const { teams, teamIds } = req.body;
      const selected = teams || teamIds;
      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        return res.status(400).json({ success: false, message: 'Please provide at least one team ID to add.' });
      }
      const tournament = await tournamentService.addTeams(req.params.id, selected, adminEmail);
      res.json({
        success: true,
        message: 'Teams added to tournament successfully.',
        tournament,
        data: tournament
      });
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to add teams.'
      });
    }
  }

  /**
   * DELETE /api/tournaments/:id/teams/:teamId
   * Remove team from tournament
   */
  async removeTeam(req, res) {
    try {
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const tournament = await tournamentService.removeTeam(req.params.id, req.params.teamId, adminEmail);
      res.json({
        success: true,
        message: `Team '${req.params.teamId}' removed from tournament.`,
        tournament,
        data: tournament
      });
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to remove team.'
      });
    }
  }

  /**
   * POST /api/tournaments/:id/generate-matches
   * Automatically generate match fixtures (Round Robin / Knockout)
   */
  async generateMatches(req, res) {
    try {
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const result = await tournamentService.generateMatches(req.params.id, req.body, adminEmail);
      res.json(result);
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to generate matches.'
      });
    }
  }

  /**
   * GET /api/tournaments/:id/schedule
   * Get all scheduled matches for tournament
   */
  async getSchedule(req, res) {
    try {
      const tournament = await tournamentService.getTournamentById(req.params.id);
      res.json({
        success: true,
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        count: (tournament.matches || []).length,
        schedule: tournament.matches || [],
        data: tournament.matches || []
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve tournament schedule.'
      });
    }
  }

  /**
   * GET /api/tournaments/:id/points-table
   * Get live calculated points table for tournament
   */
  async getPointsTable(req, res) {
    try {
      const pointsTable = await tournamentService.getPointsTable(req.params.id);
      res.json({
        success: true,
        tournament_id: req.params.id,
        count: pointsTable.length,
        points_table: pointsTable,
        data: pointsTable
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to calculate points table.'
      });
    }
  }

  /**
   * GET /api/tournaments/:id/statistics
   * Get tournament statistics (top batters, top bowlers, highest totals)
   */
  async getStatistics(req, res) {
    try {
      const stats = await tournamentService.getTournamentStatistics(req.params.id);
      res.json({
        success: true,
        tournament_id: req.params.id,
        statistics: stats,
        data: stats
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to calculate statistics.'
      });
    }
  }

  /**
   * PATCH /api/tournaments/:id/status
   * Update tournament status
   */
  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required.' });
      }
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const tournament = await tournamentService.updateTournament(req.params.id, { status }, adminEmail);
      res.json({
        success: true,
        message: `Tournament status updated to ${status}.`,
        tournament,
        data: tournament
      });
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to update tournament status.'
      });
    }
  }

  /**
   * POST /api/tournaments/:id/register
   * Coach/Team submits registration for a tournament
   */
  async registerTeam(req, res) {
    try {
      const tournamentId = req.params.id || req.body.tournamentId || req.body.tournament_id;
      if (!tournamentId) {
        return res.status(400).json({ success: false, message: 'Tournament ID is required.' });
      }

      const requesterUser = req.team || req.teamUser || req.user || {};
      const payload = {
        tournamentId,
        teamId: req.body.teamId || req.body.team_id || requesterUser.teamId || requesterUser.id,
        coachEmail: req.body.coachEmail || req.body.coach_email || requesterUser.coachEmail || requesterUser.email,
        coachName: req.body.coachName || req.body.coach_name || requesterUser.coachName || requesterUser.name,
        teamName: req.body.teamName || req.body.team_name || requesterUser.name,
        notes: req.body.notes || ''
      };

      const registration = await tournamentService.registerTeamForTournament(payload, requesterUser);
      res.status(201).json({
        success: true,
        message: `Team '${registration.team_name}' registered successfully for '${registration.tournament_name}'. Status: Pending Approval.`,
        registration,
        data: registration
      });
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to submit tournament registration.'
      });
    }
  }

  /**
   * GET /api/tournaments/my-registrations
   * Get registrations submitted by the currently logged-in coach/team
   */
  async getMyRegistrations(req, res) {
    try {
      const requesterUser = req.team || req.teamUser || req.user || {};
      const coachEmail = req.query.coachEmail || req.query.email || requesterUser.coachEmail || requesterUser.email;
      const teamId = req.query.teamId || requesterUser.teamId || requesterUser.id;

      const registrations = await tournamentService.getTeamRegistrations(coachEmail, teamId);
      res.json({
        success: true,
        count: registrations.length,
        registrations,
        data: registrations
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve team tournament registrations.'
      });
    }
  }

  /**
   * GET /api/tournaments/registrations/all
   * GET /api/tournaments/:id/registrations
   * Admin view: list registrations with optional filters
   */
  async getAllRegistrations(req, res) {
    try {
      const tournamentId = req.params.id || req.query.tournamentId;
      const { status, search } = req.query;
      const registrations = await tournamentService.getTournamentRegistrations({ tournamentId, status, search });
      res.json({
        success: true,
        count: registrations.length,
        registrations,
        data: registrations
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve tournament registrations.'
      });
    }
  }

  /**
   * PATCH /api/tournaments/registrations/:regId/approve
   * Admin approves team tournament registration
   */
  async approveRegistration(req, res) {
    try {
      const regId = req.params.regId || req.params.id;
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const updated = await tournamentService.approveRegistration(regId, adminEmail);
      res.json({
        success: true,
        message: `Registration for team '${updated.team_name}' has been APPROVED!`,
        registration: updated,
        data: updated
      });
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to approve registration.'
      });
    }
  }

  /**
   * PATCH /api/tournaments/registrations/:regId/reject
   * Admin rejects team tournament registration
   */
  async rejectRegistration(req, res) {
    try {
      const regId = req.params.regId || req.params.id;
      const reason = req.body.reason || req.body.rejectionReason || 'Application rejected by tournament committee.';
      const adminEmail = req.adminUser?.email || req.user?.email || 'admin@cfvd.org';
      const updated = await tournamentService.rejectRegistration(regId, reason, adminEmail);
      res.json({
        success: true,
        message: `Registration for team '${updated.team_name}' has been REJECTED.`,
        registration: updated,
        data: updated
      });
    } catch (err) {
      res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Failed to reject registration.'
      });
    }
  }

  /**
   * GET /api/tournaments/:id/approved-teams
   * Get official approved teams for a tournament
   */
  async getApprovedTeams(req, res) {
    try {
      const teams = await tournamentService.getApprovedTeams(req.params.id);
      res.json({
        success: true,
        tournament_id: req.params.id,
        count: teams.length,
        teams,
        data: teams
      });
    } catch (err) {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve approved teams.'
      });
    }
  }
}

module.exports = new TournamentController();
