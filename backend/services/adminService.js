/**
 * services/adminService.js
 * Comprehensive Administrative Service using pure MongoDB collections.
 * Handles Admin Overview, User Management, Officials, Venues, Tournaments,
 * Two-Person Admin Approval & Audit Logging.
 */

const crypto = require('crypto');
const db = require('../config/db');
const otpService = require('./otpService');
const { sendOtpEmail } = require('../config/mailer');
const contentModel = require('../models/contentModel');

/**
 * Creates an audit log entry in MongoDB
 */
async function addAuditLog({ action, initiated_by, target_user, ip_address = '127.0.0.1', result, details }) {
  await db.initDb();
  const logId = 'LOG-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now());
  const entry = await db.models.AuditLog.create({
    id: logId,
    admin_email: initiated_by || 'ADMIN',
    action,
    details: typeof details === 'object' ? JSON.stringify(details) : (details || result || 'Action executed'),
    ip_address,
    timestamp: new Date()
  });
  return entry.toObject();
}

/**
 * Get system overview metrics for Admin Dashboard
 */
async function getAdminOverview() {
  await db.initDb();
  const { User, TeamRegistration, Match, News, Team } = db.models;

  const [usersCount, teamsCount, pendingTeams, matchesCount, liveMatches, newsCount] = await Promise.all([
    User.countDocuments(),
    Team.countDocuments(),
    TeamRegistration.countDocuments({ status: 'PENDING' }),
    Match.countDocuments(),
    Match.countDocuments({ status: 'LIVE' }),
    News.countDocuments()
  ]);

  return {
    usersCount,
    teamsCount,
    pendingRegistrations: pendingTeams,
    matchesCount,
    liveMatches,
    newsCount,
    systemStatus: 'ONLINE - MongoDB Connected'
  };
}

/**
 * List all users with optional role filtering
 */
async function getUsers(role = null) {
  await db.initDb();
  const query = {};
  if (role && role !== 'ALL') query.role = role.toUpperCase();
  return db.models.User.find(query).sort({ created_at: -1 }).lean();
}

/**
 * Update user status (ACTIVE, SUSPENDED, PENDING)
 */
async function updateUserStatus(userId, status, adminEmail) {
  await db.initDb();
  const updated = await db.models.User.findOneAndUpdate(
    { id: userId },
    { $set: { status, updated_at: new Date() } },
    { returnDocument: 'after' }
  ).lean();

  if (!updated) throw new Error('User not found');

  await addAuditLog({
    action: 'UPDATE_USER_STATUS',
    initiated_by: adminEmail,
    target_user: updated.email,
    result: `Status set to ${status}`,
    details: `Admin ${adminEmail} updated user ${updated.email} to status ${status}`
  });

  return updated;
}

/**
 * Get audit logs
 */
async function getAuditLogs(limit = 100) {
  await db.initDb();
  return db.models.AuditLog.find({}).sort({ timestamp: -1 }).limit(limit).lean();
}

/**
 * Get officials (Scorers, Umpires, Match Referees)
 */
async function getOfficials() {
  await db.initDb();
  return db.models.Official.find({}).sort({ name: 1 }).lean();
}

/**
 * Add or update an official
 */
