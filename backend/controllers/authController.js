/**
 * controllers/authController.js
 * Controller for Email OTP Registration Verification, Password Set,
 * and Password Authentication with JWT HTTP Cookie support.
 */

const authService = require('../services/authService');
const { sendListResponse } = require('../utils/responseHelper');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
};

const REMEMBER_DEVICE_COOKIE = 'remember_device';
const REMEMBER_DEVICE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in ms
};

function setAuthCookies(res, token) {
  if (token) {
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    res.cookie('token', token, COOKIE_OPTIONS);
  }
}

function clearAuthCookies(res) {
  res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax' });
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
}

function setRememberDeviceCookie(res, user) {
  if (!user || !user.id || !user.email) return;
  const roleUpper = String(user.role || '').toUpperCase();
  if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') return; // OTP mandatory for admin login
  const jwt = require('jsonwebtoken');
  const env = require('../config/env');
  const deviceToken = jwt.sign(
    {
      purpose: 'remember_device',
      userId: user.id,
      email: String(user.email).trim().toLowerCase(),
      tokenVersion: user.token_version ?? 0
    },
    env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.cookie(REMEMBER_DEVICE_COOKIE, deviceToken, REMEMBER_DEVICE_OPTIONS);
}

async function verifyRememberDeviceCookie(req, cleanEmail) {
  const raw = req.cookies?.[REMEMBER_DEVICE_COOKIE];
  if (!raw || !cleanEmail) return null;
  try {
    const jwt = require('jsonwebtoken');
    const env = require('../config/env');
    const decoded = jwt.verify(raw, env.JWT_SECRET);
    if (!decoded || decoded.purpose !== 'remember_device') return null;
    if (String(decoded.email || '').toLowerCase() !== cleanEmail) return null;

    const db = require('../config/db');
    await db.initDb();
    const user = await db.models.User.findOne({ email: cleanEmail })
      .select('id name email role status token_version')
      .lean();
    if (!user) return null;
    const roleUpper = String(user.role || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') return null;
    if (user.status !== 'ACTIVE' && user.status !== 'APPROVED') return null;
    if ((user.token_version ?? 0) !== (decoded.tokenVersion ?? 0)) return null;

    const sessionToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tokenVersion: user.token_version ?? 0
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return { user, token: sessionToken };
  } catch (_e) {
    return null;
  }
}

class AuthController {
  // Step 1 of Registration: Request OTP to verify email
  async requestRegistrationOtp(req, res) {
    try {
      const { email, name, role, teamName } = req.body;
      const result = await authService.requestRegistrationOtp(email, name, role, teamName);
      res.status(200).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Failed to request registration OTP'
      });
    }
  }

  // Pre-Registration check if Team, Player, Scorer, Umpire or User already exists
  async checkRegistrationExists(req, res) {
    try {
      const { role, email, name, teamName } = req.body;
      const result = await authService.checkRegistrationExists({ role, email, name, teamName });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({
        success: false,
        message: err.message || 'Failed to check registration existence'
      });
    }
  }

  // Pre-Registration check if Team Name or Coach Email already exists
  async checkTeamExists(req, res) {
    try {
      const { teamName, coachEmail, email } = req.body;
      const targetEmail = coachEmail || email;
      const result = await authService.checkRegistrationExists({ role: 'TEAM', teamName, email: targetEmail });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({
        success: false,
        message: err.message || 'Failed to check team existence'
      });
    }
  }

  // Step 2 of Registration: Verify OTP code
  async verifyRegistrationOtp(req, res) {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyRegistrationOtp(email, otp);
      res.status(200).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Registration OTP verification failed'
      });
    }
  }

  async requestForgotPasswordOtp(req, res) {
    try {
      const { email, role } = req.body;
      const result = await authService.requestForgotPasswordOtp(email, role);
      res.status(200).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        notRegistered: !!err.notRegistered,
        message: err.message || 'Failed to send password reset OTP'
      });
    }
  }

  // Step 2: Verify 4-digit OTP for Forgot Password
  async verifyForgotPasswordOtp(req, res) {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyForgotPasswordOtp(email, otp);
      res.status(200).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'OTP verification failed'
      });
    }
  }

  // Step 3: Reset & Encrypt Password
  async resetPasswordWithOtp(req, res) {
    try {
      const { email, otp, newPassword, confirmPassword } = req.body;
      if (confirmPassword && newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirm password do not match.'
        });
      }
      const result = await authService.resetPasswordWithOtp(email, otp, newPassword);
      res.status(200).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Failed to reset password'
      });
    }
  }

  // Unified Password-Based Login (Sets JWT Cookie)
  async login(req, res) {
    try {
      const { email, emailOrPhone, name, username, password, otp, role, teamName, identifier: bodyId, rememberDevice } = req.body;
      const identifier = email || emailOrPhone || username || name || bodyId;
      const credential = password || otp;
      const result = await authService.login(identifier, credential, role, teamName);
      if (result.token) {
        setAuthCookies(res, result.token);
      }
      if (rememberDevice === true && result.user) {
        setRememberDeviceCookie(res, result.user);
      }
      res.status(200).json(result);
    } catch (err) {
      const status = err.status || 401;
      res.status(status).json({
        success: false,
        message: err.message || 'Login failed'
      });
    }
  }

  // Admin Direct Login (Sets JWT Cookie)
  async adminLogin(req, res) {
    try {
      const { email, password, otp } = req.body;
      const result = await authService.adminLogin(email, password || otp);
      if (result.token) {
        setAuthCookies(res, result.token);
      }
      res.status(200).json(result);
    } catch (err) {
      const status = err.status || 401;
      res.status(status).json({
        success: false,
        message: err.message || 'Administrator login failed'
      });
    }
  }

  // Logout (Clears JWT Cookie)
  async logout(req, res) {
    try {
      clearAuthCookies(res);
      let userInfo = req.user;
      if (!userInfo) {
        const authHeader = req.headers['authorization'];
        const rawTok = (authHeader && authHeader.startsWith('Bearer '))
          ? authHeader.substring(7).trim()
          : (req.cookies?.auth_token || req.cookies?.token || null);
        if (rawTok) {
          try {
            const jwt = require('jsonwebtoken');
            userInfo = jwt.verify(rawTok, require('../config/env').JWT_SECRET);
          } catch (_e) {}
        }
      }
      if (userInfo && (userInfo.id || userInfo.email)) {
        try {
          const db = require('../config/db');
          await db.initDb();
          await db.models.User.updateOne(
            { $or: [{ id: userInfo.id }, { email: userInfo.email }] },
            { $inc: { token_version: 1 } }
          );
        } catch (_e) { }
      }
      res.status(200).json({
        success: true,
        message: 'Logged out successfully. Cookie cleared and session revoked.'
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Logout failed: ' + (err.message || 'Unknown error')
      });
    }
  }

  // Current authenticated user
  async getMe(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
      }
      let profile = null;
      if (req.user.id) {
        try {
          profile = await authService.getProfile(req.user.id);
        } catch (_e) {}
      }
      const certLevel =
        profile?.certificationLevel ||
        profile?.scorer_details?.certification_level ||
        profile?.scorer_details?.certificationLevel ||
        req.user.certificationLevel ||
        (req.user.role === 'SCORER' ? 'District Certified' : undefined);

      const userData = {
        ...req.user,
        ...(profile ? (typeof profile.toObject === 'function' ? profile.toObject() : profile) : {}),
        certificationLevel: certLevel
      };

      res.status(200).json({
        success: true,
        user: userData
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Scorer & OTP Login
  async requestOtp(req, res) {
    try {
      const { email, role } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();
      const roleUpper = String(role || '').toUpperCase();
      if (roleUpper !== 'ADMIN' && roleUpper !== 'SUPER_ADMIN') {
        const trusted = await verifyRememberDeviceCookie(req, cleanEmail);
        if (trusted) {
          setAuthCookies(res, trusted.token);
          return res.status(200).json({
            success: true,
            otpBypassed: true,
            trustedDevice: true,
            token: trusted.token,
            user: trusted.user,
            message: 'Trusted device verified. Signed in without OTP.'
          });
        }
      }
      if (role === 'SCORER') {
        const result = await authService.requestScorerOtp(cleanEmail);
        return res.status(200).json(result);
      }
      const result = await authService.requestOtp(cleanEmail);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.status || 400;
      return res.status(status).json({
        success: false,
        message: err.message,
        notFound: err.notFound,
        scorerStatus: err.scorerStatus
      });
    }
  }

  async verifyOtp(req, res) {
    try {
      const { email, otp, role, rememberDevice } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();
      let result;
      if (role === 'SCORER') {
        result = await authService.verifyScorerOtp(cleanEmail, otp);
      } else {
        result = await authService.verifyOtp(cleanEmail, otp);
      }
      if (result && result.token) {
        setAuthCookies(res, result.token);
      }
      if (rememberDevice === true && result && result.user) {
        setRememberDeviceCookie(res, result.user);
      }
      return res.status(200).json(result);
    } catch (err) {
      const status = err.status || 401;
      return res.status(status).json({ success: false, message: err.message });
    }
  }

  async requestTeamOtp(req, res) {
    return this.requestRegistrationOtp(req, res);
  }

  async verifyTeamOtp(req, res) {
    return this.login(req, res);
  }

  async requestPlayerOtp(req, res) {
    return this.requestRegistrationOtp(req, res);
  }

  async verifyPlayerOtp(req, res) {
    return this.login(req, res);
  }

  // Check if an email belongs to an already-registered Player (used by Team Registration)
  async checkPlayerEmail(req, res) {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ registered: false, message: 'Please enter a valid player email address.' });
      }
      const db = require('../config/db');
      await db.initDb();
      const userDoc = await db.models.User.findOne({
        email: cleanEmail,
        role: 'PLAYER',
        status: { $ne: 'DELETED' }
      }).select('id name email mobile aadhaar player_details').lean();

      if (userDoc) {
        return res.status(200).json({
          registered: true,
          player: {
            id: userDoc.id,
            name: userDoc.name,
            email: userDoc.email,
            phone: userDoc.mobile || userDoc.player_details?.phone || '',
            aadhaar: userDoc.aadhaar || userDoc.player_details?.aadhaar || '',
            role: userDoc.player_details?.role || 'Batter'
          }
        });
      }

      const playerDoc = await db.models.Player.findOne({ email: cleanEmail })
        .select('id name email phone mobile aadhaar role')
        .lean();
      if (playerDoc) {
        return res.status(200).json({
          registered: true,
          player: {
            id: playerDoc.id,
            name: playerDoc.name,
            email: playerDoc.email,
            phone: playerDoc.phone || playerDoc.mobile || '',
            aadhaar: playerDoc.aadhaar || '',
            role: playerDoc.role || 'Batter'
          }
        });
      }

      return res.status(200).json({
        registered: false,
        message: 'This email is not registered as a Player yet. Please complete Player Registration first.'
      });
    } catch (err) {
      return res.status(500).json({ registered: false, message: err.message || 'Failed to verify player email.' });
    }
  }

  // Find Player Team by Email & Send to Player's Email
  async findPlayerTeam(req, res) {
    try {
      const { email } = req.body;
      const result = await authService.findPlayerTeam(email);
      res.status(200).json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({
        success: false,
        message: err.message || 'Failed to find player team.'
      });
    }
  }

  // Unified Register Endpoint
  async register(req, res) {
    try {
      const result = await authService.register(req.body);
      if (result.token) {
        setAuthCookies(res, result.token);
      }
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Registration failed'
      });
    }
  }

  // Register Scorer
  async registerScorer(req, res) {
    try {
      const result = await authService.registerScorer(req.body);
      if (result.token) {
        setAuthCookies(res, result.token);
      }
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Scorer registration failed'
      });
    }
  }

  // Register Umpire
  async registerUmpire(req, res) {
    try {
      const result = await authService.registerUmpire(req.body);
      if (result.token) {
        setAuthCookies(res, result.token);
      }
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Umpire registration failed'
      });
    }
  }

  // Register Player
  async registerPlayer(req, res) {
    try {
      const result = await authService.registerPlayer(req.body);
      if (result.token) {
        setAuthCookies(res, result.token);
      }
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Player registration failed'
      });
    }
  }

  // Register Team
  async registerTeam(req, res) {
    try {
      const result = await authService.registerTeam(req.body);
      if (result.token) {
        setAuthCookies(res, result.token);
      }
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Team registration failed'
      });
    }
  }

  // Register Content Staff
  async registerContentStaff(req, res) {
    try {
      const result = await authService.registerContentStaff(req.body);
      if (result.token) {
        setAuthCookies(res, result.token);
      }
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 400;
      res.status(status).json({
        success: false,
        message: err.message || 'Content Staff registration failed'
      });
    }
  }

  async getTeams(req, res) {
    try {
      const teams = await authService.getTeams();
      return sendListResponse(res, teams, { teams, data: teams });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async approveTeam(req, res) {
    try {
      const result = await authService.approveTeam(req.params.id || req.body.id);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async rejectTeam(req, res) {
    try {
      const result = await authService.rejectTeam(req.params.id || req.body.id, req.body.reason);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async getAllRegistrations(req, res) {
    try {
      const { status, role } = req.query || {};
      const result = await authService.getAllRegistrations(status, role);
      return sendListResponse(res, result || [], { registrations: result || [], data: result || [] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getAdminNotifications(req, res) {
    try {
      const notifs = await authService.getAdminNotifications();
      return sendListResponse(res, notifs || [], { notifications: notifs || [], data: notifs || [] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateScorerStatus(req, res) {
    try {
      const result = await authService.updateScorerStatus(req.params.id || req.body.id, req.body.status);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async updateUmpireStatus(req, res) {
    try {
      const result = await authService.updateUmpireStatus(req.params.id || req.body.id, req.body.status, req.body.reason);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async approveRegistration(req, res) {
    try {
      const { id, type } = req.body;
      const targetId = id || req.params.id;
      const adminId = req.user?.email || 'ADMIN';
      const result = await authService.approveRegistration(targetId, type || 'UMPIRE', adminId);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async rejectRegistration(req, res) {
    try {
      const { id, type, reason } = req.body;
      const targetId = id || req.params.id;
      const adminId = req.user?.email || 'ADMIN';
      const result = await authService.rejectRegistration(targetId, type || 'UMPIRE', reason || 'Criteria not met', adminId);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async deleteRegistration(req, res) {
    try {
      const { id, type } = req.body;
      const targetId = id || req.params.id;
      const adminId = req.user?.email || 'ADMIN';
      const result = await authService.deleteRegistration(targetId, type || 'TEAM', adminId);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async restoreRegistration(req, res) {
    try {
      const { id, type } = req.body;
      const targetId = id || req.params.id;
      const adminId = req.user?.email || 'ADMIN';
      const result = await authService.restoreRegistration(targetId, type || 'TEAM', adminId);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

const authController = new AuthController();
authController.setAuthCookies = setAuthCookies;
authController.clearAuthCookies = clearAuthCookies;
module.exports = authController;