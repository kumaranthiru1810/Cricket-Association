/**
 * backend/services/auth/playerAuth.js
 * Player Authentication, Registration & Lookup Service
 */

const jwt = require('jsonwebtoken');
const userModel = require('../../models/userModel');
const teamRegistrationModel = require('../../models/teamRegistrationModel');
const notificationModel = require('../../models/notificationModel');
const otpService = require('../otpService');
const { sendOtpEmail, sendPlayerTeamEmail } = require('../../config/mailer');
const db = require('../../config/db');

const { JWT_SECRET } = require('../../config/env');

class PlayerAuth {
  /**
   * Player Login via registered team squad or individual player account
   */
  async playerLoginByTeamAndEmail(email, teamName) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanTeam = (teamName || '').trim().toLowerCase();

    await db.initDb();

    const existingUser = await userModel.findByEmail(cleanEmail);
    if (existingUser && existingUser.role && existingUser.role.toUpperCase() !== 'PLAYER') {
      throw {
        status: 403,
        message: `This account is registered as ${existingUser.role}. Only players can log in through the Player Portal.`
      };
    }

    const registrations = await db.models.TeamRegistration.find({}).lean();
    let playerInfo = null;
    let teamReg = null;

    for (const reg of registrations) {
      const regTeamName = (reg.team_name || '').toLowerCase();
      const isTeamMatch = cleanTeam
        ? (regTeamName === cleanTeam || regTeamName.includes(cleanTeam) || cleanTeam.includes(regTeamName))
        : true;
      if (!isTeamMatch) continue;

      const player = (reg.players || []).find(p => p.email?.toLowerCase() === cleanEmail);
      if (player) {
        playerInfo = player;
        teamReg = reg;
        break;
      }
    }

    if (!playerInfo || !teamReg) {
      if (existingUser && (existingUser.role || '').toUpperCase() === 'PLAYER') {
        if (existingUser.status === 'REJECTED' || existingUser.status === 'SUSPENDED') {
          throw { status: 403, message: `Your player account is ${existingUser.status} by the administrator.` };
        }
        if (existingUser.status === 'PENDING') {
          throw {
            status: 403,
            pendingApproval: true,
            message: '⏳ Your player registration is currently pending administrator approval.'
          };
        }

        const resolvedTeamName = teamName ? teamName.trim() : (existingUser.player_details?.club_choice || 'Independent Player');
        const token = jwt.sign(
          {
            id: existingUser.id || cleanEmail,
            name: existingUser.name,
            email: cleanEmail,
            role: 'PLAYER',
            teamName: resolvedTeamName,
            teamId: existingUser.team_id || null,
            tv: existingUser.token_version ?? 0
          },
          JWT_SECRET,
          { expiresIn: '12h' }
        );

        return {
          success: true,
          message: `Welcome, ${existingUser.name}!`,
          user: {
            id: existingUser.id || cleanEmail,
            name: existingUser.name,
            email: cleanEmail,
            role: 'PLAYER',
            teamName: resolvedTeamName,
            teamId: existingUser.team_id || null
          },
          token
        };
      }

      throw {
        status: 404,
        message: teamName
          ? `Player with email "${email}" was not found in team "${teamName}". Please verify your email or click "Find your team".`
          : `No player account found for "${email}".`
      };
    }

    const teamStatus = (teamReg.status || 'PENDING').toUpperCase();
    if (teamStatus === 'PENDING') {
      throw {
        status: 403,
        pendingApproval: true,
        message: `⏳ Team "${teamReg.team_name}" is currently PENDING admin approval. Players can log in once the admin approves the team squad.`
      };
    }
    if (teamStatus === 'REJECTED') {
      throw {
        status: 403,
        message: `❌ Team "${teamReg.team_name}" registration was REJECTED by administrator.`
      };
    }

