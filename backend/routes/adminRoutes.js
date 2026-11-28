/**
 * routes/adminRoutes.js
 * Comprehensive Administrative & Association Management APIs
 */

const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const authService = require('../services/authService');
const tournamentController = require('../controllers/tournamentController');
const adminDashboardController = require('../controllers/adminDashboardController');
const { requireAdminAuth, requireSuperAdmin } = require('../middleware/authMiddleware');

const masterSettingController = require('../controllers/masterSettingController');
const { sendListResponse } = require('../utils/responseHelper');

/**
 * Public/Accredited Directory Reads:
 * GET /api/admin/officials & GET /api/admin/venues
 * Read access for certified scorers, umpires, and venues is accessible for match scheduling and official directories.
 * Creation, modification, and deletion strictly require ADMIN authorization below.
 */
router.get('/officials', async (req, res) => {
  try {
    const officials = await adminService.getOfficials();
    return sendListResponse(res, officials, { officials });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/venues', async (req, res) => {
  try {
    const venues = await adminService.getVenues();
    return sendListResponse(res, venues, { venues });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Enforce ADMIN role across all administrative management routes
router.use(requireAdminAuth);

/**
 * GET /api/admin/overview
 * Dashboard metrics summary
 */
router.get('/overview', async (req, res) => {
  try {
    const overview = await adminService.getAdminOverview();
    res.json({ success: true, data: overview });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/users
 * Manage players, team officials, scorers, content staff, admins
 */
router.get('/users', async (req, res) => {
  try {
    const { role, status } = req.query;
    const users = await adminService.getUsers(role, status);
    return sendListResponse(res, users, { users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/users
 * Directly create a new federation user (PLAYER, SCORER, UMPIRE, COACH, USER) as Admin
 */
router.post('/users', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const {
      name, email, mobile, phone, role, password, status, aadhaar,
      clubChoice, fatherName, dateOfBirth, age, placeOfBirth, address,
      occupationType, workingInstitution, studyingInstitution, studyLevel,
      branchYearSec, classSection, taluk, category,
      playingRole, battingStyle, bowlingStyle,
      batterHand, batterPosition, bowlerHand, bowlerType, isWicketKeeper,
      declarationPlace, declarationDate, photo, clientFaceAnalysis,
      certificationLevel, experience, experienceYears, qualification,
      certificationNumber, previousOrganization, specialization, district, state, additionalInfo
    } = req.body || {};
    if (!name || !String(name).trim() || !email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await db.models.User.findOne({ email: cleanEmail }).lean();
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }
    const targetRole = String(role || 'PLAYER').toUpperCase();
    if (targetRole === 'ADMIN' || targetRole === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Administrators must be added via Super Admin OTP governance.' });
    }
    const cleanMobile = (mobile || phone) ? String(mobile || phone).replace(/\D/g, '') : null;
    const cleanAadhaar = aadhaar ? String(aadhaar).replace(/\D/g, '') : null;
    let passwordHash = null;
    if (password && String(password).trim()) {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(String(password).trim(), 10);
    }
    const prefix = targetRole === 'PLAYER' ? 'PLY' : (targetRole === 'SCORER' ? 'SCR' : (targetRole === 'UMPIRE' ? 'UMP' : (targetRole === 'COACH' ? 'COACH' : 'USR')));
    const userId = `${prefix}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    let storedPhoto = photo || null;
    let photoPhash = null;
    let photoVerificationStatus = 'NONE';
    let photoVerificationReason = '';
    let photoMetadata = null;

    if (storedPhoto && typeof storedPhoto === 'string' && storedPhoto.startsWith('data:image/')) {
      const passportPhotoService = require('../services/passportPhotoService');
      const verified = await passportPhotoService.verifyAndProcessPassportPhoto({
        input: storedPhoto,
        email: cleanEmail,
        userId,
        clientFaceAnalysis
      });
      storedPhoto = verified.url;
      photoPhash = verified.phash;
      photoVerificationStatus = verified.verificationStatus;
      photoVerificationReason = verified.verificationReason;
      photoMetadata = verified.metadata;
    }

    const userDoc = {
      id: userId,
      name: String(name).trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      aadhaar: cleanAadhaar,
      role: targetRole,
      status: String(status || 'ACTIVE').toUpperCase(),
      password_hash: passwordHash,
      ...(storedPhoto ? {
        photo: storedPhoto,
        image_path: storedPhoto,
        photo_phash: photoPhash,
        photo_verification_status: photoVerificationStatus,
        photo_verification_reason: photoVerificationReason
      } : {})
    };

    if (targetRole === 'PLAYER') {
      userDoc.player_details = {
        role: playingRole || 'Batsman',
        playing_role: playingRole || 'Batsman',
        category: category || 'Senior Men',
        taluk: taluk || 'Virudhunagar',
        phone: cleanMobile,
        mobile: cleanMobile,
        aadhaar: cleanAadhaar,
        aadhaar_number: cleanAadhaar,
        batting_style: battingStyle || (batterHand === 'LH' ? 'Left-Handed Batsman' : 'Right-Handed Batsman'),
        bowling_style: bowlingStyle || (bowlerHand ? `${bowlerHand === 'LH' ? 'Left-arm' : 'Right-arm'} ${bowlerType || 'Medium'}` : 'Right-arm Fast'),
        club_choice: clubChoice ? String(clubChoice).trim() : '',
        father_name: fatherName ? String(fatherName).trim() : '',
        date_of_birth: dateOfBirth ? String(dateOfBirth).trim() : '',
        age: age ? String(age).trim() : '',
        place_of_birth: placeOfBirth ? String(placeOfBirth).trim() : '',
        address: address ? String(address).trim() : '',
        occupation_type: occupationType ? String(occupationType).trim() : '',
        working_institution: workingInstitution ? String(workingInstitution).trim() : '',
        studying_institution: studyingInstitution ? String(studyingInstitution).trim() : '',
        study_level: studyLevel ? String(studyLevel).trim() : '',
        branch_year_sec: branchYearSec ? String(branchYearSec).trim() : '',
        class_section: classSection ? String(classSection).trim() : '',
        batter_hand: batterHand || 'RH',
        batter_position: batterPosition || 'TOP_ORDER',
        bowler_hand: bowlerHand || '',
        bowler_type: bowlerType || '',
        is_wicket_keeper: Boolean(isWicketKeeper),
        declaration_place: declarationPlace ? String(declarationPlace).trim() : 'Virudhunagar',
        declaration_date: declarationDate ? String(declarationDate).trim() : new Date().toLocaleDateString('en-GB'),
        declaration_agreed: true,
        ...(storedPhoto ? {
          photo: storedPhoto,
          image_path: storedPhoto,
          photo_phash: photoPhash,
          photo_verification_status: photoVerificationStatus,
          photo_verification_reason: photoVerificationReason,
          photo_metadata: photoMetadata
        } : {})
      };
    } else if (targetRole === 'SCORER') {
      userDoc.scorer_details = {
        certification_level: certificationLevel || 'District Certified',
        taluk: taluk || 'Virudhunagar'
      };
    } else if (targetRole === 'UMPIRE') {
      userDoc.umpire_details = {
        certification_level: qualification || certificationLevel || 'Panel A - Senior',
        taluk: taluk || district || 'Virudhunagar',
        experience: experience || '',
        experience_years: Number(experienceYears || 0),
        qualification: qualification || '',
        certification_number: certificationNumber || '',
        previous_organization: previousOrganization || '',
        specialization: specialization || 'On-field Umpire',
        district: district || taluk || 'Virudhunagar',
        state: state || 'Tamil Nadu',
        additional_info: additionalInfo || ''
      };
    }

    const created = await db.models.User.create(userDoc);
    return res.status(201).json({ success: true, message: `User ${created.name} (${targetRole}) created.`, user: created });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Activate or suspend user
 */
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const adminEmail = req.adminUser?.email || 'system-admin';
    const user = await adminService.updateUserStatus(req.params.id, status, adminEmail);
    res.json({ success: true, message: `User status set to ${status}`, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/officials & DELETE /api/admin/officials/:id
 * Officials Management (scorers, umpires, match officials) - Admin Mutations
 */
router.post('/officials', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const official = await adminService.saveOfficial(req.body, adminEmail);
    res.json({ success: true, message: 'Official saved successfully', official });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/officials/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const result = await adminService.deleteOfficial(req.params.id, adminEmail);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/venues & DELETE /api/admin/venues/:id
 * Venue & Ground Management - Admin Mutations
 */
router.post('/venues', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const venue = await adminService.saveVenue(req.body, adminEmail);
    res.json({ success: true, message: 'Venue saved successfully', venue });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/venues/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const result = await adminService.deleteVenue(req.params.id, adminEmail);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/teams/pending
 * View pending teams awaiting approval with all 15 players
 */
router.get('/teams/pending', async (req, res) => {
  try {
    const teamRegistrationModel = require('../models/teamRegistrationModel');
    const pendingTeams = await teamRegistrationModel.getAll('PENDING');
    return sendListResponse(res, pendingTeams, { teams: pendingTeams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/teams & POST /api/admin/teams
 */
router.get('/teams', async (req, res) => {
  try {
    const status = req.query.status || null;
    const teamRegistrationModel = require('../models/teamRegistrationModel');
    const teams = await teamRegistrationModel.getAll(status);
    return sendListResponse(res, teams, { teams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/teams/:id
 * View team details, coach, and all 15 players
 */
router.get('/teams/:id', async (req, res) => {
  try {
    const teamRegistrationModel = require('../models/teamRegistrationModel');
    const team = await teamRegistrationModel.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: `Team '${req.params.id}' not found.` });
    }
    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/admin/teams/:id/approve & POST /api/admin/teams/:id/approve
 */
const handleApproveTeam = async (req, res) => {
  try {
    const adminId = req.adminUser?.email || 'ADMIN';
    const result = await authService.approveRegistration(req.params.id, 'TEAM', adminId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
router.put('/teams/:id/approve', handleApproveTeam);
router.post('/teams/:id/approve', handleApproveTeam);

/**
 * PUT /api/admin/teams/:id/reject & POST /api/admin/teams/:id/reject
 */
const handleRejectTeam = async (req, res) => {
  try {
    const adminId = req.adminUser?.email || 'ADMIN';
    const reason = req.body.reason || 'Criteria not met';
    const result = await authService.rejectRegistration(req.params.id, 'TEAM', reason, adminId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
router.put('/teams/:id/reject', handleRejectTeam);
router.post('/teams/:id/reject', handleRejectTeam);

router.post('/teams', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const team = await adminService.saveTeam(req.body, adminEmail);
    res.json({ success: true, message: 'Team saved successfully', team });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update Team Registration details & Coach/Team Password (Admin & Super Admin)
router.put('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { teamName, coachName, coachEmail, coachPhone, taluk, password } = req.body || {};
    const db = require('../config/db');
    await db.initDb();

    if (password && String(password).trim().length > 0 && String(password).trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const cleanTeamName = teamName !== undefined ? String(teamName).trim() : undefined;
    const cleanCoachName = coachName !== undefined ? String(coachName).trim() : undefined;
    const cleanCoachEmail = coachEmail !== undefined ? String(coachEmail).trim().toLowerCase() : undefined;
    const cleanCoachPhone = coachPhone !== undefined ? String(coachPhone).trim() : undefined;
    const cleanTaluk = taluk !== undefined ? String(taluk).trim() : undefined;

    let passwordHash = null;
    if (password && String(password).trim().length >= 6) {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(String(password).trim(), 10);
    }

    const reg = await db.models.TeamRegistration.findOne({ id });
    const teamDoc = await db.models.Team.findOne({ $or: [{ id }, { team_id: id }] });
    if (!reg && !teamDoc) {
      return res.status(404).json({ success: false, message: 'Team registration not found.' });
    }

    const oldCoachEmail = (reg?.coach_email || teamDoc?.coach_email || '').trim().toLowerCase();

    if (reg) {
      if (cleanTeamName) reg.team_name = cleanTeamName;
      if (cleanCoachName) reg.coach_name = cleanCoachName;
      if (cleanCoachEmail) reg.coach_email = cleanCoachEmail;
      if (cleanCoachPhone !== undefined) {
        reg.coach_phone = cleanCoachPhone;
        reg.phone = cleanCoachPhone;
      }
      if (cleanTaluk) {
        reg.taluk = cleanTaluk;
        reg.city = cleanTaluk;
      }
      if (passwordHash) {
        reg.password_hash = passwordHash;
      }
      await reg.save();
    }

    if (teamDoc) {
      if (cleanTeamName) {
        teamDoc.name = cleanTeamName;
        teamDoc.team_name = cleanTeamName;
      }
      if (cleanCoachName) teamDoc.coach_name = cleanCoachName;
      if (cleanCoachEmail) teamDoc.coach_email = cleanCoachEmail;
      if (cleanCoachPhone !== undefined) teamDoc.phone = cleanCoachPhone;
      if (cleanTaluk) {
        teamDoc.taluk = cleanTaluk;
        teamDoc.city = cleanTaluk;
      }
      if (passwordHash) {
        teamDoc.password_hash = passwordHash;
      }
      await teamDoc.save();
    }

    // Update or upsert Coach User record so login password/email stays in sync
    const lookupEmail = oldCoachEmail || cleanCoachEmail;
    if (lookupEmail) {
      const coachUser = await db.models.User.findOne({ email: lookupEmail });
      if (coachUser) {
        if (cleanCoachName) coachUser.name = cleanCoachName;
        if (cleanCoachEmail) coachUser.email = cleanCoachEmail;
        if (cleanCoachPhone !== undefined) coachUser.mobile = cleanCoachPhone;
        if (passwordHash) coachUser.password_hash = passwordHash;
        await coachUser.save();
      } else if (passwordHash && (cleanCoachEmail || oldCoachEmail)) {
        await db.models.User.create({
          id: `COACH-${Date.now()}`,
          name: cleanCoachName || reg?.coach_name || teamDoc?.coach_name || 'Team Coach',
          email: cleanCoachEmail || oldCoachEmail,
          mobile: cleanCoachPhone || reg?.coach_phone || teamDoc?.phone || null,
          role: 'COACH',
          password_hash: passwordHash,
          status: 'ACTIVE'
        });
      }
    }

    return res.json({
      success: true,
      message: passwordHash
        ? `Team "${cleanTeamName || reg?.team_name || teamDoc?.name}" updated & password changed successfully.`
        : `Team "${cleanTeamName || reg?.team_name || teamDoc?.name}" updated successfully.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update team.' });
  }
});

/**
 * Tournament Management APIs under /api/admin/tournaments
 */
router.get('/tournaments', (req, res) => tournamentController.getTournaments(req, res));
router.get('/tournaments/:id', (req, res) => tournamentController.getTournamentById(req, res));
router.post('/tournaments', (req, res) => tournamentController.createTournament(req, res));
router.put('/tournaments/:id', (req, res) => tournamentController.updateTournament(req, res));
router.delete('/tournaments/:id', (req, res) => tournamentController.deleteTournament(req, res));
router.post('/tournaments/:id/teams', (req, res) => tournamentController.addTeams(req, res));
router.delete('/tournaments/:id/teams/:teamId', (req, res) => tournamentController.removeTeam(req, res));
router.post('/tournaments/:id/generate-matches', (req, res) => tournamentController.generateMatches(req, res));
router.post('/tournaments/:id/preview-matches', (req, res) => tournamentController.previewMatches(req, res));
router.get('/tournaments/:id/schedule', (req, res) => tournamentController.getSchedule(req, res));
router.get('/tournaments/:id/points-table', (req, res) => tournamentController.getPointsTable(req, res));
router.get('/tournaments/:id/statistics', (req, res) => tournamentController.getStatistics(req, res));
router.get('/tournaments/:id/records', async (req, res) => {
  try {
    const { id } = req.params;
    const db = require('../config/db');
    const tournamentService = require('../services/tournamentService');
    await db.initDb();
    const tournament = await db.models.Tournament.findOne({ id }).lean();
    if (!tournament) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }
    const [pointsTable, statistics, matches] = await Promise.all([
      tournamentService.getPointsTable(id).catch(() => []),
      tournamentService.getStatistics(id).catch(() => ({})),
      db.models.Match.find({ tournament_id: id }).sort({ match_date: 1 }).lean().catch(() => [])
    ]);
    return res.json({
      success: true,
      tournament,
      pointsTable,
      standings: pointsTable,
      statistics,
      matches,
      records: {
        tournament,
        pointsTable,
        statistics,
        matches
      }
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});
router.get('/tournaments/registrations/all', (req, res) => tournamentController.getAllRegistrations(req, res));
router.patch('/tournaments/registrations/:regId/approve', (req, res) => tournamentController.approveRegistration(req, res));
router.post('/tournaments/registrations/:regId/approve', (req, res) => tournamentController.approveRegistration(req, res));
router.patch('/tournaments/registrations/:regId/reject', (req, res) => tournamentController.rejectRegistration(req, res));
router.post('/tournaments/registrations/:regId/reject', (req, res) => tournamentController.rejectRegistration(req, res));
router.get('/tournaments/:id/registrations', (req, res) => tournamentController.getAllRegistrations(req, res));
router.get('/tournaments/:id/approved-teams', (req, res) => tournamentController.getApprovedTeams(req, res));
router.patch('/tournaments/:id/status', (req, res) => tournamentController.updateStatus(req, res));
router.post('/tournaments/:id/groups/allocate', (req, res) => tournamentController.allocateGroups(req, res));
router.post('/tournaments/:id/groups/move-team', (req, res) => tournamentController.moveTeamBetweenGroups(req, res));
router.post('/tournaments/:id/groups/confirm', (req, res) => tournamentController.confirmGroups(req, res));
router.put('/tournaments/:id/qualification-config', (req, res) => tournamentController.updateQualificationConfig(req, res));
router.post('/tournaments/:id/preview-schedule', (req, res) => tournamentController.previewSchedule(req, res));
router.get('/tournaments/:id/standings', (req, res) => tournamentController.getStandings(req, res));
router.post('/tournaments/:id/resolve-tie', (req, res) => tournamentController.resolveManualTie(req, res));
router.post('/tournaments/:id/generate-next-stage', (req, res) => tournamentController.generateNextStage(req, res));
router.get('/tournaments/:id/bracket', (req, res) => tournamentController.getBracket(req, res));
router.post('/tournaments/:id/withdraw', (req, res) => tournamentController.withdrawTeam(req, res));
router.post('/tournaments/:id/eligibility-check', (req, res) => tournamentController.checkEligibility(req, res));
router.post('/tournaments/:id/simulate', (req, res) => tournamentController.simulateWhatIf(req, res));
router.get('/tournaments/:id/records', (req, res) => tournamentController.getTournamentRecords(req, res));
router.post('/tournaments/:id/records/import', (req, res) => tournamentController.importTournamentRecords(req, res));
router.post('/matches/:id/reverse-result', (req, res) => tournamentController.reverseMatchResult(req, res));

/**
 * Match Schedule Management APIs
 * GET /api/admin/matches - List all matches
 * POST /api/admin/matches/schedule - Create match schedule
 * PUT /api/admin/matches/:id - Update or reschedule match
 * PATCH /api/admin/matches/:id/cancel - Cancel match
 * DELETE /api/admin/matches/:id - Delete match
 */
router.get('/matches', async (req, res) => {
  try {
    const matches = await adminService.getMatches();
    return sendListResponse(res, matches, { matches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const handleScheduleMatch = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const match = await adminService.scheduleMatch(req.body, adminEmail);
    res.json({ success: true, message: 'Match scheduled successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message, message: err.message });
  }
};
router.post('/matches/schedule', handleScheduleMatch);
router.post('/matches', handleScheduleMatch);

const handleUpdateMatch = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const match = await adminService.updateMatch(req.params.id, req.body, adminEmail);
    res.json({ success: true, message: 'Match updated successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message, message: err.message });
  }
};
router.put('/matches/:id', handleUpdateMatch);
router.patch('/matches/:id', handleUpdateMatch);

const handleCancelMatch = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const reason = req.body?.reason || req.query?.reason;
    const match = await adminService.cancelMatch(req.params.id, reason, adminEmail);
    res.json({ success: true, message: 'Match cancelled successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
router.patch('/matches/:id/cancel', handleCancelMatch);
router.post('/matches/:id/cancel', handleCancelMatch);

const handlePostponeMatch = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const reason = req.body?.reason || req.query?.reason;
    const match = await adminService.postponeMatch(req.params.id, { reason }, adminEmail);
    res.json({ success: true, message: 'Match postponed successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message, message: err.message });
  }
};
router.post('/matches/:id/postpone', handlePostponeMatch);
router.patch('/matches/:id/postpone', handlePostponeMatch);

const handleConfirmSchedule = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const match = await adminService.confirmMatchSchedule(req.params.id, adminEmail);
    res.json({ success: true, message: 'Match schedule confirmed successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message, message: err.message });
  }
};
router.post('/matches/:id/confirm-schedule', handleConfirmSchedule);
router.patch('/matches/:id/confirm-schedule', handleConfirmSchedule);

const handleRescheduleMatch = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const { newDate, newTime, reason } = req.body;
    const match = await adminService.rescheduleMatch(req.params.id, { newDate, newTime, reason }, adminEmail);
    res.json({ success: true, message: 'Match rescheduled successfully', match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message, message: err.message });
  }
};
router.post('/matches/:id/reschedule', handleRescheduleMatch);
router.put('/matches/:id/reschedule', handleRescheduleMatch);

const handleGetPostponementRequests = async (req, res) => {
  try {
    const requests = await adminService.getPostponementRequests();
    return sendListResponse(res, requests, { requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
router.get('/matches/postponement-requests', handleGetPostponementRequests);

const handleReviewPostponementRequest = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const { decision, reviewNotes } = req.body;
    const match = await adminService.reviewUmpirePostponement(req.params.id, { decision, reviewNotes }, adminEmail);
    res.json({ success: true, message: `Postponement request ${decision}D successfully`, match });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message, message: err.message });
  }
};
router.post('/matches/:id/postponement-requests/review', handleReviewPostponementRequest);

router.delete('/matches/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const result = await adminService.deleteMatch(req.params.id, adminEmail);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/audit-logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await adminService.getAuditLogs();
    return sendListResponse(res, logs, { logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Two-Person Admin Approval
 */
router.get('/admins', async (req, res) => {
  try {
    const admins = await adminService.getAdmins();
    return sendListResponse(res, admins, { admins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admins/add/request', async (req, res) => {
  try {
    const { name, email, phone, username } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Full Name, Email, and Phone are required.' });
    }
    const result = await adminService.initiateAddAdminRequest({
      initiatorEmail: req.adminUser.email,
      name,
      email,
      phone,
      username,
      ip_address: req.ip || '127.0.0.1'
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admins/add/verify-current', async (req, res) => {
  try {
    const { requestId, otp } = req.body;
    const result = await adminService.verifyAddCurrentAdminOtp({
      requestId,
      otp,
      currentAdminEmail: req.adminUser.email
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admins/add/verify-target', async (req, res) => {
  try {
    const { requestId, otp, newAdminEmail } = req.body;
    const result = await adminService.verifyAddTargetAdminOtp({
      requestId,
      otp,
      newAdminEmail
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Super Admin Nodemailer Email OTP Verification & Dynamic Admin Management Endpoints
 * Invariant: Permanent Super Admin is system-admin. All other admins are dynamic.
 */
const superAdminOtpService = require('../services/superAdminOtpService');
const { verifySmtpConnection } = require('../config/mailer');

// SMTP Diagnostic Connection Status
router.get('/smtp/status', async (req, res) => {
  try {
    const status = await verifySmtpConnection();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test live email delivery diagnostic
router.post('/smtp/test-send', async (req, res) => {
  try {
    const { to } = req.body;
    const target = to || 'noreply@yourdomain.test';
    const { sendOtpEmail } = require('../config/mailer');
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await sendOtpEmail({
      toEmail: target,
      userName: 'CFVD Administrator',
      otp: testOtp
    });
    res.json({ success: true, target, otp: testOtp, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all administrators with Permanent Super Admin vs Dynamic status
router.get('/administrators', async (req, res) => {
  try {
    const list = await superAdminOtpService.getAdministratorsList();
    return sendListResponse(res, list, { administrators: list, permanentSuperAdmin: 'system-admin' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a new Administrator directly (Super Admin only)
router.post('/administrators', async (req, res) => {
  try {
    const caller = req.adminUser || req.user || {};
    if (!caller.is_super_admin && caller.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Super Administrators can add new admins.' });
    }

    const { name, email, mobile, password, admin_level } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }
    if (String(password).trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const db = require('../config/db');
    await db.initDb();

    const existing = await db.models.User.findOne({ email: cleanEmail }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: `An account with email '${cleanEmail}' already exists.` });
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(String(password).trim(), 12);
    const newId = `ADM-${Date.now()}`;

    const created = await db.models.User.create({
      id: newId,
      name: String(name).trim(),
      email: cleanEmail,
      mobile: mobile ? String(mobile).trim() : '',
      role: 'ADMIN',
      status: 'ACTIVE',
      is_super_admin: false,
      admin_level: (admin_level && String(admin_level).trim()) || 'District Administrator',
      password_hash: passwordHash
    });

    await superAdminOtpService.recordAuditLog({
      action: 'CREATE_ADMIN',
      initiatedBy: caller.email || 'super-admin',
      targetUser: cleanEmail,
      result: 'SUCCESS',
      details: `Super Admin created administrator ${created.name} (${created.id})`
    });

    const out = created.toObject();
    delete out.password_hash;
    return res.status(201).json({ success: true, message: `Administrator '${created.name}' added successfully.`, administrator: out });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to create administrator.' });
  }
});

// Update an Administrator (Super Admin only)
router.put('/administrators/:id', async (req, res) => {
  try {
    const caller = req.adminUser || req.user || {};
    if (!caller.is_super_admin && caller.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Super Administrators can edit admins.' });
    }

    const { id } = req.params;
    const { name, email, mobile, password, admin_level, status } = req.body || {};

    const db = require('../config/db');
    await db.initDb();

    const target = await db.models.User.findOne({ id });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Administrator not found.' });
    }
    if (target.is_super_admin || (target.email || '').toLowerCase() === superAdminOtpService.SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Cannot modify the permanent Super Administrator account.' });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Administrator name cannot be empty.' });
      }
      target.name = String(name).trim();
    }

    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Valid email address is required.' });
      }
      if (cleanEmail !== (target.email || '').toLowerCase()) {
        const dup = await db.models.User.findOne({ email: cleanEmail, id: { $ne: id } }).lean();
        if (dup) {
          return res.status(409).json({ success: false, message: `An account with email '${cleanEmail}' already exists.` });
        }
        target.email = cleanEmail;
      }
    }

    if (mobile !== undefined) {
      target.mobile = String(mobile).trim();
    }
    if (admin_level !== undefined) {
      target.admin_level = String(admin_level).trim() || 'District Administrator';
    }
    if (status !== undefined && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(String(status).toUpperCase())) {
      target.status = String(status).toUpperCase();
    }
    if (password && String(password).trim().length > 0) {
      if (String(password).trim().length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      }
      const bcrypt = require('bcryptjs');
      target.password_hash = await bcrypt.hash(String(password).trim(), 12);
    }

    await target.save();

    await superAdminOtpService.recordAuditLog({
      action: 'UPDATE_ADMIN',
      initiatedBy: caller.email || 'super-admin',
      targetUser: target.email,
      result: 'SUCCESS',
      details: `Super Admin updated administrator ${target.name} (${target.id})`
    });

    const out = target.toObject();
    delete out.password_hash;
    return res.json({ success: true, message: `Administrator '${target.name}' updated successfully.`, administrator: out });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update administrator.' });
  }
});

// Delete an Administrator (Super Admin only)
router.delete('/administrators/:id', async (req, res) => {
  try {
    const caller = req.adminUser || req.user || {};
    if (!caller.is_super_admin && caller.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Super Administrators can delete admins.' });
    }

    const { id } = req.params;
    const db = require('../config/db');
    await db.initDb();

    const target = await db.models.User.findOne({ id }).lean();
    if (!target) {
      return res.status(404).json({ success: false, message: 'Administrator not found.' });
    }
    if (target.is_super_admin || (target.email || '').toLowerCase() === superAdminOtpService.SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Cannot delete a Super Administrator account.' });
    }
    if (caller.id && caller.id === target.id) {
      return res.status(403).json({ success: false, message: 'You cannot delete your own active account.' });
    }

    await db.models.User.deleteOne({ id });

    await superAdminOtpService.recordAuditLog({
      action: 'DELETE_ADMIN',
      initiatedBy: caller.email || 'super-admin',
      targetUser: target.email,
      result: 'SUCCESS',
      details: `Super Admin removed administrator ${target.name} (${target.id})`
    });

    return res.json({ success: true, message: `Administrator '${target.name}' deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete administrator.' });
  }
});

// 1. Send / Request Super Admin Verification OTP
router.post('/otp/send', async (req, res) => {
  try {
    const { action, targetId, targetEmail, targetData } = req.body;
    const requesterEmail = req.user?.email || 'system-admin';
    const result = await superAdminOtpService.requestSuperAdminOtp({
      requesterEmail,
      action: action || 'ADMIN_OPERATION',
      targetId,
      targetEmail,
      targetData
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 2. Resend Super Admin Verification OTP
router.post('/otp/resend', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const requesterEmail = req.user?.email || 'system-admin';
    const result = await superAdminOtpService.resendSuperAdminOtp({
      sessionId,
      requesterEmail
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 3. Verify OTP & Execute Action
router.post('/otp/verify', async (req, res) => {
  try {
    const { sessionId, otp } = req.body;
    const requesterEmail = req.user?.email || 'system-admin';
    const result = await superAdminOtpService.verifyAndExecuteSuperAdminAction({
      sessionId,
      otp,
      requesterEmail
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 4. Create New Administrator Account (Initiate or Execute with OTP)
router.post('/create', async (req, res) => {
  try {
    const { sessionId, otp, name, email, mobile, password, roleLevel } = req.body;
    const requesterEmail = req.user?.email || 'system-admin';

    if (sessionId && otp) {
      const result = await superAdminOtpService.verifyAndExecuteSuperAdminAction({
        sessionId,
        otp,
        requesterEmail
      });
      return res.json(result);
    }

    // Initiate OTP request for creating admin
    const result = await superAdminOtpService.requestSuperAdminOtp({
      requesterEmail,
      action: 'CREATE_ADMIN',
      targetEmail: email,
      targetData: { name, email, mobile, password, roleLevel }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 5. Approve Pending Administrator Account (Initiate or Execute with OTP)
router.post('/approve', async (req, res) => {
  try {
    const { targetId, targetEmail, targetName, sessionId, otp } = req.body;
    const requesterEmail = req.user?.email || 'system-admin';

    if (sessionId && otp) {
      const result = await superAdminOtpService.verifyAndExecuteSuperAdminAction({
        sessionId,
        otp,
        requesterEmail
      });
      return res.json(result);
    }

    const result = await superAdminOtpService.requestSuperAdminOtp({
      requesterEmail,
      action: 'APPROVE_ADMIN',
      targetId,
      targetEmail,
      targetData: { name: targetName, email: targetEmail }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 6. Reject Pending Administrator Account (Initiate or Execute with OTP)
router.post('/reject', async (req, res) => {
  try {
    const { targetId, targetEmail, targetName, sessionId, otp } = req.body;
    const requesterEmail = req.user?.email || 'system-admin';

    if (sessionId && otp) {
      const result = await superAdminOtpService.verifyAndExecuteSuperAdminAction({
        sessionId,
        otp,
        requesterEmail
      });
      return res.json(result);
    }

    const result = await superAdminOtpService.requestSuperAdminOtp({
      requesterEmail,
      action: 'REJECT_ADMIN',
      targetId,
      targetEmail,
      targetData: { name: targetName }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Backward-compatible routes
router.post('/dual-auth/request', async (req, res) => {
  try {
    const { action, targetData } = req.body;
    const requesterEmail = req.user?.email || 'system-admin';
    const result = await superAdminOtpService.requestSuperAdminOtp({
      requesterEmail,
      action: action || 'CREATE_ADMIN',
      targetEmail: targetData?.email,
      targetData
    });
    res.json({
      success: true,
      authSessionId: result.sessionId,
      admin1Email: result.superAdminEmail,
      ...(require("../config/env").isDevelopment && result.demoOtp ? { demoOtps: { admin1: result.demoOtp } } : {}),
      ...result
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/dual-auth/verify', async (req, res) => {
  try {
    const { authSessionId, sessionId, admin1Otp, otp } = req.body;
    const requesterEmail = req.user?.email || 'system-admin';
    const activeOtp = otp || admin1Otp;
    const result = await superAdminOtpService.verifyAndExecuteSuperAdminAction({
      sessionId: sessionId || authSessionId,
      otp: activeOtp,
      requesterEmail
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * --------------------------------------------------------------------------
 * Content, News & Notices Management (Admin Only)
 * --------------------------------------------------------------------------
 */

// GET /api/admin/content - List all news & notices
router.get('/content', async (req, res) => {
  try {
    const { category, status, search, limit } = req.query;
    const articles = await adminService.getContentList({ category, status, search, limit });
    return sendListResponse(res, articles);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/content/stats - Content counts by category & status
router.get('/content/stats', async (req, res) => {
  try {
    const stats = await adminService.getContentStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/content - Create news/notice
router.post('/content', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const article = await adminService.createContent(req.body, adminEmail);
    res.status(201).json({ success: true, message: 'Article published successfully', data: article });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/content/:id - Edit news/notice
router.put('/content/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const updated = await adminService.updateContent(req.params.id, req.body, adminEmail);
    res.json({ success: true, message: 'Article updated successfully', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/content/:id - Delete news/notice
router.delete('/content/:id', async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'system-admin';
    const result = await adminService.deleteContent(req.params.id, adminEmail);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRICKET LAWS MANAGEMENT (MCC 2017 Code – Fourth Edition 2026)
// All routes protected by requireAdminAuth (already applied at top of this router)
// ─────────────────────────────────────────────────────────────────────────────
const cricketLawsCtrl = require('../controllers/cricketLawsController');

/**
 * GET /api/admin/cricket-laws – List all laws (same as public but with admin context)
 */
router.get('/cricket-laws', cricketLawsCtrl.getAllLaws);

/**
 * GET /api/admin/cricket-laws/stats – Dashboard statistics
 */
router.get('/cricket-laws/stats', cricketLawsCtrl.getLawStats);

/**
 * GET /api/admin/cricket-laws/audit-logs – View change history
 */
router.get('/cricket-laws/audit-logs', cricketLawsCtrl.getAuditLogs);

/**
 * GET /api/admin/cricket-laws/categories – Category list
 */
router.get('/cricket-laws/categories', cricketLawsCtrl.getLawCategories);

/**
 * GET /api/admin/cricket-laws/search – Keyword search
 */
router.get('/cricket-laws/search', cricketLawsCtrl.searchLaws);

/**
 * GET /api/admin/cricket-laws/:id – Single law with sections
 */
router.get('/cricket-laws/:id', cricketLawsCtrl.getLawById);

/**
 * POST /api/admin/cricket-laws – Create a new law
 */
router.post('/cricket-laws', cricketLawsCtrl.createLaw);

/**
 * PUT /api/admin/cricket-laws/:id – Update law
 */
router.put('/cricket-laws/:id', cricketLawsCtrl.updateLaw);

/**
 * POST /api/admin/cricket-laws/:id/sections – Add section to law
 */
router.post('/cricket-laws/:id/sections', cricketLawsCtrl.addSection);

/**
 * POST /api/admin/cricket-laws/:id/publish – Publish/verify law
 */
router.post('/cricket-laws/:id/publish', cricketLawsCtrl.publishLaw);

// ─────────────────────────────────────────────────────────────────────────────
// TOURNAMENT CALCULATION SETTINGS (DLS / VJD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/tournaments/:tournamentId/calculation-settings
 * Get DLS/VJD setting for a specific tournament
 */
router.get('/tournaments/:tournamentId/calculation-settings', cricketLawsCtrl.getCalculationSettings);

/**
 * PUT /api/admin/tournaments/:tournamentId/calculation-settings
 * Update DLS/VJD method for a specific tournament
 */
router.put('/tournaments/:tournamentId/calculation-settings', cricketLawsCtrl.updateCalculationSettings);

/**
 * POST /api/admin/calculate-prediction – Live DLS/VJD calculation
 */
router.post('/calculate-prediction', cricketLawsCtrl.calculatePrediction);
/**
 * --------------------------------------------------------------------------
 * Admin Panel Dedicated Endpoints (powering mobile_frontend/src/admin)
 * --------------------------------------------------------------------------
 */
router.get('/dashboard-stats', (req, res) => adminDashboardController.getDashboardStats(req, res));
router.put('/users/:id', (req, res) => adminDashboardController.updateUser(req, res));
router.delete('/users/:id', (req, res) => adminDashboardController.deleteUser(req, res));

router.get('/approvals', (req, res) => adminDashboardController.getApprovals(req, res));
router.post('/approvals/:type/:id', (req, res) => adminDashboardController.handleApproval(req, res));

router.get('/notifications', (req, res) => adminDashboardController.getNotifications(req, res));
router.post('/notifications', (req, res) => adminDashboardController.createNotification(req, res));
router.patch('/notifications/:id/read', (req, res) => adminDashboardController.markNotificationRead(req, res));
router.delete('/notifications/:id', (req, res) => adminDashboardController.deleteNotification(req, res));

// Super Admin Activity Notifications (DB-persisted audit of all Admin add/edit/delete changes)
router.get('/super-admin-notifications', requireSuperAdmin, (req, res) => adminDashboardController.getSuperAdminNotifications(req, res));
router.patch('/super-admin-notifications/read-all', requireSuperAdmin, (req, res) => adminDashboardController.markAllSuperAdminNotificationsRead(req, res));
router.patch('/super-admin-notifications/:id/read', requireSuperAdmin, (req, res) => adminDashboardController.markSuperAdminNotificationRead(req, res));
router.delete('/super-admin-notifications/:id', requireSuperAdmin, (req, res) => adminDashboardController.deleteSuperAdminNotification(req, res));

router.get('/teams-list', (req, res) => adminDashboardController.getTeams(req, res));
router.get('/teams-list/:id', (req, res) => adminDashboardController.getTeamById(req, res));
router.patch('/teams-list/:id/status', (req, res) => adminDashboardController.updateTeamStatus(req, res));

router.get('/players', (req, res) => adminDashboardController.getPlayers(req, res));
router.post('/players', (req, res) => adminDashboardController.createPlayer(req, res));
router.put('/players/:id', (req, res) => adminDashboardController.updatePlayer(req, res));

router.get('/live-scoring', (req, res) => adminDashboardController.getLiveScoring(req, res));
router.get('/statistics', (req, res) => adminDashboardController.getStatistics(req, res));
router.get('/settings', (req, res) => adminDashboardController.getSettings(req, res));
router.put('/settings', (req, res) => adminDashboardController.updateSettings(req, res));

// MASTER SETTINGS & DYNAMIC SUBCATEGORIES (Taluk, Roles, Batting, Age, Certifications, State)
router.get('/master-settings', (req, res) => masterSettingController.getSettings(req, res));
router.post('/master-settings', (req, res) => masterSettingController.createSetting(req, res));
router.put('/master-settings/:id', (req, res) => masterSettingController.updateSetting(req, res));
router.delete('/master-settings/:id', (req, res) => masterSettingController.deleteSetting(req, res));

// HOME PORTAL POPUP ALERT (Admin Dynamic Config)
router.get('/home-popup', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const record = await db.models.MasterSetting.findOne({ id: 'PORTAL_HOME_POPUP' }).lean();
    let config = {
      enabled: false,
      presetKey: 'match_notice',
      badgeText: 'OFFICIAL MATCH & RULES NOTICE',
      imageKey: 'stadium',
      customImageUrl: '',
      title: 'Virudhunagar Premier League 2026 — Match & Rules Notice',
      message: 'Check upcoming match schedules, venue allocations, and official CFVD tournament rules & regulations before match day.',
      highlightText: 'All participating teams must report 45 minutes prior to toss with verified squad IDs.',
      buttonText: 'View Match Schedules →',
      buttonDestination: 'matches'
    };
    if (record?.description) {
      try {
        const parsed = JSON.parse(record.description);
        config = { ...config, ...parsed, enabled: Boolean(record.is_active) };
      } catch (_e) {}
    }
    res.json({ success: true, popup: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/home-popup', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    let customImg = String(req.body.customImageUrl || '').trim();
    if (customImg.startsWith('data:image/')) {
      const cloudinaryService = require('../services/cloudinaryService');
      if (cloudinaryService.isConfigured()) {
        const cloudRes = await cloudinaryService.uploadImage(customImg, {
          folder: 'cfvd/popups',
          publicId: `popup_${Date.now()}`
        });
        if (cloudRes.uploaded && cloudRes.url) {
          customImg = cloudRes.url;
        }
      }
    }

    const payload = {
      enabled: Boolean(req.body.enabled),
      presetKey: String(req.body.presetKey || 'custom'),
      badgeText: String(req.body.badgeText || 'OFFICIAL CFVD NOTICE').trim(),
      imageKey: String(req.body.imageKey || 'stadium'),
      customImageUrl: customImg,
      title: String(req.body.title || '').trim(),
      message: String(req.body.message || '').trim(),
      highlightText: String(req.body.highlightText || '').trim(),
      buttonText: String(req.body.buttonText || 'View Details →').trim(),
      buttonDestination: String(req.body.buttonDestination || 'matches')
    };

    if (!payload.title) {
      return res.status(400).json({ success: false, error: 'Popup title is required.' });
    }

    await db.models.MasterSetting.findOneAndUpdate(
      { id: 'PORTAL_HOME_POPUP' },
      {
        $set: {
          id: 'PORTAL_HOME_POPUP',
          category: 'portal_home_popup',
          name: 'Home Portal Popup',
          code: 'HOME_POPUP_CONFIG',
          description: JSON.stringify(payload),
          is_active: payload.enabled,
          updated_at: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, popup: payload, message: 'Home Portal Popup settings saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ADMIN EMBLEM STEALTH ACCESS SEQUENCE (Enable/Disable + Custom Ball Order)
router.get('/emblem-sequence', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const record = await db.models.MasterSetting.findOne({ id: 'ADMIN_EMBLEM_SEQUENCE' }).lean();
    let config = {
      enabled: true,
      sequence: ['LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'CENTER']
    };
    if (record?.description) {
      try {
        const parsed = JSON.parse(record.description);
        if (Array.isArray(parsed.sequence)) {
          config = {
            enabled: Boolean(record.is_active),
            sequence: parsed.sequence
          };
        }
      } catch (_e) {}
    }
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/emblem-sequence', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const enabled = Boolean(req.body.enabled);
    const rawSeq = Array.isArray(req.body.sequence) ? req.body.sequence : [];
    const allowed = new Set(['LEFT', 'RIGHT', 'CENTER']);
    const sequence = rawSeq.map(s => String(s).toUpperCase().trim()).filter(s => allowed.has(s));

    if (enabled && (sequence.length < 1 || sequence.length > 12)) {
      return res.status(400).json({
        success: false,
        error: 'Sequence must contain between 1 and 12 ball taps when enabled.'
      });
    }

    const payload = { enabled, sequence };
    await db.models.MasterSetting.findOneAndUpdate(
      { id: 'ADMIN_EMBLEM_SEQUENCE' },
      {
        $set: {
          id: 'ADMIN_EMBLEM_SEQUENCE',
          category: 'admin_security',
          name: 'Admin Emblem Stealth Sequence',
          code: 'ADMIN_EMBLEM_SEQUENCE',
          description: JSON.stringify(payload),
          is_active: enabled,
          updated_at: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, config: payload, message: 'Admin Emblem access sequence updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ASSOCIATION RULE 15 (Dynamic Minimum Players Per Team for Match Attendance)
router.get('/rule-15', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const record = await db.models.MasterSetting.findOne({ id: 'ADMIN_RULE_15' }).lean();
    let config = {
      enabled: true,
      minPlayers: 9,
      ruleText: ''
    };
    if (record?.description) {
      try {
        const parsed = JSON.parse(record.description);
        const parsedMin = parseInt(parsed.minPlayers, 10);
        config = {
          enabled: record.is_active !== false,
          minPlayers: (!isNaN(parsedMin) && parsedMin >= 1 && parsedMin <= 11) ? parsedMin : 9,
          ruleText: typeof parsed.ruleText === 'string' ? parsed.ruleText : ''
        };
      } catch (_e) {}
    }
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/rule-15', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const enabled = req.body.enabled !== false;
    const minPlayers = parseInt(req.body.minPlayers, 10);
    const ruleText = typeof req.body.ruleText === 'string' ? req.body.ruleText.trim() : '';

    if (isNaN(minPlayers) || minPlayers < 1 || minPlayers > 11) {
      return res.status(400).json({
        success: false,
        error: 'Minimum players must be a whole number between 1 and 11.'
      });
    }

    const payload = { enabled, minPlayers, ruleText };
    await db.models.MasterSetting.findOneAndUpdate(
      { id: 'ADMIN_RULE_15' },
      {
        $set: {
          id: 'ADMIN_RULE_15',
          category: 'association_rules',
          name: 'Association Rule 15 - Match Attendance Requirement',
          code: 'ADMIN_RULE_15',
          description: JSON.stringify(payload),
          is_active: enabled,
          updated_at: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, config: payload, message: `Rule 15 updated (Min ${minPlayers} players per team).` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const DEFAULT_COMMITTEE_CONFIG = {
  enabled: true,
  sectionTitle: 'Tournament Committee & Office Bearers',
  roles: [
    { roleTitle: 'Tournament Coordinator', members: 'D. Saravanamuthu (Assistant Secretary)' },
    { roleTitle: 'Assistants', members: 'Thangamarimuthu (JC), B. Sri Vallaba Ganesh (Redrose)' },
    { roleTitle: 'Registration Coordinators', members: 'M. Suresh (Yazhini), Christopher (Yazhini)' },
    { roleTitle: 'Umpire & Scorer Coordinator', members: 'S. Kabirthasan • Assistants: G. Sankar (Nature), Guhan (Sasinagar)' },
    { roleTitle: 'Media Coordinators', members: 'R. Sankar (Joint Secretary), M. Manikannan (Miraculous)' }
  ],
  groundInCharges: [
    { groundName: 'Ramco Cements Turf', inCharge: 'Ramco' },
    { groundName: 'CFVD Ground', inCharge: 'Shooters' },
    { groundName: 'Mepco', inCharge: 'Physical Education Director' },
    { groundName: 'PACR', inCharge: 'Ramco' },
    { groundName: 'AAA', inCharge: 'War Horses & Leo Sports' },
    { groundName: 'MCC', inCharge: 'Mathai' }
  ],
  teamNotice: 'On every match day, each team must nominate 3 members from their squad for match official duties. We kindly request everyone to keep the ground clean.',
  signatoryTitle: 'Secretary',
  signatoryName: 'P. Mohanraj',
  noticeDate: '21.11.2026'
};

// ASSOCIATION OFFICE BEARERS & GROUND IN-CHARGES (Displayed on Public Website)
router.get('/committee-members', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const record = await db.models.MasterSetting.findOne({ id: 'ADMIN_COMMITTEE_MEMBERS' }).lean();
    let config = { ...DEFAULT_COMMITTEE_CONFIG };
    if (record?.description) {
      try {
        const parsed = JSON.parse(record.description);
        config = {
          ...DEFAULT_COMMITTEE_CONFIG,
          ...parsed,
          enabled: record.is_active !== false
        };
      } catch (_e) {}
    }
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/committee-members', async (req, res) => {
  try {
    const db = require('../config/db');
    await db.initDb();
    const enabled = req.body.enabled !== false;
    const sectionTitle = String(req.body.sectionTitle || DEFAULT_COMMITTEE_CONFIG.sectionTitle).trim();
    const roles = Array.isArray(req.body.roles)
      ? req.body.roles
          .map(r => ({
            roleTitle: String(r?.roleTitle || '').trim(),
            members: String(r?.members || '').trim()
          }))
          .filter(r => r.roleTitle && r.members)
      : [];
    const groundInCharges = Array.isArray(req.body.groundInCharges)
      ? req.body.groundInCharges
          .map(g => ({
            groundName: String(g?.groundName || '').trim(),
            inCharge: String(g?.inCharge || '').trim()
          }))
          .filter(g => g.groundName && g.inCharge)
      : [];

    const payload = {
      enabled,
      sectionTitle,
      roles,
      groundInCharges,
      teamNotice: String(req.body.teamNotice || '').trim(),
      signatoryTitle: String(req.body.signatoryTitle || 'Secretary').trim(),
      signatoryName: String(req.body.signatoryName || '').trim(),
      noticeDate: String(req.body.noticeDate || '').trim()
    };

    await db.models.MasterSetting.findOneAndUpdate(
      { id: 'ADMIN_COMMITTEE_MEMBERS' },
      {
        $set: {
          id: 'ADMIN_COMMITTEE_MEMBERS',
          category: 'association_committee',
          name: 'Tournament Committee & Office Bearers',
          code: 'ADMIN_COMMITTEE_MEMBERS',
          description: JSON.stringify(payload),
          is_active: enabled,
          updated_at: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, config: payload, message: 'Office Bearers & Ground In-Charges updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS CONTROL & DUAL-ADMIN APPROVAL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const adminAccessController = require('../controllers/adminAccessController');

router.get('/access/admins', (req, res) => adminAccessController.getAdmins(req, res));
router.get('/access/candidates', (req, res) => adminAccessController.getCandidates(req, res));
router.post('/access/promote/request', (req, res) => adminAccessController.requestPromote(req, res));
router.post('/access/requests/:id/verify', (req, res) => adminAccessController.verifyDualOtp(req, res));
router.post('/access/requests/:id/resend', (req, res) => adminAccessController.resendDualOtp(req, res));
router.post('/access/promote/:id/candidate-verify', (req, res) => adminAccessController.verifyCandidateOtp(req, res));
router.post('/access/remove/request', (req, res) => adminAccessController.requestRemove(req, res));
router.post('/access/remove/:id/verify', (req, res) => adminAccessController.verifyRemove(req, res));
router.get('/access/requests', (req, res) => adminAccessController.getRequests(req, res));
router.get('/access/audit', (req, res) => adminAccessController.getAudit(req, res));

// Security endpoint aliases (Section 8)
router.post('/security/promotion/request', (req, res) => adminAccessController.requestPromote(req, res));
router.post('/security/promotion/send-otp', (req, res) => adminAccessController.resendDualOtp(req, res));
router.post('/security/promotion/verify', (req, res) => adminAccessController.verifyDualOtp(req, res));
router.post('/security/promotion/finalize', (req, res) => adminAccessController.verifyCandidateOtp(req, res));
router.post('/security/removal/request', (req, res) => adminAccessController.requestRemove(req, res));
router.post('/security/removal/send-otp', (req, res) => adminAccessController.resendDualOtp(req, res));
router.post('/security/removal/verify', (req, res) => adminAccessController.verifyRemove(req, res));
router.post('/security/removal/finalize', (req, res) => adminAccessController.verifyRemove(req, res));
router.get('/security/admins', (req, res) => adminAccessController.getAdmins(req, res));
router.get('/security/requests', (req, res) => adminAccessController.getRequests(req, res));
router.get('/security/audit-logs', (req, res) => adminAccessController.getAudit(req, res));

// Email/OTP Quota & Delivery Status (Admin Only)
router.get('/email-status', requireAdminAuth, async (req, res) => {
  try {
    const { getDailyEmailStatus } = require('../config/mailer');
    const status = await getDailyEmailStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Passport Photo Manual Verification (Approve / Reject)
router.patch('/users/:id/photo-verification', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || '').toUpperCase().trim();
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be VERIFIED or REJECTED.' });
    }
    const rawReason = String(req.body?.reason || '').trim();
    if (status === 'REJECTED' && !rawReason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required when rejecting a photo.' });
    }
    const reason = rawReason || 'Approved by Administrator.';

    const db = require('../config/db');
    await db.initDb();
    const user = await db.models.User.findOne({ id }).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const adminEmail = req.adminUser?.email || 'ADMIN';
    const now = new Date();
    const historyEntry = {
      status,
      reason,
      actor: adminEmail,
      actor_role: 'ADMIN',
      photo: user.photo || user.image_path || null,
      timestamp: now
    };
    const updateFields = {
      photo_verification_status: status,
      photo_verification_reason: reason,
      photo_verified_by: adminEmail,
      photo_verified_at: now,
      photo_status: status === 'VERIFIED' ? 'APPROVED' : 'REJECTED',
      'player_details.photo_verification_status': status,
      'player_details.photo_verification_reason': reason,
      'player_details.photo_verified_by': adminEmail,
      'player_details.photo_verified_at': now
    };

    await Promise.all([
      db.models.User.updateOne(
        { id },
        { $set: updateFields, $push: { photo_verification_history: historyEntry } }
      ),
      db.models.Player.updateMany(
        { $or: [{ id }, ...(user.email ? [{ email: user.email }] : [])] },
        {
          $set: {
            photo_verification_status: status,
            photo_verification_reason: reason,
            photo_verified_by: adminEmail,
            photo_verified_at: now,
            photo_status: status === 'VERIFIED' ? 'APPROVED' : 'REJECTED'
          },
          $push: { photo_verification_history: historyEntry }
        }
      ),
      db.models.Notification.create({
        id: `NOTIF-PHOTO-${Date.now()}`,
        type: 'PHOTO_VERIFICATION',
        title: status === 'VERIFIED' ? 'Passport Photo Verified' : 'Passport Photo Rejected',
        message: status === 'VERIFIED'
          ? `Your passport photo has been verified by CFVD Admin.`
          : `Your passport photo was rejected: ${reason}. Please upload a replacement photo.`,
        target_user_id: id,
        target_email: user.email || null,
        status: 'UNREAD'
      })
    ]);

    const updatedUser = await db.models.User.findOne({ id }).select('photo_verification_history').lean();
    return res.json({
      success: true,
      message: `Player photo marked as ${status}.`,
      photo_verification_status: status,
      photo_verification_reason: reason,
      photo_verification_history: updatedUser?.photo_verification_history || [historyEntry]
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

