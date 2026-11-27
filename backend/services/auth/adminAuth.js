/**
 * services/auth/adminAuth.js
 * Handles Admin authentication, general user login, registration review, and profile queries.
 */

const jwt = require('jsonwebtoken');
const userModel = require('../../models/userModel');
const teamRegistrationModel = require('../../models/teamRegistrationModel');
const notificationModel = require('../../models/notificationModel');
const otpService = require('../otpService');
const { sendOtpEmail } = require('../../config/mailer');
const db = require('../../config/db');

const { JWT_SECRET } = require('../../config/env');

class AdminAuth {
  /**
   * Request OTP for email login (Admins, Scorers, Umpires, Coaches)
   */
  async requestOtp(email, roleRequired = null) {
    if (!email || typeof email !== 'string') {
      throw { status: 400, message: 'Please provide a valid email address.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw { status: 400, message: 'Invalid email address format.' };
    }

    const user = await userModel.findByEmail(cleanEmail);

    if (!user) {
      return {
        success: true,
        message: 'If an eligible account exists for this email, a verification OTP has been dispatched.'
      };
    }

    const isScorerAccessAllowed = roleRequired === 'SCORER' && (user.role === 'SCORER' || user.role === 'ADMIN' || user.role === 'COACH');
    if (roleRequired && user.role !== roleRequired && user.role !== 'ADMIN' && !isScorerAccessAllowed) {
      throw { status: 403, message: `Access restricted. Your account is registered as ${user.role}, not ${roleRequired}.` };
    }

    if (user.status === 'PENDING') {
      throw {
        status: 403,
        message: 'Your registration is PENDING admin approval. You can only log in once an administrator approves your account.'
      };
    }
    if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
      throw {
        status: 403,
        message: `Your account is ${user.status} by the administrator.`
      };
    }

    const rateCheck = otpService.checkRateLimit(cleanEmail);
    if (!rateCheck.allowed) {
      throw { status: 429, message: rateCheck.message };
    }

    const rawOtp = otpService.generateOtpCode();
    const otpHash = otpService.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + otpService.OTP_EXPIRATION_MS);

    await userModel.updateOtp(user.id, {
      otp_hash: otpHash,
      otp_expires_at: expiresAt
    });

    const mailResult = await sendOtpEmail({
      toEmail: user.email,
      userName: user.name,
      otp: rawOtp
    });

    if (mailResult && !mailResult.success && mailResult.smtpError) {
      console.warn(`⚠️ [SMTP DELIVERY WARNING] Could not send OTP email to ${user.email}: ${mailResult.smtpError}`);
      const env = require('../../config/env');
      if (!env.isDevelopment) {
        throw { status: 500, message: 'Failed to dispatch OTP email. Please try again in a few moments.' };
      }
      return {
        success: true,
        message: 'OTP generated (development mode email fallback).',
        email: user.email,
        otp: rawOtp,
        devOtp: rawOtp,
        smtpError: mailResult.smtpError
      };
    }

