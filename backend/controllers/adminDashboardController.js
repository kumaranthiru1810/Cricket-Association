/**
 * controllers/adminDashboardController.js
 * Comprehensive Controller for Cricket Association Professional Admin Panel.
 * Handles authentication, statistics, user/player/team management, approvals,
 * matches, tournaments, live scoring, notifications, content, and settings.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const adminService = require('../services/adminService');
const { validateScheduleDateTime } = require('../utils/dateTimeValidation');
const { sendListResponse } = require('../utils/responseHelper');

const { JWT_SECRET } = require('../config/env');

class AdminDashboardController {
  /**
   * POST /api/admin/login
   * Public standalone admin authentication endpoint.
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Both Administrator Email and Password are required.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = password.trim();

      // Check users table in database
      const [users] = await db.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      let adminUser = users && users.length > 0 ? users[0] : null;

      const env = require('../config/env');
      let isAuthenticated = false;

      if (env.isDevelopment && env.DEV_ADMIN_BYPASS && cleanEmail === env.DEV_ADMIN_EMAIL && env.DEV_ADMIN_OTP && cleanPass === env.DEV_ADMIN_OTP) {
        isAuthenticated = true;
        if (!adminUser) {
          adminUser = {
            id: 'ADM-DEV',
            name: 'Development Administrator',
            email: env.DEV_ADMIN_EMAIL,
            role: 'ADMIN',
            status: 'ACTIVE'
          };
        }
      } else if (adminUser && (adminUser.role === 'ADMIN' || adminUser.role === 'SUPER_ADMIN')) {
        if (adminUser.password_hash) {
          try {
            isAuthenticated = await bcrypt.compare(cleanPass, adminUser.password_hash);
          } catch (e) {
            isAuthenticated = false;
          }
        }
      }

      if (!isAuthenticated || !adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'SUPER_ADMIN')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid administrative credentials or unauthorized account.'
        });
      }

      const token = jwt.sign(
        {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'ADMIN',
          tv: adminUser.token_version || 0,
          association: 'Cricket Federation of Virudhunagar District'
        },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      // Record audit log
      try {
        await db.query(
          `INSERT INTO audit_logs (id, action, initiated_by, details, timestamp, ip_address)
           VALUES (?, ?, ?, ?, NOW(), ?)`,
          [
            'LOG-' + Date.now(),
            'ADMIN_LOGIN',
            adminUser.email,
            'Administrator logged into management console',
            req.ip || '127.0.0.1'
          ]
        );
      } catch (e) { }

      return res.status(200).json({
        success: true,
        message: 'Administrator authenticated successfully.',
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'ADMIN',
          status: adminUser.status || 'ACTIVE'
        }
      });
    } catch (err) {
      console.error('Admin Login Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authentication.'
      });
    }
  }

  /**
   * POST /api/auth/super-admin/login
   * Dedicated Super Administrator authentication endpoint.
   */
  async superAdminLogin(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Both Super Administrator Email and Master Password are required.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = password.trim();

      const [users] = await db.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      let adminUser = users && users.length > 0 ? users[0] : null;

      const env = require('../config/env');
      let isAuthenticated = false;

      if (env.isDevelopment && env.DEV_ADMIN_BYPASS && cleanEmail === env.DEV_ADMIN_EMAIL && env.DEV_ADMIN_OTP && cleanPass === env.DEV_ADMIN_OTP) {
        isAuthenticated = true;
        if (!adminUser) {
          adminUser = {
            id: 'ADM-DEV',
            name: 'Development Super Administrator',
            email: env.DEV_ADMIN_EMAIL,
            role: 'ADMIN',
            is_super_admin: true,
            admin_level: 'Permanent Super Administrator',
            status: 'ACTIVE'
          };
        }
      } else if (adminUser && (adminUser.role === 'ADMIN' || adminUser.role === 'SUPER_ADMIN')) {
        if (!adminUser.is_super_admin && adminUser.role !== 'SUPER_ADMIN') {
          return res.status(403).json({
            success: false,
            message: 'Access denied. This login portal is restricted to Super Administrators only.'
          });
        }
        if (adminUser.password_hash) {
          try {
            isAuthenticated = await bcrypt.compare(cleanPass, adminUser.password_hash);
          } catch (_e) {
            isAuthenticated = false;
          }
        }
      }

      if (!isAuthenticated || !adminUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Super Administrator credentials or unauthorized account.'
        });
      }

      const token = jwt.sign(
        {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'ADMIN',
          is_super_admin: true,
          tv: adminUser.token_version || 0,
          association: 'Cricket Federation of Virudhunagar District'
        },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      try {
        await db.query(
          `INSERT INTO audit_logs (id, action, initiated_by, details, timestamp, ip_address)
           VALUES (?, ?, ?, ?, NOW(), ?)`,
          [
            'LOG-' + Date.now(),
            'SUPER_ADMIN_LOGIN',
            adminUser.email,
            'Super Administrator logged into dedicated portal',
            req.ip || '127.0.0.1'
          ]
        );
      } catch (_e) {}

      return res.status(200).json({
        success: true,
        message: 'Super Administrator authenticated successfully.',
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'ADMIN',
          is_super_admin: true,
          admin_level: adminUser.admin_level || 'Permanent Super Administrator',
          status: adminUser.status || 'ACTIVE'
        }
      });
    } catch (err) {
      console.error('Super Admin Login Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authentication.'
      });
    }
  }

  /**
   * GET /api/admin/me
   */
  async getMe(req, res) {
    try {
      const admin = req.adminUser || req.user;
      return res.status(200).json({
        success: true,
        user: admin
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/dashboard-stats
   * Returns real database statistics and dashboard feeds.
   */
  async getDashboardStats(req, res) {
    try {
      // 1. Users count
      const [users] = await db.query('SELECT * FROM users');
      const totalUsers = (users || []).length;

      // 2. Players count
      const [players] = await db.query('SELECT * FROM players');
      const [teamPlayers] = await db.query('SELECT * FROM team_players');
      const totalPlayers = (players || []).length + (teamPlayers || []).length;

      // 3. Teams count
      const [teams] = await db.query('SELECT * FROM teams');
      const totalTeams = (teams || []).length;

      // 4. Tournaments count
      const [tournaments] = await db.query('SELECT * FROM tournaments');
      const activeTournaments = (tournaments || []).filter(t => (t.status || '').toUpperCase() === 'ACTIVE').length || tournaments.length;

      // 5. Matches count
      const [matches] = await db.query('SELECT * FROM matches');
      const upcomingMatches = (matches || []).filter(m => (m.status || '').toUpperCase() === 'SCHEDULED').length;
      const liveMatches = (matches || []).filter(m => (m.status || '').toUpperCase() === 'LIVE').length;

      // 6. Pending Approvals count (Scorers + Teams + Umpires + Players)
      const pendingList = [];

      try {
        const pScorers = await db.models.User.find({ role: 'SCORER', status: 'PENDING' }).sort({ created_at: -1 }).lean();
        (pScorers || []).forEach(s => {
          pendingList.push({
            id: s.id,
            name: s.name,
            type: 'Official Scorer',
            email: s.email,
            association: s.scorer_details?.taluk ? `${s.scorer_details.taluk} Scorer` : 'District Certified Scorer',
            date: s.created_at,
            status: 'PENDING'
          });
        });
      } catch (e) { }

      try {
        const teamRegistrationModel = require('../models/teamRegistrationModel');
        const pTeams = await teamRegistrationModel.getAll('PENDING');
        (pTeams || []).forEach(t => {
          pendingList.push({
            id: t.id,
            name: t.team_name,
            type: 'Team / Club',
            email: t.coach_email || 'N/A',
            association: `${t.taluk || t.city || 'District'} Club (${(t.players || []).length} Players)`,
            date: t.created_at,
            status: 'PENDING'
          });
        });
      } catch (e) { }

      try {
        const pUmpires = await db.models.User.find({ role: 'UMPIRE', status: 'PENDING' }).sort({ created_at: -1 }).lean();
        (pUmpires || []).forEach(u => {
          pendingList.push({
            id: u.id,
            name: u.name,
            type: 'Official Umpire',
            email: u.email,
            association: `${u.umpire_details?.district || 'District'} Umpire Panel`,
            date: u.created_at,
            status: 'PENDING'
          });
        });
      } catch (e) { }

      try {
        const pPlayers = await db.models.User.find({ role: 'PLAYER', status: 'PENDING' }).sort({ created_at: -1 }).lean();
        (pPlayers || []).forEach(p => {
          pendingList.push({
            id: p.id,
            name: p.name,
            type: 'Player',
            email: p.email,
            association: `Player (${p.player_details?.taluk || 'Virudhunagar'})`,
            date: p.created_at,
            status: 'PENDING'
          });
        });
      } catch (e) { }

      const pendingApprovals = pendingList.length;

      // Section A: Recent Registrations
      const recentUsers = (users || []).slice(0, 6).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        date: u.created_at || new Date().toISOString()
      }));

      // Section C: Upcoming and Live Matches
      const teamMap = {};
      (teams || []).forEach(t => { teamMap[t.id] = t.name || t.team_name || t.short_name; });
      const upcomingList = (matches || []).map(m => ({
        id: m.id,
        tournament: m.tournament_id === 'TOUR-2026' ? 'VPL 2026' : (m.tournament_id || 'District League'),
        teamA: teamMap[m.team_a_id] || m.team_a_id || 'Team A',
        teamB: teamMap[m.team_b_id] || m.team_b_id || 'Team B',
        venue: m.venue_name || m.venue || 'District Ground',
        date: m.match_date || m.scheduled_date || 'TBD',
        time: m.match_time || m.scheduled_time || '10:00 AM',
        status: m.status,
        schedule_confirmation_status: m.schedule_confirmation_status || 'PENDING',
        team_a_allocation_status: m.team_a_allocation_status || 'PENDING',
        team_b_allocation_status: m.team_b_allocation_status || 'PENDING',
        result: m.result_text || (m.status === 'LIVE' ? 'In Progress' : 'Scheduled')
      }));

      // Section D: Recent Activities from audit logs
      const [logs] = await db.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 6');
      const recentActivities = (logs || []).map(l => ({
        id: l.id,
        action: l.action,
        user: l.initiated_by,
        details: l.details,
        time: l.timestamp
      }));

      return res.status(200).json({
        success: true,
        stats: {
          totalUsers,
          totalPlayers,
          totalTeams,
          activeTournaments,
          upcomingMatches,
          liveMatches,
          pendingApprovals
        },
        recentRegistrations: recentUsers,
        pendingApprovals: pendingList,
        upcomingMatches: upcomingList,
        recentActivities
      });
    } catch (err) {
      console.error('Dashboard Stats Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/users
   */
  async getUsers(req, res) {
    try {
      const { search, role, status } = req.query;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const filter = {};
      if (search) {
        const safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ name: safeRegex }, { email: safeRegex }, { mobile: safeRegex }];
      }
      if (role && role !== 'ALL') {
        filter.role = role.toUpperCase();
      }
      if (status && status !== 'ALL') {
        filter.status = status.toUpperCase();
      }

      const [total, users] = await Promise.all([
        db.models.User.countDocuments(filter),
        db.models.User.find(filter)
          .select('id name email mobile aadhaar role status is_super_admin admin_level created_at updated_at')
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      ]);

      return sendListResponse(res, users, {
        data: users,
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/admin/users/:id/status
   */
  async updateUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });

      await db.query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [status.toUpperCase(), id]);
      return res.status(200).json({ success: true, message: `User status updated to ${status}.` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PUT /api/admin/users/:id
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      await db.initDb();
      const {
        name,
        email,
        mobile,
        aadhaar,
        role,
        status,
        player_details,
        scorer_details,
        umpire_details
      } = req.body || {};

      const cleanEmail = email ? String(email).trim().toLowerCase() : undefined;
      const cleanMobile = mobile !== undefined ? String(mobile).replace(/\D/g, '') : undefined;
      const cleanAadhaar = aadhaar !== undefined ? String(aadhaar).replace(/\D/g, '') : undefined;

      const updateFields = {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(cleanEmail !== undefined && { email: cleanEmail }),
        ...(cleanMobile !== undefined && { mobile: cleanMobile }),
        ...(cleanAadhaar !== undefined && { aadhaar: cleanAadhaar }),
        ...(role !== undefined && { role: String(role).toUpperCase() }),
        ...(status !== undefined && { status: String(status).toUpperCase() }),
        updated_at: new Date()
      };

      if (player_details && typeof player_details === 'object') {
        for (const [k, v] of Object.entries(player_details)) {
          if (v !== undefined) {
            updateFields[`player_details.${k}`] = v;
          }
        }
        if (cleanMobile !== undefined) {
          updateFields['player_details.phone'] = cleanMobile;
          updateFields['player_details.mobile'] = cleanMobile;
        }
        if (cleanAadhaar !== undefined) {
          updateFields['player_details.aadhaar'] = cleanAadhaar;
          updateFields['player_details.aadhaar_number'] = cleanAadhaar;
        }
      }

      if (scorer_details && typeof scorer_details === 'object') {
        for (const [k, v] of Object.entries(scorer_details)) {
          if (v !== undefined) updateFields[`scorer_details.${k}`] = v;
        }
      }

      if (umpire_details && typeof umpire_details === 'object') {
        for (const [k, v] of Object.entries(umpire_details)) {
          if (v !== undefined) updateFields[`umpire_details.${k}`] = v;
        }
      }

      const updated = await db.models.User.findOneAndUpdate(
        { id },
        { $set: updateFields },
        { returnDocument: 'after' }
      ).lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (String(updated.role || '').toUpperCase() === 'PLAYER') {
        await db.models.Player.updateMany(
          { $or: [{ id }, ...(cleanEmail ? [{ email: cleanEmail }] : [])] },
          {
            $set: {
              ...(name !== undefined && { name: String(name).trim() }),
              ...(cleanEmail !== undefined && { email: cleanEmail }),
              ...(cleanMobile !== undefined && { phone: cleanMobile, mobile: cleanMobile }),
              ...(cleanAadhaar !== undefined && { aadhaar: cleanAadhaar }),
              ...(player_details?.batting_style && { batting_style: player_details.batting_style }),
              ...(player_details?.bowling_style && { bowling_style: player_details.bowling_style })
            }
          }
        ).catch(() => {});
      }

      return res.status(200).json({ success: true, message: 'User updated successfully.', user: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * DELETE /api/admin/users/:id
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      await db.initDb();
      const existing = await db.models.User.findOne({ id }).lean();
      if (!existing) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      if (existing.is_super_admin || existing.role === 'SUPER_ADMIN' || String(id).startsWith('ADM-')) {
        return res.status(403).json({ success: false, message: 'Cannot delete primary administrator accounts.' });
      }
      await db.models.User.deleteOne({ id });
      const emailFilter = existing.email ? [{ email: existing.email }] : [];
      await Promise.all([
        db.models.Player.deleteMany({ $or: [{ id }, ...emailFilter] }).catch(() => {}),
        db.models.Scorer.deleteMany({ $or: [{ id }, ...emailFilter] }).catch(() => {})
      ]);
      return res.status(200).json({ success: true, message: 'User permanently deleted. They must register again to access the portal.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/players
   */
  async getPlayers(req, res) {
    try {
      const { search, team, role, status } = req.query;
      const [players] = await db.query('SELECT * FROM players ORDER BY name ASC');
      const [teamPlayers] = await db.query('SELECT * FROM team_players ORDER BY player_name ASC');
      const [teams] = await db.query('SELECT id, name, team_name FROM teams');

      const teamMap = {};
      (teams || []).forEach(t => { teamMap[t.id] = t.name || t.team_name; });

      // Combine direct players and team squad players
      const allPlayers = [];
      (players || []).forEach(p => {
        allPlayers.push({
          id: p.id,
          name: p.name,
          teamId: p.team_id,
          teamName: teamMap[p.team_id] || 'District Pool',
          district: 'Virudhunagar',
          role: p.role || 'BATTER',
          jersey: p.jersey_number || '-',
          battingStyle: p.batting_style || 'RIGHT_HAND',
          bowlingStyle: p.bowling_style || 'NONE',
          photo: p.photo || p.image_path || null,
          image: p.photo || p.image_path || null,
          image_path: p.image_path || p.photo || null,
          status: p.status || 'ACTIVE'
        });
      });

      (teamPlayers || []).forEach(tp => {
        allPlayers.push({
          id: tp.id,
          name: tp.player_name,
          email: tp.player_email,
          teamId: tp.team_id,
          teamName: teamMap[tp.team_id] || 'Registered Club',
          district: 'Virudhunagar',
          role: tp.player_role || 'ALL_ROUNDER',
          jersey: '-',
          battingStyle: 'RIGHT_HAND',
          bowlingStyle: 'RIGHT_ARM_MEDIUM',
          photo: tp.photo || tp.image_path || null,
          image: tp.photo || tp.image_path || null,
          image_path: tp.image_path || tp.photo || null,
          status: 'ACTIVE'
        });
      });

      let filtered = allPlayers;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q)
        );
      }

      if (team && team !== 'ALL') {
        filtered = filtered.filter(p => p.teamId === team || p.teamName.toLowerCase().includes(team.toLowerCase()));
      }

      if (role && role !== 'ALL') {
        filtered = filtered.filter(p => (p.role || '').toUpperCase() === role.toUpperCase());
      }

      if (status && status !== 'ALL') {
        filtered = filtered.filter(p => (p.status || '').toUpperCase() === status.toUpperCase());
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;
      const paginated = filtered.slice(skip, skip + limit);

      return sendListResponse(res, paginated, {
        data: paginated,
        players: paginated,
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit)
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/admin/players
   */
  async createPlayer(req, res) {
    try {
      const { name, teamId, role, jerseyNumber, battingStyle, bowlingStyle } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Player name is required.' });

      const newId = 'P-' + Date.now();
      await db.query(
        `INSERT INTO players (id, team_id, name, jersey_number, role, batting_style, bowling_style, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW())`,
        [newId, teamId || null, name, jerseyNumber || null, role || 'BATTER', battingStyle || 'RIGHT_HAND', bowlingStyle || 'NONE']
      );

      return res.status(201).json({ success: true, message: 'Player added successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PUT /api/admin/players/:id
   */
  async updatePlayer(req, res) {
    try {
      const { id } = req.params;
      const { name, teamId, role, jerseyNumber, battingStyle, bowlingStyle, status } = req.body;
      await db.query(
        `UPDATE players SET name = ?, team_id = ?, role = ?, jersey_number = ?, batting_style = ?, bowling_style = ?, status = ?, updated_at = NOW()
         WHERE id = ?`,
        [name, teamId, role, jerseyNumber, battingStyle, bowlingStyle, status, id]
      );
      return res.status(200).json({ success: true, message: 'Player updated successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/teams
   */
  async getTeams(req, res) {
    try {
      const { search, status } = req.query;
      const [teams, playerCountsResult, teamPlayerCountsResult] = await Promise.all([
        db.models.Team.find({}).select('id team_id name team_name short_name city taluk coach_name coach_email logo photo image_path status stats created_at createdAt').sort({ created_at: 1, name: 1 }).lean(),
        db.models.Player.aggregate([{ $group: { _id: '$team_id', count: { $sum: 1 } } }]),
        db.models.TeamPlayer.aggregate([{ $group: { _id: '$team_id', count: { $sum: 1 } } }])
      ]);

      const playerCounts = {};
      (teamPlayerCountsResult || []).forEach(r => { if (r._id) playerCounts[r._id] = (playerCounts[r._id] || 0) + r.count; });
      (playerCountsResult || []).forEach(r => { if (r._id) playerCounts[r._id] = (playerCounts[r._id] || 0) + r.count; });

      let list = (teams || []).map(t => ({
        id: t.id,
        teamId: t.team_id || t.id,
        name: t.name || t.team_name,
        shortName: t.short_name || 'CC',
        city: t.city || 'Virudhunagar',
        coachName: t.coach_name || 'Staff Coach',
        coachEmail: t.coach_email || 'contact@cfvd.org',
        logo: t.logo || t.photo || t.image_path || null,
        photo: t.photo || t.logo || t.image_path || null,
        image_path: t.image_path || t.photo || t.logo || null,
        status: (t.status || 'ACTIVE').toUpperCase(),
        created_at: t.created_at || t.createdAt || null,
        playerCount: playerCounts[t.id] || (playerCounts[t.team_id] || 15)
      }));

      if (search) {
        const q = search.toLowerCase();
        list = list.filter(t => t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q));
      }

      if (status && status !== 'ALL') {
        list = list.filter(t => t.status === status.toUpperCase());
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;
      const paginated = list.slice(skip, skip + limit);

      return sendListResponse(res, paginated, {
        data: paginated,
        teams: paginated,
        total: list.length,
        page,
        limit,
        totalPages: Math.ceil(list.length / limit)
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/teams/:id
   */
  async getTeamById(req, res) {
    try {
      const { id } = req.params;
      const [teams] = await db.query('SELECT * FROM teams WHERE id = ? OR team_id = ?', [id, id]);
      if (!teams || teams.length === 0) {
        return res.status(404).json({ success: false, message: 'Team not found.' });
      }

      const team = teams[0];
      const [tPlayers] = await db.query('SELECT * FROM team_players WHERE team_id = ?', [team.id]);
      const [dPlayers] = await db.query('SELECT * FROM players WHERE team_id = ?', [team.id]);

      const squadEmails = (tPlayers || [])
        .map(p => String(p.player_email || '').trim().toLowerCase())
        .filter(Boolean);
      const idByEmail = {};
      if (squadEmails.length > 0 && db.models) {
        try {
          const [uRows, pRows] = await Promise.all([
            db.models.User ? db.models.User.find({ email: { $in: squadEmails } }, 'id email').lean() : [],
            db.models.Player ? db.models.Player.find({ email: { $in: squadEmails } }, 'id email').lean() : []
          ]);
          (uRows || []).forEach(u => { if (u.email && u.id) idByEmail[u.email.toLowerCase()] = u.id; });
          (pRows || []).forEach(pl => { if (pl.email && pl.id) idByEmail[pl.email.toLowerCase()] = pl.id; });
        } catch (_e) {}
      }

      const squad = [...(tPlayers || []).map(p => {
        const em = String(p.player_email || '').trim().toLowerCase();
        const resolvedId = idByEmail[em] || p.id;
        return {
          id: resolvedId,
          playerId: resolvedId,
          name: p.player_name,
          email: p.player_email,
          role: p.player_role
        };
      }), ...(dPlayers || []).map(p => ({
        id: p.id,
        playerId: p.id,
        name: p.name,
        email: p.email || 'N/A',
        role: p.role,
        jersey: p.jersey_number
      }))];

      return res.status(200).json({
        success: true,
        team: {
          id: team.id,
          teamId: team.team_id || team.id,
          name: team.name || team.team_name,
          shortName: team.short_name,
          city: team.city,
          coachName: team.coach_name,
          coachEmail: team.coach_email,
          status: team.status,
          logo: team.logo || team.photo || team.image_path || null,
          photo: team.photo || team.logo || team.image_path || null,
          image_path: team.image_path || team.photo || team.logo || null,
          squad
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/admin/teams/:id/status
   */
  async updateTeamStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await db.query('UPDATE teams SET status = ?, updated_at = NOW() WHERE id = ? OR team_id = ?', [status.toUpperCase(), id, id]);
      return res.status(200).json({ success: true, message: `Team status updated to ${status}.` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/tournaments
   */
  async getTournaments(req, res) {
    try {
      const [rows] = await db.query('SELECT * FROM tournaments ORDER BY start_date DESC');
      return sendListResponse(res, rows || [], { tournaments: rows || [], data: rows || [] });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/admin/tournaments
   */
  async createTournament(req, res) {
    try {
      const { name, shortName, season, format, overs, startDate, endDate } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Tournament name is required.' });

      const newId = 'TOUR-' + Date.now();
      await db.query(
        `INSERT INTO tournaments (id, name, short_name, season, format, overs, start_date, end_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
        [newId, name, shortName || '', season || '2026', format || 'T20', overs || 20, startDate || null, endDate || null]
      );

      return res.status(201).json({ success: true, message: 'Tournament created successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PUT /api/admin/tournaments/:id
   */
  async updateTournament(req, res) {
    try {
      const { id } = req.params;
      const { name, shortName, season, format, overs, startDate, endDate, status } = req.body;
      await db.query(
        `UPDATE tournaments SET name = ?, short_name = ?, season = ?, format = ?, overs = ?, start_date = ?, end_date = ?, status = ?, updated_at = NOW()
         WHERE id = ?`,
        [name, shortName, season, format, overs, startDate, endDate, status || 'ACTIVE', id]
      );
      return res.status(200).json({ success: true, message: 'Tournament updated successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/matches
   */
  async getMatches(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.status && req.query.status !== 'ALL') {
        filter.status = req.query.status.toUpperCase();
      }
      if (req.query.tournament_id) {
        filter.tournament_id = req.query.tournament_id;
      }

      const [total, matches, teams] = await Promise.all([
        db.models.Match.countDocuments(filter),
        db.models.Match.find(filter)
          .sort({ match_date: -1, match_time: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        db.models.Team.find({}).select('id name team_name short_name').lean()
      ]);

      const teamMap = {};
      (teams || []).forEach(t => { teamMap[t.id] = t.name || t.team_name; });

      const formatted = (matches || []).map(m => {
        const teamAName = teamMap[m.team_a_id] || m.team_a_name || m.team_a_id || 'Team A';
        const teamBName = teamMap[m.team_b_id] || m.team_b_name || m.team_b_id || 'Team B';
        const venue = m.venue || m.venue_name || 'Kamarajar District Stadium';
        const matchDate = m.match_date || m.scheduled_date || '2026-10-08';
        const matchTime = m.match_time || m.scheduled_time || '02:30 PM';
        const tournamentName = m.tournament_name || (m.tournament_id === 'TOUR-2026' ? 'VPL 2026' : 'Virudhunagar Premier League 2026');
        const overs = m.overs_per_side || m.overs || 20;

        return {
          id: m.id,
          tournamentId: m.tournament_id,
          tournament_id: m.tournament_id,
          tournamentName,
          tournament_name: tournamentName,
          teamAId: m.team_a_id,
          team_a_id: m.team_a_id,
          teamAName,
          team_a_name: teamAName,
          teamBId: m.team_b_id,
          team_b_id: m.team_b_id,
          teamBName,
          team_b_name: teamBName,
          venue,
          date: matchDate,
          match_date: matchDate,
          time: matchTime,
          match_time: matchTime,
          overs,
          overs_per_side: overs,
          match_type: m.match_type || 'T20',
          assigned_scorer_id: m.assigned_scorer_id || 'SCR-101',
          scorer_name: m.scorer_name || m.assigned_scorer_id || 'SCR-101',
          status: m.status || 'SCHEDULED',
          result: m.result_summary || m.result_text,
          result_summary: m.result_summary || m.result_text
        };
      });

      return sendListResponse(res, formatted, {
        data: formatted,
        matches: formatted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/admin/matches
   */
  async createMatch(req, res) {
    try {
      const { tournamentId, teamAId, teamBId, venueName, date, time, overs } = req.body;
      if (!teamAId || !teamBId) {
        return res.status(400).json({ success: false, message: 'Both participating teams are required.' });
      }

      const dtValidation = validateScheduleDateTime(date, time || '10:00 AM');
      if (!dtValidation.isValid) {
        return res.status(400).json({ success: false, error: dtValidation.error, message: dtValidation.error });
      }

      const matchId = 'M-' + Date.now();
      await db.query(
        `INSERT INTO matches (id, tournament_id, venue_name, team_a_id, team_b_id, scheduled_date, scheduled_time, overs, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', NOW(), NOW())`,
        [matchId, tournamentId || 'TOUR-2026', venueName || 'Kamarajar Stadium, Virudhunagar', teamAId, teamBId, dtValidation.cleanDate, dtValidation.parsedTime.formatted12, overs || 20]
      );

      return res.status(201).json({ success: true, message: 'Match scheduled successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/admin/matches/:id
   */
  async updateMatch(req, res) {
    try {
      const { id } = req.params;
      const { status, resultText, venueName, scheduledDate, scheduledTime } = req.body;

      if (scheduledDate !== undefined || scheduledTime !== undefined) {
        const dtValidation = validateScheduleDateTime(scheduledDate, scheduledTime);
        if (!dtValidation.isValid) {
          return res.status(400).json({ success: false, error: dtValidation.error, message: dtValidation.error });
        }
      }

      await db.query(
        `UPDATE matches SET status = COALESCE(?, status), result_text = COALESCE(?, result_text),
         venue_name = COALESCE(?, venue_name), scheduled_date = COALESCE(?, scheduled_date), scheduled_time = COALESCE(?, scheduled_time), updated_at = NOW()
         WHERE id = ?`,
        [status, resultText, venueName, scheduledDate, scheduledTime, id]
      );
      return res.status(200).json({ success: true, message: 'Match updated successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async postponeMatch(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminEmail = req.adminUser?.email || 'system-admin';
      const match = await adminService.postponeMatch(id, { reason }, adminEmail);
      return res.status(200).json({ success: true, message: 'Match postponed successfully.', match });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message, error: err.message });
    }
  }

  async rescheduleMatch(req, res) {
    try {
      const { id } = req.params;
      const { newDate, newTime, reason } = req.body;
      const adminEmail = req.adminUser?.email || 'system-admin';
      const match = await adminService.rescheduleMatch(id, { newDate, newTime, reason }, adminEmail);
      return res.status(200).json({ success: true, message: 'Match rescheduled successfully.', match });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message, error: err.message });
    }
  }

  async getPostponementRequests(req, res) {
    try {
      const requests = await adminService.getPostponementRequests();
      return sendListResponse(res, requests || [], { requests: requests || [], data: requests || [] });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message, error: err.message });
    }
  }

  async reviewPostponementRequest(req, res) {
    try {
      const { id } = req.params;
      const { decision, reviewNotes } = req.body;
      const adminEmail = req.adminUser?.email || 'system-admin';
      const match = await adminService.reviewUmpirePostponement(id, { decision, reviewNotes }, adminEmail);
      return res.status(200).json({ success: true, message: `Postponement request ${decision}D.`, match });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message, error: err.message });
    }
  }

  /**
   * GET /api/admin/approvals
   */
  async getApprovals(req, res) {
    try {
      await db.initDb();
      const items = [];

      // 0. Match Postponement Requests (from Match model)
      try {
        const postpReqs = await db.models.Match.find({
          'umpire_postponement_request.status': 'PENDING'
        }).sort({ 'umpire_postponement_request.requested_at': -1 }).lean();

        postpReqs.forEach(m => {
          items.push({
            id: m.id,
            matchId: m.id,
            applicantName: m.umpire_postponement_request?.umpire_name || 'Assigned Field Umpire',
            type: 'POSTPONEMENT',
            contact: m.umpire_postponement_request?.umpire_id || 'Umpire',
            phone: m.venue || 'Stadium',
            association: `Match Postponement • ${m.team_a_name || 'Team A'} vs ${m.team_b_name || 'Team B'}`,
            date: m.umpire_postponement_request?.requested_at || m.created_at,
            status: 'PENDING',
            details: {
              matchId: m.id,
              teamA: m.team_a_name,
              teamB: m.team_b_name,
              matchDate: m.match_date,
              matchTime: m.match_time,
              venue: m.venue,
              reason: m.umpire_postponement_request?.reason,
              umpireName: m.umpire_postponement_request?.umpire_name
            },
            rejectionReason: null
          });
        });
      } catch (e) {
        console.warn('Postponements fetch error in getApprovals:', e.message);
      }

      // 1. Scorers (from User and Scorer models)
      try {
        const scorers = await db.models.User.find({ role: 'SCORER', status: { $ne: 'DELETED' } }).sort({ created_at: -1 }).lean();
        scorers.forEach(s => {
          const ph = s.mobile || s.phone || s.scorer_details?.mobile || s.scorer_details?.phone || '-';
          const adh = s.aadhaar || s.scorer_details?.aadhaar || s.aadhaar_number || '-';
          items.push({
            id: s.id,
            applicantName: s.name,
            type: 'SCORER',
            contact: s.email,
            phone: ph,
            aadhaar: adh,
            association: s.scorer_details?.taluk ? `${s.scorer_details.taluk} District Scorer` : (s.association || 'District Certified Scorer'),
            date: s.created_at,
            status: (s.status === 'ACTIVE' || s.status === 'APPROVED') ? 'APPROVED' : (s.status || 'PENDING'),
            certificationLevel: s.scorer_details?.certification_level || s.certificationLevel || 'District Certified',
            details: {
              ...(s.scorer_details || {}),
              phone: ph,
              mobile: ph,
              aadhaar: adh
            },
            rejectionReason: s.rejection_reason || null
          });
        });
      } catch (e) {
        console.warn('Scorers fetch error in getApprovals:', e.message);
      }

      // 2. Teams (from TeamRegistration model)
      try {
        const teamRegistrationModel = require('../models/teamRegistrationModel');
        const teamRegs = await teamRegistrationModel.getAll();
        (teamRegs || []).forEach(t => {
          if (t.status === 'DELETED') return;
          const cPhone = t.coach_phone || t.coach_mobile || t.phone || t.mobile || '-';
          const cAadhaar = t.coach_aadhaar || t.aadhaar || '-';
          items.push({
            id: t.id,
            applicantName: `${t.team_name} (Coach: ${t.coach_name})`,
            type: 'TEAM',
            contact: t.coach_email,
            phone: cPhone,
            coachPhone: cPhone,
            aadhaar: cAadhaar,
            coachAadhaar: cAadhaar,
            association: `${t.taluk || t.city || 'District'} Club (${(t.players || []).length} Players)`,
            date: t.created_at,
            status: t.status || 'PENDING',
            players: t.players || [],
            details: {
              teamName: t.team_name,
              coachName: t.coach_name,
              coachEmail: t.coach_email,
              coachPhone: cPhone,
              coachAadhaar: cAadhaar,
              taluk: t.taluk,
              city: t.city,
              squadCount: (t.players || []).length
            },
            rejectionReason: t.rejection_reason || null
          });
        });
      } catch (e) {
        console.warn('Teams fetch error in getApprovals:', e.message);
      }

      // 3. Umpires (from User model role: UMPIRE)
      try {
        const umpires = await db.models.User.find({ role: 'UMPIRE', status: { $ne: 'DELETED' } }).sort({ created_at: -1 }).lean();
        umpires.forEach(u => {
          const uPh = u.mobile || u.phone || u.umpire_details?.mobile || '-';
          const uAdh = u.aadhaar || u.umpire_details?.aadhaar || u.aadhaar_number || '-';
          items.push({
            id: u.id,
            applicantName: u.name,
            type: 'UMPIRE',
            contact: u.email,
            phone: uPh,
            aadhaar: uAdh,
            association: `${u.umpire_details?.district || 'District'} Official Umpire Panel`,
            date: u.created_at,
            status: (u.status === 'ACTIVE' || u.status === 'APPROVED') ? 'APPROVED' : (u.status || 'PENDING'),
            qualification: u.umpire_details?.certification_level || u.umpire_details?.qualification || 'District Certified Umpire',
            experience: u.umpire_details?.experience || `${u.umpire_details?.experience_years || 0} years`,
            details: {
              ...(u.umpire_details || {}),
              phone: uPh,
              mobile: uPh,
              aadhaar: uAdh
            },
            rejectionReason: u.rejection_reason || null
          });
        });
      } catch (e) {
        console.warn('Umpires fetch error in getApprovals:', e.message);
      }

      // 4. Players (from User model role: PLAYER)
      try {
        const players = await db.models.User.find({ role: 'PLAYER', status: { $ne: 'DELETED' } }).sort({ created_at: -1 }).limit(50).lean();
        players.forEach(p => {
          const pPh = p.mobile || p.phone || p.player_details?.mobile || p.player_details?.phone || '-';
          const pAdh = p.aadhaar || p.player_details?.aadhaar || p.aadhaar_number || '-';
          items.push({
            id: p.id,
            applicantName: p.name,
            type: 'PLAYER',
            contact: p.email,
            phone: pPh,
            aadhaar: pAdh,
            association: `Player • ${p.player_details?.taluk || 'Virudhunagar'} (${p.player_details?.category || 'Senior'})`,
            date: p.created_at,
            status: (p.status === 'ACTIVE' || p.status === 'APPROVED') ? 'APPROVED' : (p.status || 'PENDING'),
            details: {
              ...(p.player_details || {}),
              phone: pPh,
              mobile: pPh,
              aadhaar: pAdh
            },
            rejectionReason: p.rejection_reason || null
          });
        });
      } catch (e) {
        console.warn('Players fetch error in getApprovals:', e.message);
      }

      // Sort all items newest first
      items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;
      const paginated = items.slice(skip, skip + limit);

      return sendListResponse(res, paginated, {
        data: paginated,
        approvals: paginated,
        total: items.length,
        page,
        limit,
        totalPages: Math.ceil(items.length / limit)
      });
    } catch (err) {
      console.error('getApprovals error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/admin/approvals/:type/:id
   */
  async handleApproval(req, res) {
    try {
      await db.initDb();
      const mongoose = require('mongoose');
      const { type, id } = req.params;
      const { action, reason } = req.body; // action: 'approve' | 'reject' | 'delete' | 'restore'
      const cleanType = (type || '').toUpperCase();
      const notificationModel = require('../models/notificationModel');
      const authService = require('../services/authService');
      const teamRegistrationModel = require('../models/teamRegistrationModel');

      if (action === 'delete') {
        const result = await authService.deleteRegistration(id, cleanType, req.adminUser ? req.adminUser.email : 'ADMIN');
        return res.status(200).json(result);
      }
      if (action === 'restore') {
        const result = await authService.restoreRegistration(id, cleanType, req.adminUser ? req.adminUser.email : 'ADMIN');
        return res.status(200).json(result);
      }

      const isApprove = action === 'approve';

      const isMongoId = mongoose.Types.ObjectId.isValid(id);
      const queryId = isMongoId ? { $or: [{ id }, { _id: id }] } : { id };

      let applicantName = id;

      if (cleanType === 'POSTPONEMENT' || cleanType === 'MATCH_POSTPONE') {
        const decision = isApprove ? 'APPROVE' : 'REJECT';
        const match = await adminService.reviewUmpirePostponement(id, { decision, reviewNotes: reason }, req.adminUser ? req.adminUser.email : 'system-admin');
        return res.status(200).json({
          success: true,
          message: `Match postponement request ${decision}D.`,
          match
        });
      } else if (cleanType === 'SCORER') {
        const u = await db.models.User.findOneAndUpdate(
          queryId,
          { $set: { status: isApprove ? 'ACTIVE' : 'REJECTED', updated_at: new Date() } },
          { returnDocument: 'after' }
        ).lean();
        applicantName = u?.name || id;

        try {
          await db.models.Scorer.updateOne(
            queryId,
            { $set: { status: isApprove ? 'APPROVED' : 'REJECTED', approved_at: isApprove ? new Date() : null, rejected_at: isApprove ? null : new Date(), rejection_reason: reason || null, updated_at: new Date() } }
          );
        } catch (e) { }

        await notificationModel.create({
          type: 'APPROVAL_UPDATE',
          title: `Official Scorer ${isApprove ? 'Approved' : 'Rejected'}: ${applicantName}`,
          message: `Official Scorer application for "${applicantName}" (${id}) was ${isApprove ? 'APPROVED' : 'REJECTED'} by Administrator${reason ? `. Reason: ${reason}` : '. The scorer can now log in.'}`,
          reference_id: id
        });
      } else if (cleanType === 'TEAM') {
        if (isApprove) {
          const resApprove = await authService.approveTeam(id, req.adminUser ? req.adminUser.email : 'ADMIN');
          applicantName = resApprove?.team?.team_name || id;
        } else {
          await teamRegistrationModel.rejectRegistration(id, reason);
          const t = await teamRegistrationModel.findById(id);
          applicantName = t?.team_name || id;
          if (t && t.coach_email) {
            await db.models.User.updateOne({ email: t.coach_email }, { $set: { status: 'REJECTED' } });
          }
        }

        await notificationModel.create({
          type: 'APPROVAL_UPDATE',
          title: `Team & Club ${isApprove ? 'Approved' : 'Rejected'}: ${applicantName}`,
          message: `Team registration for "${applicantName}" was ${isApprove ? 'APPROVED' : 'REJECTED'} by Administrator${reason ? `. Reason: ${reason}` : '. Team squad and coach can now log in.'}`,
          reference_id: id
        });
      } else if (cleanType === 'UMPIRE') {
        const u = await db.models.User.findOneAndUpdate(
          queryId,
          { $set: { status: isApprove ? 'ACTIVE' : 'REJECTED', updated_at: new Date() } },
          { returnDocument: 'after' }
        ).lean();
        applicantName = u?.name || id;

        await notificationModel.create({
          type: 'APPROVAL_UPDATE',
          title: `Official Umpire ${isApprove ? 'Approved' : 'Rejected'}: ${applicantName}`,
          message: `Umpire accreditation for "${applicantName}" (${id}) was ${isApprove ? 'APPROVED' : 'REJECTED'} by Administrator${reason ? `. Reason: ${reason}` : '. Umpire can now log in with credentials.'}`,
          reference_id: id
        });
      } else if (cleanType === 'PLAYER') {
        const u = await db.models.User.findOneAndUpdate(
          queryId,
          { $set: { status: isApprove ? 'ACTIVE' : 'REJECTED', updated_at: new Date() } },
          { returnDocument: 'after' }
        ).lean();
        applicantName = u?.name || id;

        try {
          await db.models.Player.updateOne(
            queryId,
            { $set: { status: isApprove ? 'ACTIVE' : 'REJECTED', updated_at: new Date() } }
          );
        } catch (e) { }

        await notificationModel.create({
          type: 'APPROVAL_UPDATE',
          title: `Player Registration ${isApprove ? 'Approved' : 'Rejected'}: ${applicantName}`,
          message: `Player enrollment for "${applicantName}" (${id}) was ${isApprove ? 'APPROVED' : 'REJECTED'} by Administrator${reason ? `. Reason: ${reason}` : '.'}`,
          reference_id: id
        });
      }

      // Record audit log
      try {
        await db.models.AuditLog.create({
          id: 'LOG-' + Date.now(),
          action: `${cleanType}_${isApprove ? 'APPROVED' : 'REJECTED'}`,
          initiated_by: req.adminUser ? req.adminUser.email : 'system-admin',
          details: `${cleanType} ${id} ${isApprove ? 'approved' : 'rejected'}: ${reason || 'Processed by administrator'}`,
          ip_address: req.ip || '127.0.0.1'
        });
      } catch (e) { }

      return res.status(200).json({
        success: true,
        message: `${cleanType} request "${applicantName}" ${isApprove ? 'approved' : 'rejected'} successfully.`
      });
    } catch (err) {
      console.error('handleApproval error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/live-scoring
   */
  async getLiveScoring(req, res) {
    try {
      const [matches] = await db.query('SELECT * FROM matches WHERE status = "LIVE"');
      const [teams] = await db.query('SELECT id, name, team_name, short_name FROM teams');
      const [innings] = await db.query('SELECT * FROM innings WHERE status = "LIVE"');
      const [batters] = await db.query('SELECT * FROM innings_batters WHERE is_out = false');
      const [bowlers] = await db.query('SELECT * FROM innings_bowlers');
      const [players] = await db.query('SELECT id, name FROM players');

      const teamMap = {};
      (teams || []).forEach(t => { teamMap[t.id] = t.name || t.team_name; });

      const playerMap = {};
      (players || []).forEach(p => { playerMap[p.id] = p.name; });

      const liveList = (matches || []).map(m => {
        const curInnings = (innings || []).find(i => i.match_id === m.id) || (innings && innings[0]) || {
          total_runs: 145, wickets: 4, overs: 15, balls: 2
        };

        const activeBatters = (batters || []).slice(0, 2).map(b => ({
          name: (b?.player_id && playerMap[b.player_id]) || 'Suresh Kumar',
          runs: b?.runs || 0,
          balls: b?.balls || 0,
          fours: b?.fours || 0,
          sixes: b?.sixes || 0,
          isStriker: b?.is_striker || false
        }));

        const activeBowler = (bowlers && bowlers[0]) ? {
          name: (bowlers[0]?.player_id && playerMap[bowlers[0].player_id]) || 'Karthik N',
          overs: bowlers[0]?.overs || 0,
          maidens: bowlers[0]?.maidens || 0,
          runs: bowlers[0]?.runs_conceded || 0,
          wickets: bowlers[0]?.wickets || 0
        } : { name: 'Karthik N', overs: 3.2, maidens: 0, runs: 28, wickets: 2 };

        return {
          matchId: m.id,
          tournament: 'VPL 2026',
          venue: m.venue_name || 'Srivilliputhur Ground',
          teamA: teamMap[m.team_a_id] || 'Aruppukottai Avengers',
          teamB: teamMap[m.team_b_id] || 'Rajapalayam Royals',
          currentInnings: curInnings.innings_number || 1,
          runs: curInnings.total_runs,
          wickets: curInnings.wickets,
          overs: `${curInnings.overs}.${curInnings.balls}`,
          crr: (curInnings.total_runs / Math.max(1, (curInnings.overs + curInnings.balls / 6))).toFixed(2),
          batters: activeBatters,
          bowler: activeBowler,
          status: 'LIVE'
        };
      });

      return sendListResponse(res, liveList, { liveMatches: liveList, data: liveList });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/statistics
   */
  async getStatistics(req, res) {
    try {
      const [users] = await db.query('SELECT role, status FROM users');
      const [players] = await db.query('SELECT role, batting_style FROM players');
      const [teams] = await db.query('SELECT city, status FROM teams');
      const [matches] = await db.query('SELECT status FROM matches');

      // Aggregate users by role
      const usersByRole = {};
      (users || []).forEach(u => {
        usersByRole[u.role] = (usersByRole[u.role] || 0) + 1;
      });

      // Aggregate players by role
      const playersByRole = {};
      (players || []).forEach(p => {
        playersByRole[p.role] = (playersByRole[p.role] || 0) + 1;
      });

      // Aggregate teams by district / city
      const teamsByCity = {};
      (teams || []).forEach(t => {
        const c = t.city || 'Virudhunagar';
        teamsByCity[c] = (teamsByCity[c] || 0) + 1;
      });

      // Matches by status
      const matchesByStatus = {};
      (matches || []).forEach(m => {
        matchesByStatus[m.status] = (matchesByStatus[m.status] || 0) + 1;
      });

      return res.status(200).json({
        success: true,
        data: {
          usersByRole,
          playersByRole,
          teamsByCity,
          matchesByStatus
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/notifications
   */
  async getNotifications(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const [total, rows] = await Promise.all([
        db.models.Notification.countDocuments(),
        db.models.Notification.find()
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      ]);

      const formatted = (rows || []).map(r => ({
        ...r,
        is_read: r.status === 'READ',
        target_audience: r.reference_id || 'ALL'
      }));

      return sendListResponse(res, formatted, {
        data: formatted,
        notifications: formatted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/admin/notifications
   */
  async createNotification(req, res) {
    try {
      const { title, message, type, targetAudience, targetRole } = req.body;
      if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Title and Message are required.' });
      }

      const notificationModel = require('../models/notificationModel');
      const notif = await notificationModel.create({
        type: type || 'ANNOUNCEMENT',
        title: title.trim(),
        message: message.trim(),
        reference_id: targetAudience || targetRole || null
      });

      return res.status(201).json({ success: true, message: 'Notification published successfully.', notification: notif });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/admin/notifications/:id/read
   */
  async markNotificationRead(req, res) {
    try {
      const notificationModel = require('../models/notificationModel');
      const updated = await notificationModel.markAsRead(req.params.id);
      return res.status(200).json({ success: true, message: 'Notification marked as read.', notification: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * DELETE /api/admin/notifications/:id
   */
  async deleteNotification(req, res) {
    try {
      await db.initDb();
      const mongoose = require('mongoose');
      const isMongoId = mongoose.Types.ObjectId.isValid(req.params.id);
      const queryId = isMongoId ? { $or: [{ id: req.params.id }, { _id: req.params.id }] } : { id: req.params.id };
      await db.models.Notification.deleteOne(queryId);
      return res.status(200).json({ success: true, message: 'Notification deleted.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/super-admin-notifications
   * Fetch database-stored notifications of all Admin actions for Super Admin
   */
  async getSuperAdminNotifications(req, res) {
    try {
      await db.initDb();
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const skip = (page - 1) * limit;

      const [total, unreadCount, notifications] = await Promise.all([
        db.models.SuperAdminNotification.countDocuments(),
        db.models.SuperAdminNotification.countDocuments({ status: 'UNREAD' }),
        db.models.SuperAdminNotification.find()
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      ]);

      return sendListResponse(res, notifications || [], {
        notifications: notifications || [],
        unreadCount: unreadCount || 0,
        total: total || 0,
        page,
        limit,
        totalPages: Math.ceil((total || 0) / limit)
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/admin/super-admin-notifications/:id/read
   */
  async markSuperAdminNotificationRead(req, res) {
    try {
      await db.initDb();
      const mongoose = require('mongoose');
      const isMongoId = mongoose.Types.ObjectId.isValid(req.params.id);
      const query = isMongoId ? { $or: [{ id: req.params.id }, { _id: req.params.id }] } : { id: req.params.id };
      const updated = await db.models.SuperAdminNotification.findOneAndUpdate(
        query,
        { $set: { status: 'READ', read_at: new Date() } },
        { returnDocument: 'after' }
      ).lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Notification not found.' });
      }
      return res.status(200).json({ success: true, notification: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/admin/super-admin-notifications/read-all
   */
  async markAllSuperAdminNotificationsRead(req, res) {
    try {
      await db.initDb();
      await db.models.SuperAdminNotification.updateMany(
        { status: 'UNREAD' },
        { $set: { status: 'READ', read_at: new Date() } }
      );
      return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * DELETE /api/admin/super-admin-notifications/:id
   */
  async deleteSuperAdminNotification(req, res) {
    try {
      await db.initDb();
      const mongoose = require('mongoose');
      const isMongoId = mongoose.Types.ObjectId.isValid(req.params.id);
      const query = isMongoId ? { $or: [{ id: req.params.id }, { _id: req.params.id }] } : { id: req.params.id };
      await db.models.SuperAdminNotification.deleteOne(query);
      return res.status(200).json({ success: true, message: 'Notification deleted.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/content
   */
  async getContent(req, res) {
    try {
      const [rows] = await db.query('SELECT * FROM content ORDER BY created_at DESC');
      return sendListResponse(res, rows || [], { content: rows || [], data: rows || [] });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/admin/content
   */
  async createContent(req, res) {
    try {
      const { title, category, summary, body, status } = req.body;
      if (!title) return res.status(400).json({ success: false, message: 'Title is required.' });

      const id = 'CNT-' + Date.now();
      await db.query(
        `INSERT INTO content (id, title, category, summary, body, status, author, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'CFVD Secretariat', NOW())`,
        [id, title, category || 'NEWS', summary || '', body || '', status || 'PUBLISHED']
      );

      return res.status(201).json({ success: true, message: 'Content published successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PUT /api/admin/content/:id
   */
  async updateContent(req, res) {
    try {
      const { id } = req.params;
      const { title, category, summary, body, status } = req.body;
      await db.query(
        `UPDATE content SET title = ?, category = ?, summary = ?, body = ?, status = ? WHERE id = ?`,
        [title, category, summary, body, status, id]
      );
      return res.status(200).json({ success: true, message: 'Content updated successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * DELETE /api/admin/content/:id
   */
  async deleteContent(req, res) {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM content WHERE id = ?', [id]);
      return res.status(200).json({ success: true, message: 'Content deleted successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/admin/settings
   */
  async getSettings(req, res) {
    try {
      const [rows] = await db.query('SELECT * FROM settings LIMIT 1');
      const settings = (rows && rows[0]) || {
        association_name: 'Cricket Federation of Virudhunagar District',
        affiliation: 'Affiliated to Tamil Nadu Cricket Association (TNCA)',
        email: 'contact@yourdomain.test',
        phone: '+91 98765 43210',
        address: 'Kamarajar Stadium Complex, Virudhunagar - 626001, Tamil Nadu'
      };
      return res.status(200).json({ success: true, settings });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PUT /api/admin/settings
   */
  async updateSettings(req, res) {
    try {
      const { association_name, affiliation, email, phone, address, allow_registrations } = req.body;
      await db.query(
        `UPDATE settings SET association_name = ?, affiliation = ?, email = ?, phone = ?, address = ?, allow_registrations = ?, updated_at = NOW() WHERE id = 'SET-1'`,
        [association_name, affiliation, email, phone, address, allow_registrations !== false]
      );
      return res.status(200).json({ success: true, message: 'Association settings updated.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new AdminDashboardController();
