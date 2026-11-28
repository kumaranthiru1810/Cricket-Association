/**
 * backend/services/auth/teamAuth.js
 * Team & Coach Authentication, Registration & Approval Service
 */

const jwt = require('jsonwebtoken');
const teamRegistrationModel = require('../../models/teamRegistrationModel');
const userModel = require('../../models/userModel');
const otpService = require('../otpService');
const { sendOtpEmail } = require('../../config/mailer');
const db = require('../../config/db');

const { JWT_SECRET } = require('../../config/env');

class TeamAuth {
  /**
   * Request OTP for Team / Coach Login
   */
  async requestTeamOtp(coachName, coachEmail) {
    if (!coachEmail) {
      throw { status: 400, message: 'Coach email is required.' };
    }

    const cleanEmail = coachEmail.trim().toLowerCase();
    await db.initDb();

    // Check team registration record
    const reg = await teamRegistrationModel.findByCoachEmail(cleanEmail);
    let team = null;
    if (!reg) {
      team = await db.models.Team.findOne({ coach_email: cleanEmail }).lean();
      if (!team) {
        return {
          success: true,
          message: 'If an eligible team account exists for this email, an OTP has been dispatched.'
        };
      }
    }

    // Verify coach name if provided
    if (coachName) {
      const regCoachName = (reg?.coach_name || team?.coach_name || '').toLowerCase();
      const inputCoachName = coachName.trim().toLowerCase();
      const isNameMatch = !regCoachName || regCoachName.includes(inputCoachName) || inputCoachName.includes(regCoachName) ||
        regCoachName.split(' ').some(w => inputCoachName.includes(w));
      if (!isNameMatch) {
        throw {
          status: 401,
          message: `Coach name "${coachName}" does not match the registered coach for this team.`
        };
      }
    }

    const teamStatus = reg ? reg.status : (team?.status === 'ACTIVE' ? 'APPROVED' : (team?.status || 'APPROVED'));
    const resolvedTeamName = reg?.team_name || team?.name || 'Your Team';

    if (teamStatus === 'PENDING') {
      throw {
        status: 403,
        message: `⏳ Team "${resolvedTeamName}" is currently PENDING admin approval. Coach access is granted only after administrative approval.`
      };
    }
    if (teamStatus === 'REJECTED') {
      throw {
        status: 403,
        message: `❌ Team "${resolvedTeamName}" was REJECTED. Reason: ${reg?.rejection_reason || 'Criteria not met'}.`
      };
    }

    // Ensure User record exists
    let user = await userModel.findByEmail(cleanEmail);
    if (!user) {
      user = await userModel.create({
        name: coachName || reg?.coach_name || team?.coach_name || 'Team Coach',
        email: cleanEmail,
        role: 'COACH',
        status: 'ACTIVE'
      });
    }

    // Generate & send OTP
    const rawOtp = otpService.generateOtpCode();
    const otpHash = otpService.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + otpService.OTP_EXPIRATION_MS);

    await userModel.updateOtp(user.id || cleanEmail, {
      otp_hash: otpHash,
      otp_expires_at: expiresAt
    });

    await sendOtpEmail({
      toEmail: cleanEmail,
      userName: coachName || reg?.coach_name || team?.coach_name || 'Coach',
      otp: rawOtp
    });

    console.log(`\n🏏 [COACH OTP DISPATCH] Coach: ${coachName || reg?.coach_name} | Email: ${cleanEmail} | Status: Dispatched securely via email\n`);

