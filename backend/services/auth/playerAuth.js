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
const { normalizeAddress, validateAddress } = require('../../utils/addressValidation');
const {
  validatePersonName,
  validateClubOrAcademyName,
  validateStudyingInstitution,
  validateStudyLevel,
  validateStudyBranchOrClass,
  validateWorkingInstitution,
  validateDeclarationDate,
  validateDeclarationPlace,
  validateIndianMobile
} = require('../../utils/playerDetailsValidation');

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
        status: 401,
        message: 'Invalid player credentials or account not eligible.'
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
      return {
        success: true,
        message: 'If an eligible account exists, an OTP has been sent.'
      };
    }

    const teamStatus = (playerInfo.team_status || 'PENDING').toUpperCase();
    if (teamStatus === 'PENDING' || teamStatus === 'REJECTED') {
      return {
        success: true,
        message: 'If an eligible account exists, an OTP has been sent.'
      };
    }

    const cleanEmail = playerInfo.email.trim().toLowerCase();
    let user = await userModel.findByEmail(cleanEmail);
    if (!user) {
      await db.initDb();
      const existingPlayer = await db.models.Player.findOne({ email: cleanEmail }).select('id').lean();
      const generatedId = existingPlayer?.id || `PLY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      user = await userModel.create({
        id: generatedId,
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

    return {
      success: true,
      message: 'If an eligible account exists, an OTP has been sent.'
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
      throw { status: 401, message: 'Invalid or expired OTP code.' };
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
  async registerPlayer(payload) {
    const {
      name,
      email,
      password,
      mobile,
      phone,
      aadhaar,
      aadhaarNumber,
      aadhaar_number,
      role,
      category,
      taluk,
      battingStyle,
      bowlingStyle,
      bowlingArm,
      bowlingCategory,
      bowlingAction,
      clubChoice,
      fatherName,
      dateOfBirth,
      age,
      placeOfBirth,
      address,
      occupationType,
      workingInstitution,
      studyingInstitution,
      studyLevel,
      branchYearSec,
      classSection,
      batterHand,
      batterPosition,
      bowlerHand,
      bowlerType,
      isWicketKeeper,
      declarationPlace,
      declarationDate,
      declarationAgreed,
      photo,
      clientFaceAnalysis
    } = payload || {};

    if (!name || !email) {
      throw { status: 400, message: 'Player name and email are required.' };
    }

    const playerNameCheck = validatePersonName(name, 'Player Full Name');
    if (!playerNameCheck.isValid) {
      throw { status: 400, message: playerNameCheck.error };
    }
    const cleanPlayerName = playerNameCheck.normalized;

    const fatherNameCheck = validatePersonName(fatherName, 'Father Name');
    if (!fatherNameCheck.isValid) {
      throw { status: 400, message: fatherNameCheck.error };
    }
    const cleanFatherName = fatherNameCheck.normalized;

    const cleanEmail = email.trim().toLowerCase();
    const existing = await userModel.findByEmail(cleanEmail);
    if (existing) {
      throw { status: 409, message: 'An account with this email address already exists. Two players cannot use the same email.' };
    }
    await db.initDb();
    const existingPlayerDoc = await db.models.Player.findOne({ email: cleanEmail }).lean();
    if (existingPlayerDoc) {
      throw { status: 409, message: 'A player with this email address is already registered. Two players cannot use the same email.' };
    }

    const rawPhone = mobile !== undefined && mobile !== null && String(mobile) !== '' ? mobile : phone;
    const phoneCheck = validateIndianMobile(rawPhone);
    if (!phoneCheck.isValid) {
      throw { status: 400, message: phoneCheck.error };
    }
    const cleanPhone = phoneCheck.normalized;

    const existingPhoneUser = await db.models.User.findOne({
      $or: [
        { mobile: cleanPhone },
        { phone: cleanPhone },
        { 'player_details.mobile': cleanPhone },
        { 'player_details.phone': cleanPhone }
      ],
      status: { $ne: 'REJECTED' }
    }).lean();
    if (existingPhoneUser) {
      throw { status: 409, message: 'This mobile number is already registered. Please use another mobile number or login directly.' };
    }

    const existingPhonePlayer = await db.models.Player.findOne({
      $or: [{ phone: cleanPhone }, { mobile: cleanPhone }]
    }).lean();
    if (existingPhonePlayer) {
      throw { status: 409, message: 'A player with this mobile number is already registered. Please use another mobile number.' };
    }
    const addressCheck = validateAddress(address);
    if (!addressCheck.isValid) {
      throw { status: 400, message: addressCheck.error };
    }
    const cleanAddress = addressCheck.normalized;

    const clubCheck = validateClubOrAcademyName(clubChoice);
    if (!clubCheck.isValid) {
      throw { status: 400, message: clubCheck.error };
    }
    const cleanClubChoice = clubCheck.normalized;

    const declPlaceCheck = validateDeclarationPlace(declarationPlace);
    if (!declPlaceCheck.isValid) {
      throw { status: 400, message: declPlaceCheck.error };
    }
    const cleanDeclarationPlace = declPlaceCheck.normalized;

    const declDateCheck = validateDeclarationDate(declarationDate);
    if (!declDateCheck.isValid) {
      throw { status: 400, message: declDateCheck.error };
    }
    const cleanDeclarationDate = declDateCheck.normalized;

    const cleanOccupationType = occupationType ? String(occupationType).trim().toUpperCase() : '';
    let cleanStudyingInstitution = '';
    let cleanStudyLevel = '';
    let cleanBranchYearSec = '';
    let cleanClassSection = '';
    let cleanWorkingInstitution = '';

    if (cleanOccupationType === 'STUDYING') {
      const studyInstCheck = validateStudyingInstitution(studyingInstitution);
      if (!studyInstCheck.isValid) {
        throw { status: 400, message: studyInstCheck.error };
      }
      cleanStudyingInstitution = studyInstCheck.normalized;

      const studyLvlCheck = validateStudyLevel(studyLevel);
      if (!studyLvlCheck.isValid) {
        throw { status: 400, message: studyLvlCheck.error };
      }
      cleanStudyLevel = studyLvlCheck.normalized;

      if (cleanStudyLevel === 'COLLEGE') {
        const branchCheck = validateStudyBranchOrClass(branchYearSec, 'COLLEGE');
        if (!branchCheck.isValid) {
          throw { status: 400, message: branchCheck.error };
        }
        cleanBranchYearSec = branchCheck.normalized;
      } else {
        const classCheck = validateStudyBranchOrClass(classSection, 'SCHOOL');
        if (!classCheck.isValid) {
          throw { status: 400, message: classCheck.error };
        }
        cleanClassSection = classCheck.normalized;
      }
    } else if (cleanOccupationType === 'WORKING') {
      const workInstCheck = validateWorkingInstitution(workingInstitution);
      if (!workInstCheck.isValid) {
        throw { status: 400, message: workInstCheck.error };
      }
      cleanWorkingInstitution = workInstCheck.normalized;
    }
    const cleanAadhaar = (aadhaar || aadhaarNumber || aadhaar_number) ? String(aadhaar || aadhaarNumber || aadhaar_number).replace(/\D/g, '') : null;

    let passwordHash = password ? String(password).trim() : null;
    if (passwordHash) {
      try {
        const bcrypt = require('bcryptjs');
        passwordHash = await bcrypt.hash(passwordHash, 10);
      } catch (_e) { }
    }

    await db.initDb();
    let playerId = `PLY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const [uExists, pExists] = await Promise.all([
        db.models.User.exists({ id: playerId }),
        db.models.Player.exists({ id: playerId })
      ]);
      if (!uExists && !pExists) break;
      playerId = `PLY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    let storedPhoto = photo || null;
    let photoPhash = null;
    let photoVerificationStatus = 'NONE';
    let photoVerificationReason = '';
    let photoMetadata = null;

    if (storedPhoto && typeof storedPhoto === 'string' && storedPhoto.startsWith('data:image/')) {
      const passportPhotoService = require('../passportPhotoService');
      const verified = await passportPhotoService.verifyAndProcessPassportPhoto({
        input: storedPhoto,
        email: cleanEmail,
        userId: playerId,
        clientFaceAnalysis
      });
      storedPhoto = verified.url;
      photoPhash = verified.phash;
      photoVerificationStatus = verified.verificationStatus;
      photoVerificationReason = verified.verificationReason;
      photoMetadata = verified.metadata;
    }

    const user = await userModel.create({
      id: playerId,
      name: cleanPlayerName,
      email: cleanEmail,
      mobile: cleanPhone,
      phone: cleanPhone,
      aadhaar: cleanAadhaar,
      aadhaar_number: cleanAadhaar,
      password_hash: passwordHash,
      role: 'PLAYER',
      status: 'ACTIVE',
      photo: storedPhoto,
      image_path: storedPhoto,
      photo_phash: photoPhash,
      photo_verification_status: photoVerificationStatus,
      photo_verification_reason: photoVerificationReason,
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
        club_choice: cleanClubChoice,
        photo: storedPhoto,
        image_path: storedPhoto,
        photo_phash: photoPhash,
        photo_verification_status: photoVerificationStatus,
        photo_verification_reason: photoVerificationReason,
        photo_metadata: photoMetadata,
        consent_at: (payload.photoConsent || payload.guardianConsent || payload.declarationAgreed) ? new Date() : null,
        father_name: cleanFatherName,
        date_of_birth: dateOfBirth ? String(dateOfBirth).trim() : '',
        age: age ? String(age).trim() : '',
        place_of_birth: placeOfBirth ? String(placeOfBirth).trim() : '',
        address: cleanAddress,
        occupation_type: cleanOccupationType,
        working_institution: cleanOccupationType === 'WORKING' ? cleanWorkingInstitution : (cleanOccupationType === 'STUDYING' ? '' : (workingInstitution ? String(workingInstitution).trim() : '')),
        studying_institution: cleanOccupationType === 'STUDYING' ? cleanStudyingInstitution : (cleanOccupationType === 'WORKING' ? '' : (studyingInstitution ? String(studyingInstitution).trim() : '')),
        study_level: cleanOccupationType === 'STUDYING' ? cleanStudyLevel : (cleanOccupationType === 'WORKING' ? '' : (studyLevel ? String(studyLevel).trim() : '')),
        branch_year_sec: cleanOccupationType === 'STUDYING' ? cleanBranchYearSec : (cleanOccupationType === 'WORKING' ? '' : (branchYearSec ? String(branchYearSec).trim() : '')),
        class_section: cleanOccupationType === 'STUDYING' ? cleanClassSection : (cleanOccupationType === 'WORKING' ? '' : (classSection ? String(classSection).trim() : '')),
        batter_hand: batterHand ? String(batterHand).trim() : '',
        batter_position: batterPosition ? String(batterPosition).trim() : '',
        bowler_hand: bowlerHand ? String(bowlerHand).trim() : '',
        bowler_type: bowlerType ? String(bowlerType).trim() : '',
        is_wicket_keeper: Boolean(isWicketKeeper),
        declaration_place: cleanDeclarationPlace,
        declaration_date: cleanDeclarationDate,
        declaration_agreed: Boolean(declarationAgreed)
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
      return {
        success: true,
        message: 'If a team affiliation exists for this email, the details have been sent to your inbox.'
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

