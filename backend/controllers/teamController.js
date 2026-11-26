/**
 * controllers/teamController.js
 * Controller for Team Registration, Authentication, and Squad Management.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const teamModel = require('../models/teamModel');

const { JWT_SECRET } = require('../config/env');

class TeamController {
  /**
   * POST /api/teams/register
   * Register a new Team with Coach and 15 Squad Players
   */
  async register(req, res) {
    try {
      const { teamName, coachName, coachEmail, players } = req.body;

      // 1. Validation for Team & Coach
      if (!teamName || typeof teamName !== 'string' || !teamName.trim()) {
        return res.status(400).json({ success: false, message: 'Please enter the Team Name.' });
      }

      if (!coachName || typeof coachName !== 'string' || !coachName.trim()) {
        return res.status(400).json({ success: false, message: 'Please enter the Coach Full Name.' });
      }

      const cleanCoachEmail = (coachEmail || '').trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanCoachEmail || !emailRegex.test(cleanCoachEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid Coach Email address.' });
      }

      // 2. Validation for Exactly 15 Players
      if (!Array.isArray(players) || players.length !== 15) {
        return res.status(400).json({
          success: false,
          message: 'Exactly 15 players are required for team registration.'
        });
      }

      // Validate individual player fields
      const playerEmailsSet = new Set();
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
          return res.status(400).json({
            success: false,
            message: `Player #${i + 1} is missing a valid Full Name.`
          });
        }
        const pEmail = (p.email || '').trim().toLowerCase();
        if (!pEmail || !emailRegex.test(pEmail)) {
          return res.status(400).json({
            success: false,
            message: `Player #${i + 1} (${p.name}) has an invalid email address.`
          });
        }
        if (!p.role || typeof p.role !== 'string' || !p.role.trim()) {
          return res.status(400).json({
            success: false,
            message: `Player #${i + 1} (${p.name}) must have an assigned role.`
          });
        }

        // Duplicate check within squad
        if (playerEmailsSet.has(pEmail)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate player email address "${pEmail}" found within squad. Each player must have a unique email.`
          });
        }
        playerEmailsSet.add(pEmail);
      }

      // 3. Uniqueness check for Coach Email in DB
      const existingCoach = await teamModel.findByCoachEmail(cleanCoachEmail);
      if (existingCoach) {
        return res.status(400).json({
          success: false,
          message: 'This coach email is already registered to another team.'
        });
      }

      // 4. Generate dynamic Team ID & Passkey
      const teamId = await teamModel.generateNextTeamId();

      // Generate random secure passkey e.g., VRD7K9X2
      const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
      const passkey = `VRD${randomChars}`;

      // Hash passkey using bcrypt
      const passkeyHash = await bcrypt.hash(passkey, 10);
      const internalId = 'TEAM-UUID-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

      // 5. Execute DB Transaction
      await teamModel.createTeamWithTransaction({
        id: internalId,
        teamId: teamId,
        teamName: teamName.trim(),
        coachName: coachName.trim(),
        coachEmail: cleanCoachEmail,
        passkeyHash: passkeyHash,
        players: players
      });

      return res.status(201).json({
        success: true,
        message: 'Team registered successfully!',
        team: {
          id: internalId,
          teamId: teamId,
          teamName: teamName.trim(),
          coachName: coachName.trim(),
          coachEmail: cleanCoachEmail,
          passkey: passkey,
          playerCount: 15,
          status: 'APPROVED'
        }
      });
    } catch (err) {
      console.error('Team Registration Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Registration failed due to a database error. Please try again.'
      });
    }
  }

  /**
   * POST /api/teams/login
   * Authenticate team using Team ID or Coach Email + Passkey
   */
  async login(req, res) {
    try {
      const { identifier, passkey } = req.body;

      if (!identifier || !identifier.trim() || !passkey || !passkey.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please enter both Team ID or Coach Email and Passkey.'
        });
      }

      const team = await teamModel.findByIdentifier(identifier.trim());
      if (!team) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Team ID/Coach Email or Passkey.'
        });
      }

      const isValidPasskey = await bcrypt.compare(passkey.trim(), team.team_passkey_hash);
      if (!isValidPasskey) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Team ID/Coach Email or Passkey.'
        });
      }

      const token = jwt.sign(
        { id: team.id, teamId: team.team_id, coachEmail: team.coach_email, role: 'TEAM', tv: 0 },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      res.cookie('team_token', token, {
        httpOnly: true,
        secure: !require('../config/env').isDevelopment,
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        token: token,
        team: {
          id: team.id,
          teamId: team.team_id,
          teamName: team.team_name,
          coachName: team.coach_name,
          coachEmail: team.coach_email,
          status: team.status,
          createdAt: team.created_at
        }
      });
    } catch (err) {
      console.error('Team Login Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Login failed due to a server error.'
      });
    }
  }

  /**
   * GET /api/teams/me
   * Get logged in team profile
   */
  async getMe(req, res) {
    try {
      const teamId = req.team ? req.team.id : null;
      if (!teamId) {
        return res.status(401).json({ success: false, message: 'Unauthenticated.' });
      }

      const team = await teamModel.findById(teamId);
      if (!team) {
        return res.status(404).json({ success: false, message: 'Team profile not found.' });
      }

      return res.status(200).json({
        success: true,
        team: {
          id: team.id,
          teamId: team.team_id,
          teamName: team.team_name,
          coachName: team.coach_name,
          coachEmail: team.coach_email,
          status: team.status,
          createdAt: team.created_at
        }
      });
    } catch (err) {
      console.error('Get Me Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
    }
  }

  /**
   * GET /api/teams/me/players
   * Get 15 players belonging to logged in team
   */
  async getMePlayers(req, res) {
    try {
      const teamId = req.team ? req.team.id : null;
      if (!teamId) {
        return res.status(401).json({ success: false, message: 'Unauthenticated.' });
      }

      const players = await teamModel.getPlayersByTeamId(teamId);
      return res.status(200).json({
        success: true,
        count: players.length,
        players: players.map(p => ({
          id: p.id,
          playerName: p.player_name,
          playerEmail: p.player_email,
          role: p.player_role,
          createdAt: p.created_at
        }))
      });
    } catch (err) {
      console.error('Get Me Players Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch squad players.' });
    }
  }

  /**
   * POST /api/teams/logout
   * Clear session
   */
  async logout(req, res) {
    res.clearCookie('team_token');
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  }

  /**
   * GET /api/admin/teams
   * List all teams for Admin Dashboard
   */
  async getAllTeamsForAdmin(req, res) {
    try {
      const teams = await teamModel.getAllTeams();
      return res.status(200).json({ success: true, teams });
    } catch (err) {
      console.error('Get All Teams Admin Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to list teams.' });
    }
  }
}

module.exports = new TeamController();