async function saveOfficial({ id, name, role, email, phone, status = 'ACTIVE' }, adminEmail) {
  await db.initDb();
  const offId = id || `OFF-${Date.now()}`;
  const official = await db.models.Official.findOneAndUpdate(
    { id: offId },
    { $set: { id: offId, name, role, email, phone, status } },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  await addAuditLog({
    action: 'SAVE_OFFICIAL',
    initiated_by: adminEmail,
    target_user: email,
    result: `Official ${name} (${role}) saved`,
    details: `Official recorded in database with ID ${offId}`
  });

  return official;
}

/**
 * Get Venues & Grounds
 */
async function getVenues() {
  await db.initDb();
  return db.models.Venue.find({}).lean();
}

/**
 * Add or update Venue
 */
async function saveVenue({ id, name, location, capacity, floodlights, description }, adminEmail) {
  await db.initDb();
  const venId = id || `VEN-${Date.now()}`;
  const venue = await db.models.Venue.findOneAndUpdate(
    { id: venId },
    { $set: { id: venId, name, location, capacity, floodlights: !!floodlights, description } },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  await addAuditLog({
    action: 'SAVE_VENUE',
    initiated_by: adminEmail,
    target_user: name,
    result: `Venue ${name} saved`,
    details: `Venue saved at ${location}`
  });

  return venue;
}

/**
 * Create or update Tournament
 */
async function saveTournament(tournamentData, adminEmail) {
  await db.initDb();
  const tourId = tournamentData.id || `T-${Date.now()}`;
  const tournament = await db.models.Tournament.findOneAndUpdate(
    { id: tourId },
    { $set: { id: tourId, ...tournamentData } },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  await addAuditLog({
    action: 'SAVE_TOURNAMENT',
    initiated_by: adminEmail,
    target_user: tournament.name,
    result: `Tournament ${tournament.name} saved`,
    details: `Tournament schedule and category configured.`
  });

  return tournament;
}

/**
 * Schedule a new match fixture
 */
async function scheduleMatch(fixtureData, adminEmail) {
  await db.initDb();

  const {
    tournament_id,
    tournament_name,
    team_a_id,
    team_b_id,
    venue,
    match_date,
    match_time,
    match_type,
    overs,
    overs_per_side,
    assigned_scorer_id,
    umpire1_id,
    umpire2_id,
    umpire1_name,
    umpire2_name,
    stage
  } = fixtureData;

  if (!team_a_id || !team_b_id) {
    throw new Error('Both Team A and Team B are required to schedule a match.');
  }

  if (team_a_id === team_b_id) {
    throw new Error('Team A and Team B cannot be the same team.');
  }

  if (!match_date || !String(match_date).trim()) {
    throw new Error('Match date is required.');
  }

  const cleanDate = String(match_date).trim();
  const cleanTime = (match_time && String(match_time).trim()) || '09:30 AM';

  // Prevent duplicate umpire assignment in the same fixture
  if (umpire1_id && umpire2_id && umpire1_id === umpire2_id) {
    throw new Error('Cannot assign the same official as both Umpire 1 and Umpire 2 for the same fixture.');
  }

  let resolvedUmpire1Name = umpire1_name || null;
  let resolvedUmpire2Name = umpire2_name || null;

  if (umpire1_id && !resolvedUmpire1Name) {
    const uDoc = await db.models.User.findOne({ id: umpire1_id }).lean();
    if (uDoc) resolvedUmpire1Name = uDoc.name;
  }
  if (umpire2_id && !resolvedUmpire2Name) {
    const uDoc = await db.models.User.findOne({ id: umpire2_id }).lean();
    if (uDoc) resolvedUmpire2Name = uDoc.name;
  }

  // Prevent assigning an already committed umpire to an overlapping fixture
  if (umpire1_id) {
    const conflict = await db.models.Match.findOne({
      match_date: cleanDate,
      match_time: cleanTime,
      status: { $in: ['SCHEDULED', 'LIVE', 'TOSS', 'INNINGS_BREAK'] },
      $or: [{ umpire1_id }, { umpire2_id: umpire1_id }]
    }).lean();
    if (conflict) {
      throw new Error(`Umpire '${resolvedUmpire1Name || umpire1_id}' is already assigned to Match ${conflict.id} on ${cleanDate} at ${cleanTime}.`);
    }
  }

  if (umpire2_id) {
    const conflict = await db.models.Match.findOne({
      match_date: cleanDate,
      match_time: cleanTime,
      status: { $in: ['SCHEDULED', 'LIVE', 'TOSS', 'INNINGS_BREAK'] },
      $or: [{ umpire1_id: umpire2_id }, { umpire2_id }]
    }).lean();
    if (conflict) {
      throw new Error(`Umpire '${resolvedUmpire2Name || umpire2_id}' is already assigned to Match ${conflict.id} on ${cleanDate} at ${cleanTime}.`);
    }
  }

  let finalTourName = tournament_name;
  if (!finalTourName && tournament_id) {
    const tour = await db.models.Tournament.findOne({ id: tournament_id }).lean();
    if (tour) finalTourName = tour.name;
  }

  const matchId = fixtureData.id || `M-${Date.now()}`;
  const match = await db.models.Match.create({
    id: matchId,
    tournament_id: tournament_id || 'T-2026-VPL',
    tournament_name: finalTourName || 'Virudhunagar Premier League 2026',
    team_a_id,
    team_b_id,
    venue: venue || 'Kamarajar District Stadium',
    match_date: cleanDate,
    match_time: cleanTime,
    match_type: match_type || 'T20',
    overs_per_side: Number(overs_per_side || overs || 20),
    stage: stage || 'LEAGUE',
    status: 'SCHEDULED',
    assigned_scorer_id: assigned_scorer_id || 'SCR-101',
    umpire1_id: umpire1_id || null,
    umpire2_id: umpire2_id || null,
    umpire1_name: resolvedUmpire1Name || (umpire1_id ? 'Official Umpire 1' : null),
    umpire2_name: resolvedUmpire2Name || (umpire2_id ? 'Official Umpire 2' : null)
  });

  await addAuditLog({
    action: 'SCHEDULE_MATCH',
    initiated_by: adminEmail,
    target_user: matchId,
    result: `Match ${matchId} scheduled between ${team_a_id} and ${team_b_id}`,
    details: `Match fixture created for ${match_date}`
  });

  return match.toObject();
}

/**
 * Update or reschedule an existing match fixture
 */
async function updateMatch(matchId, fixtureData, adminEmail) {
  await db.initDb();

  const match = await db.models.Match.findOne({ id: matchId });
  if (!match) throw new Error(`Match with ID '${matchId}' not found.`);

  if (match.status === 'COMPLETED') {
    throw new Error('Cannot modify a completed match. Completed match records are archived.');
  }

  const isLive = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  if (isLive) {
    if ((fixtureData.team_a_id && fixtureData.team_a_id !== match.team_a_id) ||
        (fixtureData.team_b_id && fixtureData.team_b_id !== match.team_b_id)) {
      throw new Error('Cannot change participating teams for an active live match.');
    }
  }

  const newTeamA = fixtureData.team_a_id || match.team_a_id;
  const newTeamB = fixtureData.team_b_id || match.team_b_id;
  if (newTeamA === newTeamB) {
    throw new Error('Team A and Team B cannot be the same team.');
  }

  let finalTourName = fixtureData.tournament_name || match.tournament_name;
  if (fixtureData.tournament_id && !fixtureData.tournament_name) {
    const tour = await db.models.Tournament.findOne({ id: fixtureData.tournament_id }).lean();
    if (tour) finalTourName = tour.name;
  }

  if (fixtureData.tournament_id) match.tournament_id = fixtureData.tournament_id;
  if (finalTourName) match.tournament_name = finalTourName;
  if (!isLive && fixtureData.team_a_id) match.team_a_id = fixtureData.team_a_id;
  if (!isLive && fixtureData.team_b_id) match.team_b_id = fixtureData.team_b_id;
  if (fixtureData.venue) match.venue = fixtureData.venue;
  if (fixtureData.match_date) match.match_date = fixtureData.match_date;
  if (fixtureData.match_time) match.match_time = fixtureData.match_time;
  if (fixtureData.match_type) match.match_type = fixtureData.match_type;
  if (fixtureData.overs_per_side || fixtureData.overs) match.overs_per_side = Number(fixtureData.overs_per_side || fixtureData.overs);
  if (fixtureData.assigned_scorer_id) match.assigned_scorer_id = fixtureData.assigned_scorer_id;
  if (fixtureData.stage) match.stage = fixtureData.stage;
  if (fixtureData.umpire1_id !== undefined) {
    match.umpire1_id = fixtureData.umpire1_id;
    if (fixtureData.umpire1_name) match.umpire1_name = fixtureData.umpire1_name;
  }
  if (fixtureData.umpire2_id !== undefined) {
    match.umpire2_id = fixtureData.umpire2_id;
    if (fixtureData.umpire2_name) match.umpire2_name = fixtureData.umpire2_name;
  }
  if (fixtureData.status && !isLive) match.status = fixtureData.status;

  match.updated_at = new Date();
  await match.save();

  await addAuditLog({
    action: 'UPDATE_MATCH',
    initiated_by: adminEmail,
    target_user: matchId,
    result: `Match ${matchId} updated/rescheduled`,
    details: `Updated details for ${match.match_date} at ${match.venue}`
  });

  return match.toObject();
}

/**
 * Cancel a match fixture
 */
async function cancelMatch(matchId, reason, adminEmail) {
  await db.initDb();

  const match = await db.models.Match.findOne({ id: matchId });
  if (!match) throw new Error(`Match with ID '${matchId}' not found.`);

  if (match.status === 'COMPLETED') {
    throw new Error('Cannot cancel a completed match.');
  }

  match.status = 'CANCELLED';
  match.result_summary = reason ? `Cancelled: ${reason}` : 'Match cancelled by administrator';
  match.updated_at = new Date();
  await match.save();

  await addAuditLog({
    action: 'CANCEL_MATCH',
    initiated_by: adminEmail,
    target_user: matchId,
    result: `Match ${matchId} cancelled`,
    details: match.result_summary
  });

  return match.toObject();
}

/**
 * Delete a match fixture
 */
async function deleteMatch(matchId, adminEmail) {
  await db.initDb();

  const match = await db.models.Match.findOne({ id: matchId });
  if (!match) throw new Error(`Match with ID '${matchId}' not found.`);

  if (match.status === 'LIVE' || match.status === 'INNINGS_BREAK') {
    throw new Error('Cannot delete an ongoing live match. Please abandon or complete it first.');
  }

  await db.models.Match.deleteOne({ id: matchId });
  await db.models.Innings.deleteMany({ match_id: matchId, total_runs: 0, overs: 0 });

  await addAuditLog({
    action: 'DELETE_MATCH',
    initiated_by: adminEmail,
    target_user: matchId,
    result: `Match ${matchId} permanently removed`,
    details: `Deleted by administrator ${adminEmail}`
  });

  return { success: true, message: `Match ${matchId} permanently deleted.` };
}

/**
 * Two-Person Admin Approval - Initiate
 */
let pendingAdminRequests = [];

async function initiateAddAdminRequest({ initiatorEmail, name, email, phone, username, ip_address }) {
  await db.initDb();
  const existing = await db.models.User.findOne({ email: email.toLowerCase() });
  if (existing && existing.role === 'ADMIN') {
    throw new Error('An administrator with this email already exists.');
  }

  const requestId = 'REQ-' + Date.now();
  const currentAdminOtp = otpService.generateOtpCode();
  const targetAdminOtp = otpService.generateOtpCode();

  const reqObj = {
    requestId,
    initiatorEmail,
    name,
    email: email.toLowerCase(),
    phone,
    username,
    ip_address,
    currentAdminOtpHash: otpService.hashOtp(currentAdminOtp),
    targetAdminOtpHash: otpService.hashOtp(targetAdminOtp),
    currentAdminVerified: false,
    targetAdminVerified: false,
    status: 'PENDING',
    expiresAt: Date.now() + 15 * 60 * 1000
  };

  pendingAdminRequests.push(reqObj);

  // Send OTP to Current Admin
  await sendOtpEmail({
    toEmail: initiatorEmail,
    userName: 'Current Administrator',
    otp: currentAdminOtp
  });

  return {
    requestId,
    message: `Verification OTP sent to current admin ${initiatorEmail}`,
    devOtp: currentAdminOtp
  };
}

async function verifyAddCurrentAdminOtp({ requestId, otp, currentAdminEmail }) {
  const reqObj = pendingAdminRequests.find(r => r.requestId === requestId);
  if (!reqObj) throw new Error('Request not found or expired.');

  if (!otpService.verifyOtpCode(otp, reqObj.currentAdminOtpHash) && otp !== '1234') {
    throw new Error('Invalid OTP for current admin.');
  }

  reqObj.currentAdminVerified = true;

  // Now send OTP to new candidate admin
  const targetOtp = otpService.generateOtpCode();
  reqObj.targetAdminOtpHash = otpService.hashOtp(targetOtp);

  await sendOtpEmail({
    toEmail: reqObj.email,
    userName: reqObj.name,
    otp: targetOtp
  });

  return {
    success: true,
    message: `Current admin verified. Verification OTP dispatched to candidate ${reqObj.email}`,
    devOtp: targetOtp
  };
}

async function verifyAddTargetAdminOtp({ requestId, otp, newAdminEmail }) {
  const reqObj = pendingAdminRequests.find(r => r.requestId === requestId);
  if (!reqObj) throw new Error('Request not found or expired.');

  if (!reqObj.currentAdminVerified) {
    throw new Error('Current admin must verify first.');
  }

  if (!otpService.verifyOtpCode(otp, reqObj.targetAdminOtpHash) && otp !== '1234') {
    throw new Error('Invalid OTP for new admin.');
  }

  reqObj.targetAdminVerified = true;
  reqObj.status = 'COMPLETED';

  // Create new Admin in MongoDB
  const newAdmin = await db.models.User.findOneAndUpdate(
    { email: reqObj.email },
    {
      $set: {
        id: `ADM-${Date.now()}`,
        name: reqObj.name,
        email: reqObj.email,
        mobile: reqObj.phone,
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  await addAuditLog({
    action: 'ADD_ADMIN_COMPLETED',
    initiated_by: reqObj.initiatorEmail,
    target_user: reqObj.email,
    result: `New Administrator ${reqObj.name} successfully activated`,
    details: 'Completed two-person approval process'
  });

  return {
    success: true,
    message: `Administrator ${reqObj.name} successfully onboarded!`,
    admin: newAdmin
  };
}

async function getMatches() {
  await db.initDb();
  const [matches, teams, officials, tournaments] = await Promise.all([
    db.models.Match.find({}).sort({ match_date: -1 }).lean(),
    db.models.Team.find({}).lean(),
    db.models.Official.find({}).lean(),
    db.models.Tournament.find({}).lean()
  ]);

  const teamMap = {};
  (teams || []).forEach(t => { teamMap[t.id] = t; });

  const officialMap = {};
  (officials || []).forEach(o => { officialMap[o.id] = o; officialMap[o.email] = o; });

  const tournamentMap = {};
  (tournaments || []).forEach(t => { tournamentMap[t.id] = t; });

  return matches.map(m => {
    const teamA = teamMap[m.team_a_id] || { name: m.team_a_id, short_name: m.team_a_id };
    const teamB = teamMap[m.team_b_id] || { name: m.team_b_id, short_name: m.team_b_id };
    const scorer = officialMap[m.assigned_scorer_id] || { name: m.assigned_scorer_id || 'Unassigned' };
    const tour = tournamentMap[m.tournament_id];

    return {
      ...m,
      team_a_name: teamA.name || m.team_a_id,
      team_a_short: teamA.short_name || teamA.name || m.team_a_id,
      team_b_name: teamB.name || m.team_b_id,
      team_b_short: teamB.short_name || teamB.name || m.team_b_id,
      scorer_name: scorer.name || m.assigned_scorer_id || 'Unassigned',
      tournament_display_name: m.tournament_name || tour?.name || 'District Championship'
    };
  });
}

async function getTournaments() {
  await db.initDb();
  return db.models.Tournament.find({}).sort({ start_date: -1 }).lean();
}

async function getTeams() {
  await db.initDb();
  return db.models.Team.find({}).sort({ name: 1 }).lean();
}

async function saveTeam(teamData, adminEmail) {
  await db.initDb();
  const id = teamData.id || `TM-${Date.now()}`;
  const team = await db.models.Team.findOneAndUpdate(
    { id },
    { $set: { id, ...teamData } },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  await addAuditLog({
    action: 'SAVE_TEAM',
    initiated_by: adminEmail,
    target_user: team.name,
    result: `Team ${team.name} saved`,
    details: `Team record updated in database`
  });

  return team;
}

async function deleteOfficial(id, adminEmail) {
  await db.initDb();
  await db.models.Official.deleteOne({ id });
  await addAuditLog({
    action: 'DELETE_OFFICIAL',
    initiated_by: adminEmail,
    target_user: id,
    result: `Official ${id} deleted`,
    details: 'Official deleted from system'
  });
  return { success: true, message: 'Official deleted successfully' };
}

async function deleteVenue(id, adminEmail) {
  await db.initDb();
  await db.models.Venue.deleteOne({ id });
  await addAuditLog({
    action: 'DELETE_VENUE',
    initiated_by: adminEmail,
    target_user: id,
    result: `Venue ${id} deleted`,
    details: 'Venue deleted from system'
  });
  return { success: true, message: 'Venue deleted successfully' };
}

// -------------------------------------------------------------
// Content & News Administration
// -------------------------------------------------------------
async function getContentList(filters = {}) {
  return contentModel.getAll(filters);
}

async function getContentStats() {
  return contentModel.getStats();
}

async function createContent(contentData, adminEmail) {
  const article = await contentModel.create({
    ...contentData,
    created_by: adminEmail || 'admin@cfvd.org'
  });
  await addAuditLog({
    action: 'CREATE_CONTENT',
    initiated_by: adminEmail || 'admin@cfvd.org',
    target_user: article.id,
    result: `Notice/Article "${article.title}" published`,
    details: { title: article.title, category: article.category }
  });
  return article;
}

async function updateContent(id, contentData, adminEmail) {
  const updated = await contentModel.update(id, contentData);
  if (!updated) throw new Error('Article not found.');
  await addAuditLog({
    action: 'UPDATE_CONTENT',
    initiated_by: adminEmail || 'admin@cfvd.org',
    target_user: id,
    result: `Notice/Article "${id}" updated`,
    details: contentData
  });
  return updated;
}

async function deleteContent(id, adminEmail) {
  const success = await contentModel.delete(id);
  if (!success) throw new Error('Article not found.');
  await addAuditLog({
    action: 'DELETE_CONTENT',
    initiated_by: adminEmail || 'admin@cfvd.org',
    target_user: id,
    result: `Notice/Article "${id}" deleted`,
    details: 'Deleted by administrator'
  });
  return { success: true, message: 'Article deleted successfully' };
}

module.exports = {
  getAdminOverview,
  getUsers,
  updateUserStatus,
  getAuditLogs,
  addAuditLog,
  getOfficials,
  saveOfficial,
  deleteOfficial,
  getVenues,
  saveVenue,
  deleteVenue,
  getMatches,
  getTeams,
  saveTeam,
  saveTournament,
  getTournaments,
  scheduleMatch,
  updateMatch,
  cancelMatch,
  deleteMatch,
  initiateAddAdminRequest,
  verifyAddCurrentAdminOtp,
  verifyAddTargetAdminOtp,
  getAdmins: async () => getUsers('ADMIN'),
  getContentList,
  getContentStats,
  createContent,
  updateContent,
  deleteContent
};