    return {
      success: true,
      message: `OTP sent successfully to ${user.email} via Nodemailer.`,
      email: user.email
    };
  }

  /**
   * Verify OTP and return session token
   */
  async verifyOtp(email, otp) {
    if (!email || !otp) {
      throw { status: 400, message: 'Email address and OTP are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const env = require('../../config/env');
    if (
      env.isDevelopment &&
      env.DEV_ADMIN_BYPASS &&
      cleanEmail === env.DEV_ADMIN_EMAIL &&
      env.DEV_ADMIN_OTP &&
      cleanOtp === env.DEV_ADMIN_OTP
    ) {
      const adminUser = await userModel.findByEmail(cleanEmail);
      const token = jwt.sign(
        { id: adminUser?.id || 'ADM-DEV', name: adminUser?.name || 'Administrator', email: cleanEmail, role: 'ADMIN', tv: adminUser?.token_version || 0 },
        JWT_SECRET,
        { expiresIn: '12h' }
      );
      return {
        success: true,
        message: 'Admin bypass authenticated successfully.',
        user: { id: adminUser?.id || 'ADM-DEV', name: adminUser?.name || 'Administrator', email: cleanEmail, role: 'ADMIN' },
        token
      };
    }

    const user = await userModel.findByEmail(cleanEmail);
    if (!user) {
      throw { status: 401, message: 'Invalid or expired OTP code.' };
    }

    const attempts = Number(user.otp_attempts || 0);
    if (attempts >= 5) {
      await db.models.User.updateOne({ email: cleanEmail }, { $set: { otp_hash: null, otp_expires_at: null } });
      throw { status: 429, message: 'Too many invalid OTP attempts. Please request a new OTP.' };
    }

    const isOtpValid = user.otp_hash ? otpService.verifyOtpCode(cleanOtp, user.otp_hash) : false;
    const isNotExpired = user.otp_expires_at && new Date() < new Date(user.otp_expires_at);

    if (!isOtpValid || !isNotExpired) {
      const nextAttempts = attempts + 1;
      const update = { otp_attempts: nextAttempts };
      if (nextAttempts >= 5) {
        update.otp_hash = null;
        update.otp_expires_at = null;
      }
      await db.models.User.updateOne({ email: cleanEmail }, { $set: update });
      throw { status: 401, message: 'Invalid or expired OTP code.' };
    }

    if (user.status === 'PENDING') {
      let pendingTeamName = null;
      if ((user.role || '').toUpperCase() === 'PLAYER') {
        try {
          const regs = await db.models.TeamRegistration.find({}).lean();
          for (const reg of regs) {
            const found = (reg.players || []).find(p => p.email?.toLowerCase() === cleanEmail);
            if (found) { pendingTeamName = reg.team_name; break; }
          }
        } catch (_e) { }
      }
      throw {
        status: 403,
        pendingApproval: true,
        teamName: pendingTeamName,
        message: pendingTeamName
          ? `⏳ Team "${pendingTeamName}" is pending admin approval. Players can only login after the admin approves the team.`
          : 'Your registration is PENDING admin approval. You can only log in once an administrator approves your account.'
      };
    }
    if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
      throw { status: 403, message: `Your account was ${user.status} by the administrator.` };
    }

    await userModel.markOtpVerified(user.id || user.email);

    const token = jwt.sign(
      { id: user.id || user.email, name: user.name, email: user.email, role: user.role, tv: user.token_version || 0 },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return {
      success: true,
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      },
      token
    };
  }

  /**
   * Admin Login with Password
   */
  async adminLogin(email, password) {
    if (!email || !password) {
      throw { status: 400, message: 'Admin email and password are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = String(password).trim();

    await db.initDb();

    const user = await userModel.findByEmail(cleanEmail);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      throw { status: 401, message: 'Invalid administrator credentials.' };
    }
    if (user.status && user.status.toUpperCase() !== 'ACTIVE') {
      throw { status: 403, message: `Administrator account is ${user.status}. Access denied.` };
    }

    const bcrypt = require('bcryptjs');
    let isPasswordValid = false;
    if (user.password_hash) {
      try {
        isPasswordValid = await bcrypt.compare(cleanPass, user.password_hash);
      } catch (_e) {
        isPasswordValid = false;
      }
    }

    if (!isPasswordValid) {
      throw { status: 401, message: 'Invalid administrator credentials.' };
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: 'ADMIN', tv: user.token_version || 0 },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    try {
      const adminService = require('../adminService');
      await adminService.addAuditLog({
        action: 'ADMIN_LOGIN',
        initiated_by: user.email,
        target_user: user.email,
        result: 'SUCCESS',
        details: `Administrator logged into management console.`
      });
    } catch (e) { }

    return {
      success: true,
      message: 'Administrator authentication successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'ADMIN'
      },
      token
    };
  }

  /**
   * Universal Login
   */
  async login(identifier, passwordOrOtp, roleRequired = null, teamName = null, playerLoginFn = null) {
    if (!identifier) {
      throw { status: 400, message: 'Email or name and password/OTP are required.' };
    }

    if (roleRequired === 'PLAYER' && playerLoginFn) {
      return playerLoginFn(identifier, teamName || '');
    }

    if (!passwordOrOtp) {
      throw { status: 400, message: 'Email or name and password/OTP are required.' };
    }
    const cleanId = String(identifier).trim();
    const cleanEmail = cleanId.toLowerCase();
    const cleanCredential = String(passwordOrOtp).trim();

    await db.initDb();

    let user = await userModel.findByEmail(cleanEmail);
    if (!user) {
      user = await db.models.User.findOne({
        $or: [
          { email: cleanEmail },
          { name: { $regex: new RegExp(`^${cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { id: cleanId }
        ]
      }).lean();
    }

    if (!user) {
      throw { status: 401, message: 'Invalid credentials.' };
    }

    // Role check
    if (roleRequired && user.role !== roleRequired && user.role !== 'ADMIN') {
      const allowedRoles = [roleRequired];
      if (roleRequired === 'COACH') allowedRoles.push('TEAM');
      if (roleRequired === 'TEAM') allowedRoles.push('COACH');
      if (roleRequired === 'SCORER') allowedRoles.push('COACH');
      if (!allowedRoles.includes(user.role)) {
        throw { status: 403, message: `Access restricted. Your account is registered as ${user.role}, not ${roleRequired}.` };
      }
    }

    // Status check
    if (user.status === 'PENDING') {
      let pendingTeam = null;
      if ((user.role || '').toUpperCase() === 'PLAYER') {
        try {
          const regs = await db.models.TeamRegistration.find({}).lean();
          for (const reg of regs) {
            const found = (reg.players || []).find(p => p.email?.toLowerCase() === cleanEmail);
            if (found) { pendingTeam = reg.team_name; break; }
          }
        } catch (_e) { }
      }
      throw {
        status: 403,
        pendingApproval: true,
        teamName: pendingTeam,
        message: pendingTeam
          ? `⏳ Team "${pendingTeam}" is pending admin approval. Players can only login after the admin approves the team.`
          : 'Your account registration is PENDING admin approval. Please wait for an administrator to activate your account.'
      };
    }
    if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
      throw { status: 403, message: `Your account was ${user.status} by the administrator.` };
    }

    // Password / OTP verification
    const bcrypt = require('bcryptjs');
    let isCredentialValid = false;

    if (user.otp_hash && otpService.verifyOtpCode(cleanCredential, user.otp_hash)) {
      const notExpired = user.otp_expires_at && new Date() < new Date(user.otp_expires_at);
      if (notExpired) isCredentialValid = true;
    }

    if (!isCredentialValid && user.password_hash) {
      try {
        isCredentialValid = await bcrypt.compare(cleanCredential, user.password_hash);
      } catch (_e) { }
    }

    if (!isCredentialValid) {
      throw { status: 401, message: 'Invalid password or verification code.' };
    }

    const token = jwt.sign(
      { id: user.id || user.email, name: user.name, email: user.email, role: user.role, team_id: user.team_id, tv: user.token_version || 0 },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return {
      success: true,
      message: `Welcome, ${user.name}! Login successful.`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        team_id: user.team_id
      },
      token
    };
  }

  async registerContentStaff({ name, email, mobile, specialization, credentials }) {
    if (!name || !email) {
      throw { status: 400, message: 'Name and email are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await userModel.findByEmail(cleanEmail);
    if (existing) {
      throw { status: 409, message: 'An account with this email address already exists.' };
    }

    const staffId = `CNT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const user = await userModel.create({
      id: staffId,
      name: name.trim(),
      email: cleanEmail,
      mobile: mobile || null,
      role: 'CONTENT',
      status: 'PENDING'
    });

    await notificationModel.create({
      type: 'CONTENT_STAFF_REGISTRATION',
      title: `New Content Staff Registration: ${name.trim()}`,
      message: `Content Staff ${name.trim()} (${cleanEmail}) applied. Specialization: ${specialization || 'General Media'}. Awaiting administrative approval.`,
      reference_id: staffId,
      status: 'UNREAD'
    });

    return {
      success: true,
      status: 'PENDING',
      message: 'Content Staff registration submitted! Awaiting administrative verification.',
      staff: {
        id: staffId,
        name: user.name,
        email: user.email,
        role: 'CONTENT',
        status: 'PENDING'
      }
    };
  }

  async checkRegistrationExists({ role, email, name, teamName } = {}) {
    await db.initDb();
    const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (role === 'TEAM' || teamName) {
      const cleanTeamName = String(teamName || '').trim();
      const cleanCoachEmail = String(email || '').trim().toLowerCase();

      if (cleanTeamName) {
        const nameRegex = new RegExp('^' + escapeRegex(cleanTeamName) + '$', 'i');

        const existingReg = await teamRegistrationModel.Model.findOne({
          team_name: nameRegex,
          status: { $ne: 'REJECTED' }
        }).lean();

        if (existingReg) {
          return {
            exists: true,
            type: 'TEAM',
            field: 'teamName',
            message: `Team "${cleanTeamName}" is already registered (Status: ${existingReg.status || 'PENDING'}). Please login directly.`
          };
        }

        if (db.models && db.models.Team) {
          const existingTeam = await db.models.Team.findOne({
            $or: [{ name: nameRegex }, { team_name: nameRegex }]
          }).lean();

          if (existingTeam) {
            return {
              exists: true,
              type: 'TEAM',
              field: 'teamName',
              message: `Team "${cleanTeamName}" is already registered with the Association. Please login directly.`
            };
          }
        }

        if (db.models && db.models.User) {
          const existingUserTeam = await db.models.User.findOne({
            team_name: nameRegex,
            status: { $ne: 'REJECTED' }
          }).lean();

          if (existingUserTeam) {
            return {
              exists: true,
              type: 'TEAM',
              field: 'teamName',
              message: `Team "${cleanTeamName}" is already registered with the Association. Please login directly.`
            };
          }
        }
      }

      if (cleanCoachEmail) {
        const existingCoachReg = await teamRegistrationModel.Model.findOne({
          coach_email: cleanCoachEmail,
          status: { $ne: 'REJECTED' }
        }).lean();

        if (existingCoachReg) {
          return {
            exists: true,
            type: 'TEAM',
            field: 'coachEmail',
            message: `Coach email "${cleanCoachEmail}" is already registered for team "${existingCoachReg.team_name}". Please login directly.`
          };
        }

        if (db.models && db.models.Team) {
          const existingTeamCoach = await db.models.Team.findOne({
            coach_email: cleanCoachEmail
          }).lean();

          if (existingTeamCoach) {
            return {
              exists: true,
              type: 'TEAM',
              field: 'coachEmail',
              message: `Coach email "${cleanCoachEmail}" is already registered for team "${existingTeamCoach.team_name || existingTeamCoach.name}". Please login directly.`
            };
          }
        }

        if (db.models && db.models.User) {
          const existingCoachUser = await db.models.User.findOne({
            email: cleanCoachEmail,
            role: { $in: ['COACH', 'TEAM'] },
            status: { $ne: 'REJECTED' }
          }).lean();

          if (existingCoachUser) {
            return {
              exists: true,
              type: 'TEAM',
              field: 'coachEmail',
              message: `Coach email "${cleanCoachEmail}" is already registered. Please login directly.`
            };
          }
        }
      }
    }

    if (email && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();

      if (db.models && db.models.User) {
        const existingUser = await db.models.User.findOne({
          email: cleanEmail,
          status: { $ne: 'REJECTED' }
        }).lean();

        if (existingUser) {
          const roleLabel = existingUser.role === 'COACH' ? 'Team Coach' : (existingUser.role || role || 'User');
          return {
            exists: true,
            type: existingUser.role,
            field: 'email',
            message: `An account with email "${cleanEmail}" is already registered as ${roleLabel}. Please login directly.`
          };
        }
      }

      if (role === 'PLAYER' && db.models && db.models.Player) {
        const existingPlayer = await db.models.Player.findOne({ email: cleanEmail }).lean();
        if (existingPlayer) {
          return {
            exists: true,
            type: 'PLAYER',
            field: 'email',
            message: `Player with email "${cleanEmail}" is already registered in the district player directory. Please login directly.`
          };
        }
      }

      if (role === 'SCORER' && db.models && db.models.Scorer) {
        const existingScorer = await db.models.Scorer.findOne({ email: cleanEmail }).lean();
        if (existingScorer) {
          return {
            exists: true,
            type: 'SCORER',
            field: 'email',
            message: `Scorer with email "${cleanEmail}" is already registered. Please login directly.`
          };
        }
      }

      if (role === 'UMPIRE' && db.models && db.models.Official) {
        const existingOfficial = await db.models.Official.findOne({ email: cleanEmail }).lean();
        if (existingOfficial) {
          return {
            exists: true,
            type: 'UMPIRE',
            field: 'email',
            message: `Umpire with email "${cleanEmail}" is already registered in the officials directory. Please login directly.`
          };
        }
      }

      if (role === 'PLAYER') {
        const regWithPlayer = await teamRegistrationModel.Model.findOne({
          'players.email': cleanEmail,
          status: { $ne: 'REJECTED' }
        }).lean();

        if (regWithPlayer) {
          return {
            exists: true,
            type: 'PLAYER',
            field: 'email',
            message: `Player email "${cleanEmail}" is already enrolled in squad of team "${regWithPlayer.team_name}". Please login directly.`
          };
        }
      }
    }

    return { exists: false };
  }

  async checkTeamExists(teamName, coachEmail) {
    return this.checkRegistrationExists({ role: 'TEAM', teamName, email: coachEmail });
  }

  async getTeams(status = null) {
    return teamRegistrationModel.getAll(status);
  }

  async getAdminNotifications(status = null) {
    return notificationModel.getAll({ status });
  }

  async getProfile(userId) {
    const user = await userModel.findById(userId);
    if (!user) throw { status: 404, message: 'User profile not found.' };
    return user;
  }

  async getAllRegistrations(filterStatus = null, filterRole = null) {
    await db.initDb();
    const results = [];

    // 1. Teams
    if (!filterRole || filterRole.toUpperCase() === 'TEAM' || filterRole.toUpperCase() === 'TEAMS') {
      const teams = await teamRegistrationModel.getAll();
      teams.forEach(t => {
        const status = (t.status || 'PENDING').toUpperCase();
        if (status === 'DELETED') return;
        if (filterStatus && filterStatus !== 'ALL' && status !== filterStatus.toUpperCase()) {
          return;
        }
        const cPhone = t.coach_phone || t.coach_mobile || t.phone || t.mobile || 'N/A';
        const cAadhaar = t.coach_aadhaar || t.aadhaar || 'N/A';
        results.push({
          id: t.id || t._id?.toString(),
          mongoId: t._id?.toString(),
          type: 'TEAM',
          roleDisplay: 'Cricket Team & Squad',
          name: t.team_name,
          email: t.coach_email,
          contactName: t.coach_name,
          contactEmail: t.coach_email,
          phone: cPhone,
          coachPhone: cPhone,
          aadhaar: cAadhaar,
          coachAadhaar: cAadhaar,
          taluk: t.taluk || t.city || 'Virudhunagar',
          status: status,
          created_at: t.created_at || new Date().toISOString(),
          details: {
            coachPhone: cPhone,
            coachAadhaar: cAadhaar,
            squadCount: (t.players || []).length,
            players: (t.players || []).map(p => ({
              ...p,
              phone: p.phone || p.mobile || '-',
              mobile: p.mobile || p.phone || '-',
              aadhaar: p.aadhaar || '-'
            })),
            taluk: t.taluk,
            city: t.city,
            rejectionReason: t.rejection_reason,
            approvedBy: t.approved_by,
            approvedAt: t.approved_at
          }
        });
      });
    }

    // 2. Individual Users (Players, Scorers, Umpires, Content Staff)
    const roleQuery = {};
    if (filterRole && filterRole.toUpperCase() !== 'TEAM' && filterRole.toUpperCase() !== 'TEAMS') {
      const r = filterRole.toUpperCase();
      if (r === 'PLAYER' || r === 'PLAYERS') roleQuery.role = 'PLAYER';
      else if (r === 'SCORER' || r === 'SCORERS') roleQuery.role = 'SCORER';
      else if (r === 'UMPIRE' || r === 'UMPIRES') roleQuery.role = 'UMPIRE';
      else if (r === 'CONTENT' || r === 'CONTENT_CREATOR' || r === 'STAFF') roleQuery.role = { $in: ['CONTENT', 'CONTENT_CREATOR'] };
    } else if (!filterRole) {
      roleQuery.role = { $in: ['PLAYER', 'SCORER', 'UMPIRE', 'CONTENT_CREATOR', 'CONTENT'] };
    }

    if (roleQuery.role) {
      const users = await db.models.User.find(roleQuery).sort({ created_at: -1 }).lean();
      users.forEach(u => {
        const rawStatus = (u.status || 'PENDING').toUpperCase();
        if (rawStatus === 'DELETED') return;
        const status = (rawStatus === 'ACTIVE') ? 'APPROVED' : rawStatus;
        if (filterStatus && filterStatus !== 'ALL' && status !== filterStatus.toUpperCase()) {
          return;
        }

        const role = (u.role === 'CONTENT') ? 'CONTENT_CREATOR' : u.role;
        let roleDisplay = 'Player';
        if (role === 'SCORER') roleDisplay = 'Official Scorer';
        if (role === 'UMPIRE') roleDisplay = 'Official Umpire';
        if (role === 'CONTENT_CREATOR') roleDisplay = 'Content Staff';

        const uAadhaar = u.aadhaar || u.aadhaar_number || u.player_details?.aadhaar || u.umpire_details?.aadhaar || 'N/A';
        results.push({
          id: u.id || u._id?.toString(),
          mongoId: u._id?.toString(),
          type: role,
          roleDisplay,
          name: u.name,
          email: u.email,
          phone: u.mobile || u.phone || 'N/A',
          aadhaar: uAadhaar,
          status: status,
          created_at: u.created_at || new Date().toISOString(),
          details: {
            phone: u.mobile || u.phone,
            mobile: u.mobile || u.phone,
            aadhaar: uAadhaar,
            specialty: u.specialty || u.umpire_details?.qualification || u.umpire_details?.certification_level,
            certification_id: u.certification_id || u.umpire_details?.certification_number,
            experience_years: u.experience_years || u.umpire_details?.experience_years,
            experience: u.umpire_details?.experience || u.umpire_info?.experience,
            qualification: u.umpire_details?.qualification || u.umpire_info?.qualification || u.umpire_details?.certification_level,
            certification_number: u.umpire_details?.certification_number || u.umpire_info?.certificationNumber,
            taluk: u.taluk || u.umpire_details?.taluk || u.umpire_details?.district || 'Virudhunagar',
            district: u.umpire_details?.district || u.umpire_info?.district || 'Virudhunagar',
            state: u.umpire_details?.state || u.umpire_info?.state || 'Tamil Nadu',
            date_of_birth: u.umpire_details?.date_of_birth || u.umpire_info?.dateOfBirth,
            gender: u.umpire_details?.gender || u.umpire_info?.gender,
            specialization: u.umpire_details?.specialization || u.umpire_info?.specialization,
            previous_organization: u.umpire_details?.previous_organization || u.umpire_info?.previousOrganization,
            address: u.umpire_details?.address || u.umpire_info?.address,
            additional_info: u.umpire_details?.additional_info || u.umpire_info?.additionalInfo,
            portfolio_url: u.portfolio_url,
            rejectionReason: u.rejection_reason
          }
        });
      });
    }

    // 3. Scorers from Scorer collection
    if (!filterRole || filterRole.toUpperCase() === 'SCORER' || filterRole.toUpperCase() === 'SCORERS') {
      try {
        const dbScorers = await db.models.Scorer.find({}).lean();
        const existingScorerEmails = new Set(results.filter(r => r.type === 'SCORER').map(r => r.email?.toLowerCase()));
        for (const sc of dbScorers) {
          if (!sc.email || existingScorerEmails.has(sc.email.toLowerCase())) continue;
          const rawStatus = (sc.status || 'PENDING').toUpperCase();
          if (rawStatus === 'DELETED') continue;
          const status = (rawStatus === 'ACTIVE') ? 'APPROVED' : rawStatus;
          if (filterStatus && filterStatus !== 'ALL' && status !== filterStatus.toUpperCase()) continue;
          existingScorerEmails.add(sc.email.toLowerCase());
          const scAadhaar = sc.aadhaar || sc.aadhaar_number || 'N/A';
          results.push({
            id: sc.id || sc._id?.toString(),
            mongoId: sc._id?.toString(),
            type: 'SCORER',
            roleDisplay: 'Official Scorer',
            name: sc.full_name || sc.name || 'Official Scorer',
            email: sc.email,
            phone: sc.mobile || sc.phone || 'N/A',
            aadhaar: scAadhaar,
            status: status,
            created_at: sc.created_at || new Date().toISOString(),
            details: {
              phone: sc.mobile || sc.phone,
              mobile: sc.mobile || sc.phone,
              aadhaar: scAadhaar,
              specialty: sc.certification_level || 'District Certified',
              taluk: sc.taluk || 'Virudhunagar',
              experience_years: sc.experience_years || 2,
              association: sc.association || 'Virudhunagar District Cricket Association'
            }
          });
        }
      } catch (_e) { }
    }

    return results;
  }

  async approveRegistration(id, type = 'TEAM', adminId = 'ADMIN') {
    await db.initDb();
    const mongoose = require('mongoose');
    const upperType = (type || '').toUpperCase();

    if (upperType === 'TEAM') {
      const team = await teamRegistrationModel.approveRegistration(id, adminId);
      return {
        success: true,
        message: `✓ Team "${team.team_name}" and its 15 squad players APPROVED!`,
        data: team
      };
    }

    const cleanId = String(id || '').trim();
    const cleanEmail = cleanId.toLowerCase();
    const query = {
      $or: [
        { id: cleanId },
        { email: cleanEmail },
        { email: cleanId }
      ]
    };
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      query.$or.push({ _id: cleanId });
    }

    let user = await db.models.User.findOne(query);
    if (!user && (upperType === 'SCORER' || upperType === 'OFFICIAL')) {
      user = await db.models.User.create({
        id: cleanId.startsWith('SC') || cleanId.startsWith('OFF') ? cleanId : `SCR-${Math.floor(100 + Math.random() * 900)}`,
        name: cleanId.includes('@') ? cleanId.split('@')[0] : 'Official Scorer',
        email: cleanEmail,
        role: 'SCORER',
        status: 'ACTIVE'
      });
    }
    if (!user) throw { status: 404, message: `Registration '${id}' not found.` };

    user.status = 'ACTIVE';
    await user.save();

    if (user.role === 'PLAYER') {
      await db.models.Player.updateMany(
        { email: user.email },
        { $set: { status: 'ACTIVE' } }
      );
    }

    await notificationModel.create({
      type: 'USER_APPROVED',
      title: `${user.role} Approved: ${user.name}`,
      message: `User ${user.name} (${user.email}) has been approved by ${adminId} as ${user.role}. Clearance granted.`,
      reference_id: user.id,
      status: 'UNREAD'
    });

    return {
      success: true,
      message: `✓ ${user.role} "${user.name}" has been officially APPROVED!`,
      data: user.toObject()
    };
  }

  async rejectRegistration(id, type = 'TEAM', reason = 'Criteria not met', adminId = 'ADMIN') {
    await db.initDb();
    const mongoose = require('mongoose');
    const upperType = (type || '').toUpperCase();

    if (upperType === 'TEAM') {
      const team = await teamRegistrationModel.rejectRegistration(id, reason, adminId);
      return {
        success: true,
        message: `Team "${team.team_name}" registration has been REJECTED.`,
        data: team
      };
    }

    const query = { $or: [{ id }, { email: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }

    const user = await db.models.User.findOne(query);
    if (!user) throw { status: 404, message: `Registration '${id}' not found.` };

    user.status = 'REJECTED';
    user.rejection_reason = reason;
    await user.save();

    if (user.role === 'PLAYER') {
      await db.models.Player.updateMany(
        { email: user.email },
        { $set: { status: 'REJECTED' } }
      );
    }

    await notificationModel.create({
      type: 'USER_REJECTED',
      title: `${user.role} Rejected: ${user.name}`,
      message: `Registration for ${user.name} (${user.email}) was rejected by ${adminId}. Reason: ${reason}`,
      reference_id: user.id,
      status: 'UNREAD'
    });

    return {
      success: true,
      message: `${user.role} "${user.name}" registration has been marked REJECTED.`,
      data: user.toObject()
    };
  }

  /**
   * Unified Admin Deletion for any registration type (with undo capability)
   */
  async deleteRegistration(id, type = 'TEAM', adminId = 'ADMIN') {
    await db.initDb();
    const mongoose = require('mongoose');
    const upperType = (type || '').toUpperCase();

    if (upperType === 'TEAM') {
      const team = await teamRegistrationModel.deleteRegistration(id, adminId);
      return {
        success: true,
        message: `Team "${team.team_name}" has been deleted.`,
        data: team
      };
    }

    // Individual User deletion (PLAYER, SCORER, UMPIRE, CONTENT_CREATOR)
    const cleanId = String(id || '').trim();
    const cleanEmail = cleanId.toLowerCase();
    const query = {
      $or: [
        { id: cleanId },
        { email: cleanEmail },
        { email: cleanId }
      ]
    };
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      query.$or.push({ _id: cleanId });
    }

    const user = await db.models.User.findOne(query);
    if (!user) throw { status: 404, message: `Registration '${id}' not found.` };

    user.previous_status = user.status || 'PENDING';
    user.status = 'DELETED';
    user.deleted_at = new Date();
    user.deleted_by = adminId;
    await user.save();

    if (user.role === 'SCORER') {
      await db.models.Scorer.updateOne(
        { $or: [{ id: cleanId }, { email: cleanEmail }, { scorerId: cleanId }] },
        { $set: { status: 'DELETED', previous_status: 'APPROVED', deleted_at: new Date() } }
      );
    } else if (user.role === 'PLAYER') {
      await db.models.Player.updateMany(
        { email: user.email },
        { $set: { status: 'DELETED' } }
      );
    }

    await notificationModel.create({
      type: 'USER_DELETED',
      title: `${user.role} Deleted: ${user.name}`,
      message: `User ${user.name} (${user.email}) was deleted by ${adminId}.`,
      reference_id: user.id,
      status: 'UNREAD'
    });

    return {
      success: true,
      message: `✓ ${user.role} "${user.name}" has been deleted.`,
      data: user.toObject()
    };
  }

  /**
   * Restore previously deleted registration (Undo)
   */
  async restoreRegistration(id, type = 'TEAM', adminId = 'ADMIN') {
    await db.initDb();
    const mongoose = require('mongoose');
    const upperType = (type || '').toUpperCase();

    if (upperType === 'TEAM') {
      const team = await teamRegistrationModel.restoreRegistration(id);
      return {
        success: true,
        message: `Team "${team.team_name}" has been restored.`,
        data: team
      };
    }

    const cleanId = String(id || '').trim();
    const cleanEmail = cleanId.toLowerCase();
    const query = {
      $or: [
        { id: cleanId },
        { email: cleanEmail },
        { email: cleanId }
      ]
    };
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      query.$or.push({ _id: cleanId });
    }

    const user = await db.models.User.findOne(query);
    if (!user) throw { status: 404, message: `Registration '${id}' not found.` };

    const restoredStatus = user.previous_status || 'ACTIVE';
    user.status = restoredStatus;
    user.deleted_at = null;
    user.deleted_by = null;
    await user.save();

    if (user.role === 'SCORER') {
      await db.models.Scorer.updateOne(
        { $or: [{ id: cleanId }, { email: cleanEmail }, { scorerId: cleanId }] },
        { $set: { status: restoredStatus === 'ACTIVE' ? 'APPROVED' : restoredStatus, deleted_at: null } }
      );
    } else if (user.role === 'PLAYER') {
      await db.models.Player.updateMany(
        { email: user.email },
        { $set: { status: restoredStatus } }
      );
    }

    return {
      success: true,
      message: `✓ ${user.role} "${user.name}" restored successfully!`,
      data: user.toObject()
    };
  }
}

module.exports = new AdminAuth();

