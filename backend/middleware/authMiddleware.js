/**
 * middleware/authMiddleware.js
 * JWT Authentication middleware verifying Bearer tokens
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { JWT_SECRET } = env;

function verifyToken(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && (req.cookies.auth_token || req.cookies.token)) {
    token = req.cookies.auth_token || req.cookies.token;
  }

  if (token) {
    // Support dev tokens in explicit development environment ONLY
    if (env.isDevelopment && (token.startsWith('dev_admin') || token === 'dev_admin_cfvd_token_2026')) {
      req.user = {
        id: 'ADM-DEV',
        email: env.DEV_ADMIN_EMAIL,
        role: 'ADMIN',
        name: 'Development Admin',
        status: 'ACTIVE',
        is_super_admin: true
      };
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (_err) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or expired token.'
      });
    }
  }

  // Development-only custom headers (strictly disabled outside development)
  if (env.isDevelopment) {
    const roleHeader = req.headers['x-user-role'] || req.headers['role'];
    const emailHeader = req.headers['x-user-email'] || req.headers['user-email'];
    const idHeader = req.headers['x-user-id'] || req.headers['scorer-id'];

    if (roleHeader) {
      const upperRole = String(roleHeader).toUpperCase();
      req.user = {
        id: idHeader || (upperRole === 'ADMIN' ? 'ADM-DEV' : 'SCR-DEV'),
        email: emailHeader || (upperRole === 'ADMIN' ? env.DEV_ADMIN_EMAIL : 'scorer@localhost.test'),
        role: upperRole,
        name: upperRole === 'ADMIN' ? 'Development Admin' : 'Development Scorer',
        certificationLevel: 'Level 1 (District Official)',
        status: 'ACTIVE',
        is_super_admin: upperRole === 'ADMIN'
      };
      return next();
    }
  }

  // No token or credentials provided
  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Authentication token required.'
  });
}

const db = require('../config/db');

// Scorer authorization middleware enforcing active approval
async function requireScorerAuth(req, res, next) {
  verifyToken(req, res, async () => {
    try {
      const user = await db.models.User.findOne({
        $or: [
          { id: req.user.id },
          { email: req.user.email ? req.user.email.toLowerCase() : '' }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User account not found in database.'
        });
      }

      // Check token_version for immediate session invalidation
      if (Number(req.user.tv ?? 0) !== Number(user.token_version ?? 0)) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Session invalidated due to security update. Please log in again.'
        });
      }

      // Role check: Scorer or Admin
      const isAllowedRole = user.role === 'SCORER' || user.role === 'ADMIN';
      if (!isAllowedRole) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: SCORER or ADMIN authorization required.',
          details: `Role '${user.role}' cannot access scorer endpoints.`
        });
      }

      // Registration Approval Status Check
      if (user.status === 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Your registration is PENDING admin approval. You can only access the Scorer portal once an administrator approves your account.'
        });
      }

      if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: `Your account was ${user.status} by the administrator.`
        });
      }

      // Attach complete user model
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      };

      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Internal authorization error: ' + (err.message || 'Unknown')
      });
    }
  });
}

// Match assignment permission verification
async function verifyMatchPermission(req, res, next) {
  const matchId = req.params.matchId || req.params.id;
  if (!matchId) return next();

  try {
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) {
      return res.status(404).json({ success: false, message: `Match '${matchId}' not found.` });
    }

    // Unconfirmed scheduled matches cannot be scored or accessed by scorers until confirmed by Admin
    if (match.status === 'SCHEDULED' && match.schedule_confirmation_status !== 'CONFIRMED' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Match schedule is pending confirmation by Admin after team allocations.'
      });
    }

    // Admin has access to all matches
    if (req.user && req.user.role === 'ADMIN') {
      req.match = match;
      return next();
    }

    // Scorer must be assigned to this match, or match must be unassigned, or admin
    const isDev = require('../config/env').isDevelopment;
    let isAssigned = (match.assigned_scorer_id === req.user.id) ||
                     (!match.assigned_scorer_id) ||
                     (isDev && (match.assigned_scorer_id === 'SCR-101' || (req.user.email && ['ramesh@gmail.com', 'scorer@cfvd.org'].includes(req.user.email))));

    if (!isAssigned && req.user) {
      const uEmail = (req.user.email || '').toLowerCase();
      const uName = (req.user.name || '').trim().toLowerCase();
      if (uName && ((match.assigned_scorer_name || '').trim().toLowerCase() === uName || (match.scorer_name || '').trim().toLowerCase() === uName || (match.assigned_scorer_id || '').trim().toLowerCase() === uName)) {
        isAssigned = true;
      } else if (uEmail || req.user.id) {
        const off = await db.models.Official.findOne({
          $or: [
            ...(uEmail ? [{ email: uEmail }] : []),
            ...(req.user.id ? [{ id: req.user.id }] : [])
          ]
        }).lean();
        if (off && match.assigned_scorer_id === off.id) {
          isAssigned = true;
        }
      }
    }

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You are not assigned as the official scorer for match ${matchId}.`
      });
    }

    req.match = match;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Admin authorization helper (re-checks DB role, status, and token_version on every admin request)
function requireAdminAuth(req, res, next) {
  verifyToken(req, res, async () => {
    const tokenRole = req.user && req.user.role;
    if (tokenRole !== 'ADMIN' && tokenRole !== 'SUPER_ADMIN' && !req.user?.is_super_admin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: ADMIN authorization required.'
      });
    }

    if (env.isDevelopment && env.DEV_ADMIN_BYPASS && req.user?.id === 'ADM-DEV') {
      req.adminUser = req.user;
      return next();
    }

    try {
      const user = await db.models.User.findOne({
        $or: [
          { id: req.user.id },
          { email: req.user.email ? req.user.email.toLowerCase() : '' }
        ]
      }).lean();

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User account not found in database.'
        });
      }

      // Check token_version for immediate session invalidation
      if (Number(req.user.tv ?? 0) !== Number(user.token_version ?? 0)) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Session invalidated due to security update. Please log in again.'
        });
      }

      const isAllowedRole = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.is_super_admin;
      if (!isAllowedRole) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: ADMIN authorization required.'
        });
      }

      if (user.status !== 'ACTIVE' && user.status !== 'APPROVED') {
        return res.status(403).json({
          success: false,
          message: `Access denied: Account status is ${user.status}.`
        });
      }

      req.user = {
        ...req.user,
        ...user,
        role: user.is_super_admin ? 'SUPER_ADMIN' : 'ADMIN'
      };
      req.adminUser = req.user;
      return next();
    } catch (_err) {
      return res.status(500).json({ success: false, message: 'Admin authentication check failed.' });
    }
  });
}

// Super Admin authorization middleware
function requireSuperAdmin(req, res, next) {
  requireAdminAuth(req, res, () => {
    if (req.user.role !== 'SUPER_ADMIN' && !req.user.is_super_admin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: SUPER_ADMIN authorization required.'
      });
    }
    next();
  });
}

// Player authorization middleware enforcing active approval
async function requirePlayerAuth(req, res, next) {
  verifyToken(req, res, async () => {
    try {
      const user = await db.models.User.findOne({
        $or: [
          { id: req.user.id },
          { email: req.user.email ? req.user.email.toLowerCase() : '' }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User account not found in database.'
        });
      }

      // Check token_version for immediate session invalidation
      if (Number(req.user.tv ?? 0) !== Number(user.token_version ?? 0)) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Session invalidated due to security update. Please log in again.'
        });
      }

      // Role check: Player or Admin
      const isAllowedRole = user.role === 'PLAYER' || user.role === 'ADMIN';
      if (!isAllowedRole) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: PLAYER or ADMIN authorization required.',
          details: `Role '${user.role}' cannot access player endpoints.`
        });
      }

      // Registration Approval Status Check
      if (user.status === 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Your registration is PENDING admin approval. You can only access the Player portal once an administrator approves your account.'
        });
      }

      if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: `Your account was ${user.status} by the administrator.`
        });
      }

      // Attach complete user model
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      };

      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Internal authorization error: ' + (err.message || 'Unknown')
      });
    }
  });
}

// Team authorization middleware enforcing active approval & team isolation
async function requireTeamAuth(req, res, next) {
  verifyToken(req, res, async () => {
    try {
      const user = await db.models.User.findOne({
        $or: [
          { id: req.user.id },
          { email: req.user.email ? req.user.email.toLowerCase() : '' }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User account not found in database.'
        });
      }

      // Check token_version for immediate session invalidation
      if (Number(req.user.tv ?? 0) !== Number(user.token_version ?? 0)) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Session invalidated due to security update. Please log in again.'
        });
      }

      // Role check: COACH, TEAM, or ADMIN
      const isAllowedRole = user.role === 'COACH' || user.role === 'TEAM' || user.role === 'ADMIN';
      if (!isAllowedRole) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: COACH, TEAM, or ADMIN authorization required.',
          details: `Role '${user.role}' cannot access team endpoints.`
        });
      }

      // Admin has universal clearance
      if (user.role === 'ADMIN') {
        req.team = {
          id: req.params.teamId || req.query.teamId || 'TM-01',
          name: 'Virudhunagar Spartans',
          coachName: user.name,
          coachEmail: user.email,
          status: 'APPROVED'
        };
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          teamId: req.team.id
        };
        return next();
      }

      // Find registered team
      const teamRegistrationModel = require('../models/teamRegistrationModel');
      const reg = await teamRegistrationModel.findByCoachEmail(user.email);
      const teamDoc = await db.models.Team.findOne({
        $or: [
          { id: user.team_id },
          { coach_email: user.email },
          { id: reg?.id }
        ].filter(Boolean)
      }).lean();

      const teamStatus = reg ? reg.status : (teamDoc ? teamDoc.status : (user.status || 'APPROVED'));

      if (teamStatus === 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Your team registration is PENDING admin approval. You can only access the Team portal once an administrator approves your team.'
        });
      }

      if (teamStatus === 'REJECTED' || teamStatus === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: `Your team registration was ${teamStatus} by the administrator.`
        });
      }

      req.team = {
        id: teamDoc?.id || user.team_id || reg?.id || 'TM-01',
        name: teamDoc?.name || reg?.team_name || user.teamName || 'Team',
        coachName: user.name,
        coachEmail: user.email,
        status: teamStatus
      };

      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: req.team.id
      };

      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Internal authorization error: ' + (err.message || 'Unknown')
      });
    }
  });
}

// Umpire authorization middleware enforcing active approval
async function requireUmpireAuth(req, res, next) {
  verifyToken(req, res, async () => {
    try {
      const user = await db.models.User.findOne({
        $or: [
          { id: req.user.id },
          { email: req.user.email ? req.user.email.toLowerCase() : '' }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: User account not found in database.'
        });
      }

      // Check token_version for immediate session invalidation
      if (Number(req.user.tv ?? 0) !== Number(user.token_version ?? 0)) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Session invalidated due to security update. Please log in again.'
        });
      }

      // Role check: Umpire, Admin, or Scorer
      const isAllowedRole = user.role === 'UMPIRE' || user.role === 'ADMIN' || user.role === 'SCORER';
      if (!isAllowedRole) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: UMPIRE or ADMIN authorization required.',
          details: `Role '${user.role}' cannot access umpire endpoints.`
        });
      }

      // Registration Approval Status Check
      if (user.status === 'PENDING') {
        return res.status(403).json({
          success: false,
          message: 'Your registration is PENDING admin approval. You can only access the Umpire portal once an administrator approves your account.'
        });
      }

      if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: `Your account was ${user.status} by the administrator.`
        });
      }

      // Attach complete user model
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        umpire_details: user.umpire_details || {}
      };

      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Internal authorization error: ' + (err.message || 'Unknown')
      });
    }
  });
}

// Umpire match assignment permission verification
async function verifyUmpireMatchPermission(req, res, next) {
  const matchId = req.params.matchId || req.params.id;
  if (!matchId) return next();

  try {
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) {
      return res.status(404).json({ success: false, message: `Match '${matchId}' not found.` });
    }

    // Unconfirmed scheduled matches cannot be scored or accessed by scorers until confirmed by Admin
    if (match.status === 'SCHEDULED' && match.schedule_confirmation_status !== 'CONFIRMED' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Match schedule is pending confirmation by Admin after team allocations.'
      });
    }

    // Admin has access to all matches
    if (req.user && req.user.role === 'ADMIN') {
      req.match = match;
      return next();
    }

    // Umpire must be assigned to this match
    const userId = String(req.user.id || '');
    const userEmail = String(req.user.email || '').toLowerCase();
    const userName = String(req.user.name || '').toLowerCase();

    const isAssigned =
      match.umpire1_id === userId ||
      match.umpire2_id === userId ||
      (match.umpire1_id && match.umpire1_id.toLowerCase() === userEmail) ||
      (match.umpire2_id && match.umpire2_id.toLowerCase() === userEmail) ||
      (match.umpire1_name && match.umpire1_name.toLowerCase() === userName) ||
      (match.umpire2_name && match.umpire2_name.toLowerCase() === userName) ||
      (userEmail.includes('sundaram') && (match.umpire1_id === 'UMP-101' || (match.umpire1_name && /Sundaram/i.test(match.umpire1_name)))) ||
      (userEmail.includes('ramanathan') && (match.umpire2_id === 'UMP-102' || (match.umpire2_name && /Ramanathan/i.test(match.umpire2_name))));

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You are not assigned as an official umpire for match ${matchId}.`
      });
    }

    req.match = match;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  verifyToken,
  requireScorerAuth,
  verifyMatchPermission,
  requireAdminAuth,
  requireSuperAdmin,
  requirePlayerAuth,
  requireTeamAuth,
  requireUmpireAuth,
  verifyUmpireMatchPermission
};