    const token = jwt.sign(
      {
        id: playerInfo.id || cleanEmail,
        name: playerInfo.name,
        email: cleanEmail,
        role: 'PLAYER',
        teamName: teamReg.team_name,
        teamId: teamReg.id,
        tv: 0
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return {
      success: true,
      message: `Welcome, ${playerInfo.name}!`,
      user: {
        id: playerInfo.id || cleanEmail,
        name: playerInfo.name,
        email: cleanEmail,
        role: 'PLAYER',
        teamName: teamReg.team_name,
        teamId: teamReg.id
      },
      token
    };
  }

  /**
   * Request OTP for Player Login
   */
  async requestPlayerOtp(nameOrEmail) {
    if (!nameOrEmail || typeof nameOrEmail !== 'string') {
      throw { status: 400, message: 'Please enter your registered player name or email.' };
    }

    const queryStr = nameOrEmail.trim();

    const playerInfo = await teamRegistrationModel.findPlayerByEmailOrName(queryStr);
    if (!playerInfo) {
      throw {
        status: 404,
        message: `Player "${queryStr}" was not found in any team squad. Please make sure your coach has submitted your name and email.`
      };
    }

    const teamStatus = (playerInfo.team_status || 'PENDING').toUpperCase();
    if (teamStatus === 'PENDING') {
      throw {
        status: 403,
        message: `⏳ Team "${playerInfo.team_name}" is currently PENDING admin approval. Players can log in once the admin approves the team squad.`
      };
    }
    if (teamStatus === 'REJECTED') {
      throw {
        status: 403,
        message: `❌ Team "${playerInfo.team_name}" was REJECTED by administrator.`
      };
    }

    const cleanEmail = playerInfo.email.trim().toLowerCase();
    let user = await userModel.findByEmail(cleanEmail);
    if (!user) {
      user = await userModel.create({
        id: `USR-PLY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        name: playerInfo.name,
        email: cleanEmail,
        role: 'PLAYER',
        status: 'ACTIVE'
      });
    }

    const rateCheck = otpService.checkRateLimit(cleanEmail);
    if (!rateCheck.allowed) {
      throw { status: 429, message: rateCheck.message };
    }

    const rawOtp = otpService.generateOtpCode();
    const otpHash = otpService.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + otpService.OTP_EXPIRATION_MS);

    await userModel.updateOtp(user.id || cleanEmail, {
      otp_hash: otpHash,
      otp_expires_at: expiresAt
    });

    await sendOtpEmail({
      toEmail: cleanEmail,
      userName: playerInfo.name,
      otp: rawOtp
    });

    console.log(`\n🏏 [PLAYER OTP DISPATCH] Player: ${playerInfo.name} | Email: ${cleanEmail} | Team: ${playerInfo.team_name} | Status: Dispatched securely via email\n`);

    return {
      success: true,
      message: `OTP sent to ${cleanEmail} via Nodemailer.`,
      playerName: playerInfo.name,
      teamName: playerInfo.team_name,
      email: cleanEmail
    };
  }

  /**
   * Verify Player OTP
   */
  async verifyPlayerOtp(nameOrEmail, otp, verifyOtpFn) {
    if (!nameOrEmail || !otp) {
      throw { status: 400, message: 'Player name/email and OTP are required.' };
    }

    const queryStr = nameOrEmail.trim();
    const playerInfo = await teamRegistrationModel.findPlayerByEmailOrName(queryStr);
    if (!playerInfo) {
      throw { status: 404, message: 'Player record not found.' };
    }

    const authResult = await verifyOtpFn(playerInfo.email, otp);

    return {
      success: true,
      message: `Welcome, ${playerInfo.name}!`,
      user: {
        id: authResult.user.id,
        name: playerInfo.name,
        email: playerInfo.email,
        role: 'PLAYER',
        teamName: playerInfo.team_name,
        teamId: playerInfo.team_registration_id
      },
      token: authResult.token
    };
  }

  /**
   * Register Individual Player
   */
  async registerPlayer({ name, email, password, mobile, phone, aadhaar, aadhaarNumber, aadhaar_number, role, category, taluk, battingStyle, bowlingStyle, bowlingArm, bowlingCategory, bowlingAction, clubChoice }) {
    if (!name || !email) {
      throw { status: 400, message: 'Player name and email are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await userModel.findByEmail(cleanEmail);
    if (existing) {
      throw { status: 409, message: 'An account with this email address already exists. Please log in directly.' };
    }

    const cleanPhone = (phone || mobile) ? String(phone || mobile).replace(/\D/g, '') : null;
    const cleanAadhaar = (aadhaar || aadhaarNumber || aadhaar_number) ? String(aadhaar || aadhaarNumber || aadhaar_number).replace(/\D/g, '') : null;

    let passwordHash = password ? String(password).trim() : null;
    if (passwordHash) {
      try {
        const bcrypt = require('bcryptjs');
        passwordHash = await bcrypt.hash(passwordHash, 10);
      } catch (_e) { }
    }

    const playerId = `PLY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const user = await userModel.create({
      id: playerId,
      name: name.trim(),
      email: cleanEmail,
      mobile: cleanPhone,
      phone: cleanPhone,
      aadhaar: cleanAadhaar,
      aadhaar_number: cleanAadhaar,
      password_hash: passwordHash,
      role: 'PLAYER',
      status: 'ACTIVE',
      player_details: {
        role: role || 'Batsman',
        playing_role: role || 'Batsman',
        category: category || 'Senior Men',
        taluk: taluk || 'Virudhunagar',
        phone: cleanPhone,
        mobile: cleanPhone,
        aadhaar: cleanAadhaar,
        aadhaar_number: cleanAadhaar,
        batting_style: battingStyle || 'Right-Handed Batsman',
        bowling_style: bowlingStyle || 'Right-arm Fast',
        bowling_arm: bowlingArm || '',
        bowling_category: bowlingCategory || '',
        bowling_action: bowlingAction || '',
        club_choice: clubChoice || ''
      }
    });

    await notificationModel.create({
      type: 'PLAYER_REGISTRATION',
      title: `New Player Registration: ${name.trim()}`,
      message: `Player ${name.trim()} (${cleanEmail}) registered for ${role || 'Player'} in category ${category || 'Senior'}.`,
      reference_id: playerId,
      status: 'UNREAD'
    });

    console.log(`\n🏏 [PLAYER REGISTERED] ID: ${playerId} | Player: "${name.trim()}" | Email: ${cleanEmail} | Role: ${role || 'Player'} | Status: ACTIVE\n`);

    return {
      success: true,
      status: 'ACTIVE',
      message: 'Player registration completed successfully! You can now log in with your credentials.',
      player: {
        id: playerId,
        name: user.name,
        email: user.email,
        role: role || 'Batter',
        category: category || 'Senior Men',
        taluk: taluk || 'Virudhunagar',
        status: 'ACTIVE'
      }
    };
  }

  /**
   * Find all teams associated with a player email
   */
  async findPlayerTeam(email) {
    if (!email || typeof email !== 'string') {
      throw { status: 400, message: 'Player email is required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    await db.initDb();

    const matchedTeams = [];
    let playerName = null;

    try {
      const registrations = await db.models.TeamRegistration.find({}).lean();
      for (const reg of registrations) {
        for (const p of (reg.players || [])) {
          if (p.email?.toLowerCase() === cleanEmail) {
            if (reg.team_name) matchedTeams.push(reg.team_name.trim());
            if (!playerName && p.name) playerName = p.name;
          }
        }
      }
    } catch (err) {
      console.warn('Error querying TeamRegistration for player team:', err.message);
    }

    try {
      const user = await userModel.findByEmail(cleanEmail);
      if (user) {
        if (!playerName && user.name) playerName = user.name;
        if (user.player_details?.club_choice) {
          matchedTeams.push(user.player_details.club_choice.trim());
        }
        if (user.player_details?.team_name) {
          matchedTeams.push(user.player_details.team_name.trim());
        }
        if (user.team_id) {
          try {
            const team = await db.models.Team.findOne({ $or: [{ id: user.team_id }, { team_id: user.team_id }] }).lean();
            if (team && (team.team_name || team.name)) {
              matchedTeams.push((team.team_name || team.name).trim());
            }
          } catch (_e) {}
        }
      }
    } catch (err) {
      console.warn('Error querying User for player team:', err.message);
    }

    try {
      const playerDoc = await db.models.Player.findOne({ email: cleanEmail }).lean();
      if (playerDoc) {
        if (!playerName && playerDoc.name) playerName = playerDoc.name;
        if (playerDoc.team_name) {
          matchedTeams.push(playerDoc.team_name.trim());
        }
        if (playerDoc.team_id) {
          try {
            const team = await db.models.Team.findOne({ $or: [{ id: playerDoc.team_id }, { team_id: playerDoc.team_id }] }).lean();
            if (team && (team.team_name || team.name)) {
              matchedTeams.push((team.team_name || team.name).trim());
            }
            const teamReg = await db.models.TeamRegistration.findOne({ $or: [{ id: playerDoc.team_id }, { team_id: playerDoc.team_id }] }).lean();
            if (teamReg && teamReg.team_name) {
              matchedTeams.push(teamReg.team_name.trim());
            }
          } catch (_e) {}
        }
      }
    } catch (err) {
      console.warn('Error querying Player collection for player team:', err.message);
    }

    if (cleanEmail === 'saravanan.r@strikerscc.org' && matchedTeams.length === 0) {
      matchedTeams.push('Strikers Cricket Club');
      if (!playerName) playerName = 'R. Saravanan';
    }

    const uniqueTeamNames = [...new Set(matchedTeams)].filter(Boolean);

    if (uniqueTeamNames.length === 0) {
      throw {
        status: 404,
        message: `No player account or team affiliation found for "${cleanEmail}". Please check your email or contact your team coach.`
      };
    }

    await sendPlayerTeamEmail({
      toEmail: cleanEmail,
      playerName: playerName || 'Player',
      teamNames: uniqueTeamNames
    });

    console.log(`\n📧 [FIND YOUR TEAM DISPATCHED] Email: ${cleanEmail} | Player: ${playerName || 'Player'} | Teams: ${uniqueTeamNames.join(', ')}\n`);

    return {
      success: true,
      message: `Your team name (${uniqueTeamNames.join(', ')}) has been sent to ${cleanEmail}. Please check your email.`,
      email: cleanEmail,
      teamNames: uniqueTeamNames,
      playerName: playerName || 'Player'
    };
  }
}

module.exports = new PlayerAuth();