    return {
      success: true,
      message: `OTP sent to ${cleanEmail} via Nodemailer.`,
      teamName: resolvedTeamName,
      coachName: coachName || reg?.coach_name || team?.coach_name,
      email: cleanEmail
    };
  }

  /**
   * Verify Coach OTP and return authenticated token
   */
  async verifyTeamOtp(coachEmail, otp, verifyOtpFn) {
    const authResult = await verifyOtpFn(coachEmail, otp);
    const reg = await teamRegistrationModel.findByCoachEmail(coachEmail);
    const teamDoc = await db.models.Team.findOne({ coach_email: coachEmail.trim().toLowerCase() }).lean();

    const teamId = reg?.id || teamDoc?.id || 'TM-01';
    const teamName = reg?.team_name || teamDoc?.name || 'Virudhunagar Team';

    const token = jwt.sign(
      { id: authResult.user.id, name: authResult.user.name, email: authResult.user.email, role: 'COACH', teamId, teamName, tv: authResult.user.token_version ?? 0 },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return {
      success: true,
      message: `Welcome Coach ${authResult.user.name}!`,
      user: {
        ...authResult.user,
        role: 'COACH',
        teamName,
        teamId
      },
      team: {
        teamId,
        teamName
      },
      token
    };
  }

  /**
   * Register a new Team with Coach and 15 Squad Players
   */
  async registerTeam({ teamName, coachName, coachEmail, coachPhone, coachMobile, phone, mobile, coachAadhaar, aadhaar, password, city, taluk, players = [] }) {
    if (!teamName || !teamName.trim()) {
      throw { status: 400, message: 'Team Name is required.' };
    }
    if (!coachName || !coachName.trim()) {
      throw { status: 400, message: 'Coach Name is required.' };
    }
    if (!coachEmail || !coachEmail.trim() || !coachEmail.includes('@')) {
      throw { status: 400, message: 'Valid Coach Email address is required.' };
    }

    const cleanCoachPhone = String(coachPhone || coachMobile || phone || mobile || '').replace(/\D/g, '');
    const cleanCoachAadhaar = String(coachAadhaar || aadhaar || '').replace(/\D/g, '');

    if (!Array.isArray(players) || players.length === 0) {
      throw { status: 400, message: 'Squad list of 15 players with names and emails is required.' };
    }

    const cleanCoachEmail = coachEmail.trim().toLowerCase();

    // Validate squad players (must have valid unique email AND must already be registered as a Player)
    const seenPlayerEmails = new Set();
    const normalizedPlayerEmails = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.name || !p.name.trim()) {
        throw { status: 400, message: `Player #${i + 1} Name is required.` };
      }
      if (!p.email || !p.email.trim() || !p.email.includes('@')) {
        throw { status: 400, message: `Valid Email ID for Player #${i + 1} (${p.name || 'Unnamed'}) is required.` };
      }
      const pEmailClean = p.email.trim().toLowerCase();
      if (pEmailClean === cleanCoachEmail) {
        throw { status: 400, message: `Coach email cannot be identical to Player #${i + 1} email.` };
      }
      if (seenPlayerEmails.has(pEmailClean)) {
        throw { status: 400, message: `Duplicate email "${pEmailClean}" in squad. Two players cannot share the same email.` };
      }
      seenPlayerEmails.add(pEmailClean);
      normalizedPlayerEmails.push(pEmailClean);
    }

    await db.initDb();
    const [regUsers, regPlayers] = await Promise.all([
      db.models.User.find({
        email: { $in: normalizedPlayerEmails },
        role: 'PLAYER',
        status: { $ne: 'DELETED' }
      }).select('email').lean(),
      db.models.Player.find({
        email: { $in: normalizedPlayerEmails }
      }).select('email').lean()
    ]);
    const registeredSet = new Set([
      ...(regUsers || []).map(u => String(u.email || '').trim().toLowerCase()),
      ...(regPlayers || []).map(pl => String(pl.email || '').trim().toLowerCase())
    ]);
    for (let i = 0; i < players.length; i++) {
      const pEmailClean = players[i].email.trim().toLowerCase();
      if (!registeredSet.has(pEmailClean)) {
        throw {
          status: 400,
          message: `Player #${i + 1} (${pEmailClean}) is not registered as a Player yet. Every squad player must complete Player Registration first.`
        };
      }
    }

    let passwordHash = password ? String(password).trim() : null;
    if (passwordHash) {
      try {
        const bcrypt = require('bcryptjs');
        passwordHash = await bcrypt.hash(passwordHash, 10);
      } catch (_e) { }
    }

    const createdTeam = await teamRegistrationModel.create({
      teamName: teamName.trim(),
      coachName: coachName.trim(),
      coachEmail: cleanCoachEmail,
      coachPhone: cleanCoachPhone,
      coachAadhaar: cleanCoachAadhaar,
      city: city || taluk || 'Virudhunagar',
      taluk: taluk || 'Virudhunagar',
      players
    });

    let coachUser = await userModel.findByEmail(cleanCoachEmail);
    if (!coachUser) {
      await userModel.create({
        id: `COACH-${Date.now()}`,
        name: coachName.trim(),
        email: cleanCoachEmail,
        mobile: cleanCoachPhone || null,
        aadhaar: cleanCoachAadhaar || null,
        role: 'COACH',
        password_hash: passwordHash,
        status: 'PENDING'
      });
    } else {
      await db.models.User.updateOne(
        { email: cleanCoachEmail },
        {
          $set: {
            name: coachName.trim(),
            ...(cleanCoachPhone && { mobile: cleanCoachPhone }),
            ...(cleanCoachAadhaar && { aadhaar: cleanCoachAadhaar }),
            ...(passwordHash ? { password_hash: passwordHash } : {}),
            role: 'COACH',
            status: 'PENDING'
          },
          $unset: { current_password: '' }
        }
      );
    }

    console.log(`\n🏏 [TEAM REGISTERED] ID: ${createdTeam.id} | Team: "${createdTeam.team_name}" | Coach: ${cleanCoachEmail} | Status: PENDING\n`);

    return {
      success: true,
      status: 'PENDING',
      message: `Team "${createdTeam.team_name}" registration submitted! Awaiting admin approval before Coach and Players can log in.`,
      team: createdTeam
    };
  }

  /**
   * Admin approves team registration
   */
  async approveTeam(teamId, adminId = 'ADMIN') {
    const team = await teamRegistrationModel.approveRegistration(teamId, adminId);
    return {
      success: true,
      message: `Team "${team.team_name}" has been APPROVED. Team and squad players are now officially registered in MongoDB!`,
      team
    };
  }

  /**
   * Admin rejects team registration
   */
  async rejectTeam(teamId, reason, adminId = 'ADMIN') {
    const team = await teamRegistrationModel.rejectRegistration(teamId, reason, adminId);
    return {
      success: true,
      message: `Team "${team.team_name}" registration has been REJECTED.`,
      team
    };
  }

  async checkTeamExists(teamName, coachEmail) {
    await db.initDb();
    const cleanTeam = (teamName || '').trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanEmail = (coachEmail || '').trim().toLowerCase();
    return db.models.TeamRegistration.findOne({
      $or: [
        { team_name: { $regex: new RegExp(`^${cleanTeam}$`, 'i') } },
        { coach_email: cleanEmail }
      ]
    }).lean();
  }

  async getTeams(status = null) {
    return teamRegistrationModel.getAll(status);
  }
}

module.exports = new TeamAuth();

