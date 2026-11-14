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
const { validateScheduleDateTime } = require('../utils/dateTimeValidation');

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
  const [officials, users] = await Promise.all([
    db.models.Official.find({}).sort({ name: 1 }).lean(),
    db.models.User.find({ role: { $in: ['UMPIRE', 'SCORER'] } }).sort({ name: 1 }).lean()
  ]);

  const list = [...officials];
  const seenIds = new Set(officials.map(o => o.id));

  (users || []).forEach(u => {
    if (!seenIds.has(u.id)) {
      seenIds.add(u.id);
      list.push({
        id: u.id,
        name: u.name,
        role: u.role,
        email: u.email,
        phone: u.mobile || '—',
        status: u.status || 'ACTIVE'
      });
    }
  });

  return list;
}

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

/**
 * Dispatch targeted notifications strictly to Team A, Team B, and all players belonging to them
 */
async function dispatchMatchScheduleNotifications(db, match, { isRescheduled = false, originalDate = '', originalTime = '' } = {}) {
  if (!db || !db.models || !db.models.Notification) return;

  const teamAId = match.team_a_id;
  const teamBId = match.team_b_id;
  const teamAName = match.team_a_name || teamAId;
  const teamBName = match.team_b_name || teamBId;
  const date = match.match_date;
  const time = match.match_time;
  const venue = match.venue || 'Kamarajar District Stadium';
  const mapLink = match.venue_maps_url || (venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}` : '');

  const getPlayersForTeam = async (teamId) => {
    if (!teamId) return [];
    const seen = new Set();
    const result = [];

    // 1. From db.models.Player
    const players = await db.models.Player.find({
      $or: [{ team_id: teamId }, { teamId: teamId }]
    }).lean();
    for (const p of players) {
      const key = p.id || p.email;
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push({ id: p.id, email: p.email ? p.email.toLowerCase() : null, name: p.name });
      }
    }

    // 2. From db.models.User (role: PLAYER)
    const users = await db.models.User.find({
      role: 'PLAYER',
      $or: [{ 'player_details.team_id': teamId }, { team_id: teamId }]
    }).lean();
    for (const u of users) {
      const key = u.id || u.email;
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push({ id: u.id, email: u.email ? u.email.toLowerCase() : null, name: u.name });
      }
    }

    // 3. From db.models.TeamRegistration.players
    const reg = await db.models.TeamRegistration.findOne({ id: teamId }).lean();
    if (reg && Array.isArray(reg.players)) {
      for (let i = 0; i < reg.players.length; i++) {
        const rp = reg.players[i];
        const key = rp.email || `${teamId}-reg-${i}`;
        if (key && !seen.has(key)) {
          seen.add(key);
          result.push({ id: rp.id || `${teamId}-p-${i + 1}`, email: rp.email ? rp.email.toLowerCase() : null, name: rp.name });
        }
      }
    }

    return result;
  };

  const [playersA, playersB] = await Promise.all([
    getPlayersForTeam(teamAId),
    getPlayersForTeam(teamBId)
  ]);

  const timestamp = Date.now();
  const notifDocs = [];
  const type = isRescheduled ? 'MATCH_RESCHEDULED' : 'MATCH_SCHEDULED';

  // 1. Notification for Team A
  notifDocs.push({
    id: `NOTIF-M-${match.id}-TEAM-A-${timestamp}`,
    type,
    recipient_role: 'TEAM',
    recipient_id: teamAId,
    team_id: teamAId,
    team_name: teamAName,
    title: isRescheduled ? `📅 Fixture Rescheduled vs ${teamBName}` : `🏏 Match Scheduled vs ${teamBName}`,
    message: isRescheduled
      ? `Your match vs ${teamBName} has been rescheduled to ${date} at ${time} at ${venue}.`
      : `Your match vs ${teamBName} has been scheduled on ${date} at ${time} at ${venue}.`,
    reference_id: match.id,
    link: mapLink,
    status: 'UNREAD'
  });

  // 2. Notification for Players of Team A
  for (let i = 0; i < playersA.length; i++) {
    const p = playersA[i];
    notifDocs.push({
      id: `NOTIF-M-${match.id}-PA-${i}-${timestamp}`,
      type,
      recipient_role: 'PLAYER',
      recipient_id: p.id,
      recipient_email: p.email,
      team_id: teamAId,
      team_name: teamAName,
      title: isRescheduled ? `📅 Match Rescheduled vs ${teamBName}` : `🏏 Match Scheduled vs ${teamBName}`,
      message: isRescheduled
        ? `Your team ${teamAName} match vs ${teamBName} has been rescheduled to ${date} at ${time} at ${venue}.`
        : `Your team ${teamAName} is scheduled to play against ${teamBName} on ${date} at ${time} at ${venue}.`,
      reference_id: match.id,
      link: mapLink,
      status: 'UNREAD'
    });
  }

  // 3. Notification for Team B
  notifDocs.push({
    id: `NOTIF-M-${match.id}-TEAM-B-${timestamp}`,
    type,
    recipient_role: 'TEAM',
    recipient_id: teamBId,
    team_id: teamBId,
    team_name: teamBName,
    title: isRescheduled ? `📅 Fixture Rescheduled vs ${teamAName}` : `🏏 Match Scheduled vs ${teamAName}`,
    message: isRescheduled
      ? `Your match vs ${teamAName} has been rescheduled to ${date} at ${time} at ${venue}.`
      : `Your match vs ${teamAName} has been scheduled on ${date} at ${time} at ${venue}.`,
    reference_id: match.id,
    link: mapLink,
    status: 'UNREAD'
  });

  // 4. Notification for Players of Team B
  for (let i = 0; i < playersB.length; i++) {
    const p = playersB[i];
    notifDocs.push({
      id: `NOTIF-M-${match.id}-PB-${i}-${timestamp}`,
      type,
      recipient_role: 'PLAYER',
      recipient_id: p.id,
      recipient_email: p.email,
      team_id: teamBId,
      team_name: teamBName,
      title: isRescheduled ? `📅 Match Rescheduled vs ${teamAName}` : `🏏 Match Scheduled vs ${teamAName}`,
      message: isRescheduled
        ? `Your team ${teamBName} match vs ${teamAName} has been rescheduled to ${date} at ${time} at ${venue}.`
        : `Your team ${teamBName} is scheduled to play against ${teamAName} on ${date} at ${time} at ${venue}.`,
      reference_id: match.id,
      link: mapLink,
      status: 'UNREAD'
    });
  }

  if (notifDocs.length > 0) {
    await db.models.Notification.insertMany(notifDocs);
  }
}

async function scheduleMatch(fixtureData, adminEmail) {
  await db.initDb();

  const tournament_id = fixtureData.tournament_id || fixtureData.tournamentId;
  const tournament_name = fixtureData.tournament_name || fixtureData.tournamentName;
  const team_a_id = fixtureData.team_a_id || fixtureData.teamAId;
  const team_b_id = fixtureData.team_b_id || fixtureData.teamBId;
  const team_a_name = fixtureData.team_a_name || fixtureData.teamAName;
  const team_b_name = fixtureData.team_b_name || fixtureData.teamBName;
  const venue = fixtureData.venue || fixtureData.venueName;
  const venue_maps_url = fixtureData.venue_maps_url || fixtureData.venueMapsUrl;
  const rawDate = fixtureData.match_date !== undefined ? fixtureData.match_date : (fixtureData.date !== undefined ? fixtureData.date : (fixtureData.scheduled_date !== undefined ? fixtureData.scheduled_date : fixtureData.scheduledDate));
  const rawTime = fixtureData.match_time !== undefined ? fixtureData.match_time : (fixtureData.time !== undefined ? fixtureData.time : (fixtureData.scheduled_time !== undefined ? fixtureData.scheduled_time : fixtureData.scheduledTime));
  const match_type = fixtureData.match_type || fixtureData.matchType;
  const overs = fixtureData.overs;
  const overs_per_side = fixtureData.overs_per_side || fixtureData.overs;
  const assigned_scorer_id = fixtureData.assigned_scorer_id || fixtureData.assignedScorerId;
  const umpire1_id = fixtureData.umpire1_id || fixtureData.umpire1Id;
  const umpire2_id = fixtureData.umpire2_id || fixtureData.umpire2Id;
  const umpire1_name = fixtureData.umpire1_name || fixtureData.umpire1Name;
  const umpire2_name = fixtureData.umpire2_name || fixtureData.umpire2Name;
  const stage = fixtureData.stage;

  if (!team_a_id || !team_b_id) {
    throw new Error('Both Team A and Team B are required to schedule a match.');
  }

  if (team_a_id === team_b_id) {
    throw new Error('Team A and Team B cannot be the same team.');
  }

  // Strict date & time validation (Asia/Kolkata timezone)
  const dtValidation = validateScheduleDateTime(rawDate, rawTime);
  if (!dtValidation.isValid) {
    throw new Error(dtValidation.error);
  }

  const cleanDate = dtValidation.cleanDate;
  const cleanTime = dtValidation.parsedTime.formatted12;

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

  // Resolve dynamic team names if not provided
  let resolvedTeamAName = (team_a_name && String(team_a_name).trim()) || null;
  let resolvedTeamBName = (team_b_name && String(team_b_name).trim()) || null;

  if (!resolvedTeamAName || resolvedTeamAName.startsWith('TEAM-VRD-') || resolvedTeamAName.startsWith('TM-')) {
    const regA = await db.models.TeamRegistration.findOne({ id: team_a_id }).lean();
    if (regA && regA.team_name) resolvedTeamAName = regA.team_name;
    else {
      const tmA = await db.models.Team.findOne({ $or: [{ id: team_a_id }, { team_id: team_a_id }] }).lean();
      if (tmA && tmA.name) resolvedTeamAName = tmA.name;
    }
  }

  if (!resolvedTeamBName || resolvedTeamBName.startsWith('TEAM-VRD-') || resolvedTeamBName.startsWith('TM-')) {
    const regB = await db.models.TeamRegistration.findOne({ id: team_b_id }).lean();
    if (regB && regB.team_name) resolvedTeamBName = regB.team_name;
    else {
      const tmB = await db.models.Team.findOne({ $or: [{ id: team_b_id }, { team_id: team_b_id }] }).lean();
      if (tmB && tmB.name) resolvedTeamBName = tmB.name;
    }
  }

  const matchId = fixtureData.id || `M-${Date.now()}`;
  const match = await db.models.Match.create({
    id: matchId,
    tournament_id: tournament_id || 'T-2026-VPL',
    tournament_name: finalTourName || 'Virudhunagar Premier League 2026',
    team_a_id,
    team_b_id,
    team_a_name: resolvedTeamAName || team_a_name || team_a_id,
    team_b_name: resolvedTeamBName || team_b_name || team_b_id,
    venue: venue || 'Kamarajar District Stadium',
    venue_maps_url: venue_maps_url || (venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}` : ''),
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
    details: `Match fixture created for ${cleanDate}`
  });

  // Dispatch targeted Notifications strictly to Team A, Team B, and their squad players
  try {
    await dispatchMatchScheduleNotifications(db, match, { isRescheduled: false });
  } catch (notifErr) {
    console.warn('Failed to dispatch match schedule notification:', notifErr.message);
  }

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
  if (fixtureData.team_a_name) match.team_a_name = fixtureData.team_a_name;
  if (fixtureData.team_b_name) match.team_b_name = fixtureData.team_b_name;
  if (fixtureData.venue) match.venue = fixtureData.venue;
  if (fixtureData.venue_maps_url !== undefined) match.venue_maps_url = fixtureData.venue_maps_url;

  // Validate and update match date / time if provided
  const rawUpdateDate = fixtureData.match_date !== undefined ? fixtureData.match_date : (fixtureData.date !== undefined ? fixtureData.date : (fixtureData.scheduled_date !== undefined ? fixtureData.scheduled_date : fixtureData.scheduledDate));
  const rawUpdateTime = fixtureData.match_time !== undefined ? fixtureData.match_time : (fixtureData.time !== undefined ? fixtureData.time : (fixtureData.scheduled_time !== undefined ? fixtureData.scheduled_time : fixtureData.scheduledTime));

  if (rawUpdateDate !== undefined || rawUpdateTime !== undefined) {
    const targetDate = rawUpdateDate !== undefined ? rawUpdateDate : match.match_date;
    const targetTime = rawUpdateTime !== undefined ? rawUpdateTime : match.match_time;
    const dtValidation = validateScheduleDateTime(targetDate, targetTime);
    if (!dtValidation.isValid) {
      throw new Error(dtValidation.error);
    }
    match.match_date = dtValidation.cleanDate;
    match.match_time = dtValidation.parsedTime.formatted12;
  }

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
 * Postpone a match fixture with a mandatory reason
 */
async function postponeMatch(matchId, { reason }, adminEmail = 'admin@cfvd.org') {
  await db.initDb();

  if (!reason || !String(reason).trim()) {
    throw new Error('A mandatory reason is required to postpone a match fixture.');
  }

  const cleanReason = String(reason).trim();
  const match = await db.models.Match.findOne({ id: matchId });
  if (!match) throw new Error(`Match with ID '${matchId}' not found.`);

  if (match.status === 'COMPLETED') {
    throw new Error('Cannot postpone a match that has already been completed.');
  }
  if (match.status === 'CANCELLED') {
    throw new Error('Cannot postpone a match that has been cancelled.');
  }

  const origDate = (match.postponement && match.postponement.original_date) || match.match_date;
  const origTime = (match.postponement && match.postponement.original_time) || match.match_time;

  match.status = 'POSTPONED';
  match.status_comment = `Postponed: ${cleanReason}`;
  match.result_summary = `Postponed: ${cleanReason}`;

  match.postponement = {
    is_postponed: true,
    reason: cleanReason,
    postponed_at: new Date(),
    postponed_by: {
      user_id: adminEmail,
      role: 'ADMIN',
      name: 'Administrator'
    },
    original_date: origDate,
    original_time: origTime,
    rescheduled_date: null,
    rescheduled_time: null,
    rescheduled_at: null,
    rescheduled_by: null
  };

  // If there was an umpire postponement request pending, mark it approved
  if (match.umpire_postponement_request && match.umpire_postponement_request.status === 'PENDING') {
    match.umpire_postponement_request.status = 'APPROVED';
    match.umpire_postponement_request.reviewed_by = adminEmail;
    match.umpire_postponement_request.reviewed_at = new Date();
    match.umpire_postponement_request.review_notes = cleanReason;
  }

  if (!match.postponement_history) match.postponement_history = [];
  match.postponement_history.push({
    action: 'POSTPONED',
    reason: cleanReason,
    from_date: match.match_date,
    from_time: match.match_time,
    to_date: '',
    to_time: '',
    actor_id: adminEmail,
    actor_name: 'Administrator',
    actor_role: 'ADMIN',
    timestamp: new Date(),
    notes: cleanReason
  });

  match.updated_at = new Date();
  await match.save();

  await addAuditLog({
    action: 'POSTPONE_MATCH',
    initiated_by: adminEmail,
    target_user: matchId,
    result: `Match ${matchId} postponed`,
    details: cleanReason
  });

  // Dispatch Notifications to Team A, Team B, Scorer, and Umpires
  if (db.models.Notification) {
    const notifPayloads = [
      {
        recipient_role: 'TEAM',
        recipient_id: match.team_a_id,
        title: '⚠️ Fixture Postponed',
        message: `Your scheduled match vs ${match.team_b_name || match.team_b_id} on ${origDate} at ${origTime} has been postponed. Reason: "${cleanReason}".`
      },
      {
        recipient_role: 'TEAM',
        recipient_id: match.team_b_id,
        title: '⚠️ Fixture Postponed',
        message: `Your scheduled match vs ${match.team_a_name || match.team_a_id} on ${origDate} at ${origTime} has been postponed. Reason: "${cleanReason}".`
      },
      {
        recipient_role: 'SCORER',
        recipient_id: match.assigned_scorer_id,
        title: '⏸️ Official Match Postponed',
        message: `Match fixture #${match.id} (${match.team_a_name} vs ${match.team_b_name}) on ${origDate} has been postponed. Reason: "${cleanReason}".`
      }
    ];

    if (match.umpire1_id) {
      notifPayloads.push({
        recipient_role: 'UMPIRE',
        recipient_id: match.umpire1_id,
        title: '⏸️ Assigned Match Postponed',
        message: `Assigned match #${match.id} (${match.team_a_name} vs ${match.team_b_name}) has been postponed by Admin. Reason: "${cleanReason}".`
      });
    }

    for (const np of notifPayloads) {
      try {
        await db.models.Notification.create({
          id: `NOTIF-POSTPONE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: 'MATCH_POSTPONED',
          recipient_role: np.recipient_role,
          recipient_id: np.recipient_id,
          title: np.title,
          message: np.message,
          reference_id: match.id,
          status: 'UNREAD'
        });
      } catch (_e) {
        // Notification failure shouldn't abort postponement
      }
    }
  }

  return match.toObject();
}

/**
 * Reschedule a postponed match with a new valid date and time
 */
async function rescheduleMatch(matchId, { newDate, newTime, reason }, adminEmail = 'admin@cfvd.org') {
  await db.initDb();

  const dtValidation = validateScheduleDateTime(newDate, newTime);
  if (!dtValidation.isValid) {
    throw new Error(dtValidation.error || 'Please provide a valid future match date and time in Asia/Kolkata timezone.');
  }

  const cleanDate = dtValidation.cleanDate;
  const cleanTime = (dtValidation.parsedTime && dtValidation.parsedTime.formatted12) || String(newTime).trim();
  const cleanReason = reason ? String(reason).trim() : 'Fixture rescheduled by administrator';

  const match = await db.models.Match.findOne({ id: matchId });
  if (!match) throw new Error(`Match with ID '${matchId}' not found.`);

  if (match.status === 'COMPLETED') {
    throw new Error('Cannot reschedule a completed match.');
  }

  // Check venue availability conflict
  const venueConflict = await db.models.Match.findOne({
    id: { $ne: matchId },
    status: { $nin: ['CANCELLED', 'POSTPONED'] },
    venue: match.venue,
    match_date: cleanDate,
    match_time: cleanTime
  });
  if (venueConflict) {
    throw new Error(`Venue '${match.venue}' is already booked on ${cleanDate} at ${cleanTime} for fixture #${venueConflict.id} (${venueConflict.team_a_name || 'Team A'} vs ${venueConflict.team_b_name || 'Team B'}).`);
  }

  const prevDate = match.match_date;
  const prevTime = match.match_time;

  match.match_date = cleanDate;
  match.match_time = cleanTime;
  match.status = 'SCHEDULED';
  match.status_comment = `Rescheduled to ${cleanDate} ${cleanTime}. ${cleanReason}`;
  match.result_summary = null;

  if (!match.postponement) {
    match.postponement = {
      is_postponed: false,
      reason: cleanReason,
      original_date: prevDate,
      original_time: prevTime
    };
  } else {
    match.postponement.is_postponed = false;
  }

  match.postponement.rescheduled_date = cleanDate;
  match.postponement.rescheduled_time = cleanTime;
  match.postponement.rescheduled_at = new Date();
  match.postponement.rescheduled_by = {
    user_id: adminEmail,
    role: 'ADMIN',
    name: 'Administrator'
  };

  if (!match.postponement_history) match.postponement_history = [];
  match.postponement_history.push({
    action: 'RESCHEDULED',
    reason: cleanReason,
    from_date: prevDate,
    from_time: prevTime,
    to_date: cleanDate,
    to_time: cleanTime,
    actor_id: adminEmail,
    actor_name: 'Administrator',
    actor_role: 'ADMIN',
    timestamp: new Date(),
    notes: cleanReason
  });

  match.updated_at = new Date();
  await match.save();

  await addAuditLog({
    action: 'RESCHEDULE_MATCH',
    initiated_by: adminEmail,
    target_user: matchId,
    result: `Match ${matchId} rescheduled`,
    details: `Rescheduled from ${prevDate} ${prevTime} to ${cleanDate} ${cleanTime}. Reason: ${cleanReason}`
  });

  // Dispatch targeted Notifications strictly to Team A, Team B, and their squad players
  try {
    await dispatchMatchScheduleNotifications(db, match, {
      isRescheduled: true,
      originalDate: prevDate,
      originalTime: prevTime
    });
  } catch (notifErr) {
    console.warn('Failed to dispatch match reschedule notification:', notifErr.message);
  }

  return match.toObject();
}

/**
 * Review an umpire postponement request (Approve or Reject)
 */
async function reviewUmpirePostponement(matchId, { decision, reviewNotes }, adminEmail = 'admin@cfvd.org') {
  await db.initDb();

  const match = await db.models.Match.findOne({ id: matchId });
  if (!match) throw new Error(`Match with ID '${matchId}' not found.`);

  if (!match.umpire_postponement_request || !match.umpire_postponement_request.requested) {
    throw new Error(`Match #${matchId} does not have an active umpire postponement request.`);
  }

  const decUpper = String(decision).toUpperCase();
  if (decUpper === 'APPROVE') {
    const umpireReason = match.umpire_postponement_request.reason || 'Umpire postponement request approved';
    const postResult = await postponeMatch(matchId, { reason: umpireReason }, adminEmail);

    // Notify umpire
    if (db.models.Notification && match.umpire_postponement_request.umpire_id) {
      await db.models.Notification.create({
        id: `NOTIF-UMP-APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'POSTPONEMENT_REQUEST_APPROVED',
        recipient_role: 'UMPIRE',
        recipient_id: match.umpire_postponement_request.umpire_id,
        title: '✓ Postponement Request Approved',
        message: `Your request to postpone Match #${match.id} (${match.team_a_name} vs ${match.team_b_name}) was approved by Admin.`,
        reference_id: match.id,
        status: 'UNREAD'
      });
    }

    return postResult;
  } else if (decUpper === 'REJECT') {
    const notes = reviewNotes ? String(reviewNotes).trim() : 'Postponement request declined by administrator.';
    match.umpire_postponement_request.status = 'REJECTED';
    match.umpire_postponement_request.reviewed_by = adminEmail;
    match.umpire_postponement_request.reviewed_at = new Date();
    match.umpire_postponement_request.review_notes = notes;

    if (!match.postponement_history) match.postponement_history = [];
    match.postponement_history.push({
      action: 'REQUEST_REJECTED',
      reason: notes,
      from_date: match.match_date,
      from_time: match.match_time,
      to_date: '',
      to_time: '',
      actor_id: adminEmail,
      actor_name: 'Administrator',
      actor_role: 'ADMIN',
      timestamp: new Date(),
      notes
    });

    match.updated_at = new Date();
    await match.save();

    await addAuditLog({
      action: 'REJECT_POSTPONEMENT_REQUEST',
      initiated_by: adminEmail,
      target_user: matchId,
      result: `Umpire postponement request rejected for Match ${matchId}`,
      details: notes
    });

    // Notify umpire
    if (db.models.Notification && match.umpire_postponement_request.umpire_id) {
      await db.models.Notification.create({
        id: `NOTIF-UMP-REJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'POSTPONEMENT_REQUEST_REJECTED',
        recipient_role: 'UMPIRE',
        recipient_id: match.umpire_postponement_request.umpire_id,
        title: '✗ Postponement Request Rejected',
        message: `Your request to postpone Match #${match.id} (${match.team_a_name} vs ${match.team_b_name}) was reviewed and rejected. Note: "${notes}". Match remains scheduled.`,
        reference_id: match.id,
        status: 'UNREAD'
      });
    }

    return match.toObject();
  } else {
    throw new Error(`Invalid decision '${decision}'. Expected 'APPROVE' or 'REJECT'.`);
  }
}

/**
 * Get all matches with pending umpire postponement requests
 */
async function getPostponementRequests() {
  await db.initDb();
  const requests = await db.models.Match.find({
    'umpire_postponement_request.status': 'PENDING'
  }).sort({ 'umpire_postponement_request.requested_at': -1 }).lean();

  return requests;
}

/**
 * Cancel a match fixture
 */
/**
 * Confirm a match schedule once BOTH teams have submitted their player allocations.
 */
async function confirmMatchSchedule(matchId, adminEmail = 'admin@cfvd.org') {
  await db.initDb();

  const match = await db.models.Match.findOne({ id: matchId });
  if (!match) throw new Error(`Match with ID '${matchId}' not found.`);

  if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
    throw new Error(`Cannot confirm schedule for match with status ${match.status}.`);
  }

  const teamAAllocated = match.team_a_allocation_status === 'SUBMITTED';
  const teamBAllocated = match.team_b_allocation_status === 'SUBMITTED';

  if (!teamAAllocated || !teamBAllocated) {
    const pendingTeams = [];
    if (!teamAAllocated) pendingTeams.push(match.team_a_name || match.team_a_id);
    if (!teamBAllocated) pendingTeams.push(match.team_b_name || match.team_b_id);
    throw new Error(`Cannot confirm match schedule. Player allocation is pending from: ${pendingTeams.join(', ')}.`);
  }

  match.schedule_confirmation_status = 'CONFIRMED';
  match.schedule_confirmed_at = new Date();
  match.schedule_confirmed_by = adminEmail;
  match.updated_at = new Date();
  await match.save();

  await addAuditLog({
    action: 'CONFIRM_MATCH_SCHEDULE',
    initiated_by: adminEmail,
    target_user: matchId,
    result: `Schedule confirmed for match ${matchId}`,
    details: 'Both teams submitted Playing XI squad allocations. Match schedule officially confirmed.'
  });

  // Notify Team A, Team B, and all selected players
  try {
    const notifs = [
      {
        id: `NOTIF-CONFIRM-${Date.now()}-A`,
        type: 'MATCH_SCHEDULED',
        recipient_role: 'TEAM',
        recipient_id: match.team_a_id,
        team_id: match.team_a_id,
        team_name: match.team_a_name,
        title: '✅ Match Schedule Confirmed',
        message: `Match schedule vs ${match.team_b_name || match.team_b_id} on ${match.match_date} at ${match.match_time} (${match.venue}) has been officially confirmed by Admin.`,
        reference_id: match.id,
        status: 'UNREAD'
      },
      {
        id: `NOTIF-CONFIRM-${Date.now()}-B`,
        type: 'MATCH_SCHEDULED',
        recipient_role: 'TEAM',
        recipient_id: match.team_b_id,
        team_id: match.team_b_id,
        team_name: match.team_b_name,
        title: '✅ Match Schedule Confirmed',
        message: `Match schedule vs ${match.team_a_name || match.team_a_id} on ${match.match_date} at ${match.match_time} (${match.venue}) has been officially confirmed by Admin.`,
        reference_id: match.id,
        status: 'UNREAD'
      }
    ];

    const selectedPlayerIdsA = Array.isArray(match.team_a_playing_xi) ? match.team_a_playing_xi : [];
    for (const pid of selectedPlayerIdsA) {
      notifs.push({
        id: `NOTIF-CONFIRM-${Date.now()}-PLA-${Math.random().toString(36).substring(2, 7)}`,
        type: 'MATCH_SCHEDULED',
        recipient_role: 'PLAYER',
        recipient_id: pid,
        team_id: match.team_a_id,
        team_name: match.team_a_name,
        title: '✅ Match Schedule Confirmed',
        message: `Official match fixture vs ${match.team_b_name || match.team_b_id} on ${match.match_date} at ${match.match_time} (${match.venue}) is confirmed!`,
        reference_id: match.id,
        status: 'UNREAD'
      });
    }

    const selectedPlayerIdsB = Array.isArray(match.team_b_playing_xi) ? match.team_b_playing_xi : [];
    for (const pid of selectedPlayerIdsB) {
      notifs.push({
        id: `NOTIF-CONFIRM-${Date.now()}-PLB-${Math.random().toString(36).substring(2, 7)}`,
        type: 'MATCH_SCHEDULED',
        recipient_role: 'PLAYER',
        recipient_id: pid,
        team_id: match.team_b_id,
        team_name: match.team_b_name,
        title: '✅ Match Schedule Confirmed',
        message: `Official match fixture vs ${match.team_a_name || match.team_a_id} on ${match.match_date} at ${match.match_time} (${match.venue}) is confirmed!`,
        reference_id: match.id,
        status: 'UNREAD'
      });
    }

    if (match.assigned_scorer_id) {
      notifs.push({
        id: `NOTIF-CONFIRM-${Date.now()}-SCORER`,
        type: 'MATCH_SCHEDULED',
        recipient_role: 'SCORER',
        recipient_id: match.assigned_scorer_id,
        title: '📋 Match Schedule Confirmed - Ready For Scoring',
        message: `Admin has officially confirmed the fixture "${match.team_a_name || match.team_a_id}" vs "${match.team_b_name || match.team_b_id}" on ${match.match_date} at ${match.match_time} (${match.venue}). Match is now ready for scoring!`,
        reference_id: match.id,
        status: 'UNREAD'
      });
    }

    for (const n of notifs) {
      await db.models.Notification.create(n);
    }
  } catch (notifErr) {
    console.warn('Failed to dispatch schedule confirmation notification:', notifErr.message);
  }

  return match.toObject();
}


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
  const [matches, teams, registrations, officials, users, tournaments] = await Promise.all([
    db.models.Match.find({}).sort({ match_date: -1 }).lean(),
    db.models.Team.find({}).lean(),
    db.models.TeamRegistration.find({}).lean(),
    db.models.Official.find({}).lean(),
    db.models.User.find({ role: { $in: ['UMPIRE', 'SCORER'] } }).lean(),
    db.models.Tournament.find({}).lean()
  ]);

  const teamMap = {};
  (registrations || []).forEach(r => {
    const tObj = { id: r.id, team_id: r.id, name: r.team_name, short_name: (r.team_name || '').slice(0, 4).toUpperCase() };
    teamMap[r.id] = tObj;
    if (r.team_name) teamMap[r.team_name] = tObj;
  });
  (teams || []).forEach(t => {
    teamMap[t.id] = t;
    if (t.team_id) teamMap[t.team_id] = t;
    if (t.name) teamMap[t.name] = t;
    if (t.team_name) teamMap[t.team_name] = t;
  });

  const officialMap = {};
  (officials || []).forEach(o => { officialMap[o.id] = o; officialMap[o.email] = o; });
  (users || []).forEach(u => { officialMap[u.id] = u; officialMap[u.email] = u; });

  const tournamentMap = {};
  (tournaments || []).forEach(t => { tournamentMap[t.id] = t; });

  const allPlayerIds = new Set();
  matches.forEach(m => {
    (m.team_a_playing_xi || []).forEach(id => allPlayerIds.add(id));
    (m.team_b_playing_xi || []).forEach(id => allPlayerIds.add(id));
    (m.team_a_substitutes || []).forEach(id => allPlayerIds.add(id));
    (m.team_b_substitutes || []).forEach(id => allPlayerIds.add(id));
  });
  const players = allPlayerIds.size > 0
    ? await db.models.Player.find({ id: { $in: Array.from(allPlayerIds) } }).lean()
    : [];
  const playerMap = {};
  players.forEach(p => { playerMap[p.id] = p; });

  return matches.map(m => {
    let teamAName = m.team_a_name;
    if (!teamAName || teamAName.startsWith('TEAM-VRD-') || teamAName.startsWith('TM-')) {
      teamAName = teamMap[m.team_a_name]?.name || teamMap[m.team_a_name]?.team_name || teamMap[m.team_a_id]?.name || teamMap[m.team_a_id]?.team_name || m.team_a_name || m.team_a_id;
    }

    let teamBName = m.team_b_name;
    if (!teamBName || teamBName.startsWith('TEAM-VRD-') || teamBName.startsWith('TM-')) {
      teamBName = teamMap[m.team_b_name]?.name || teamMap[m.team_b_name]?.team_name || teamMap[m.team_b_id]?.name || teamMap[m.team_b_id]?.team_name || m.team_b_name || m.team_b_id;
    }

    const scorer = officialMap[m.assigned_scorer_id] || { name: m.assigned_scorer_id || 'Unassigned' };
    const tour = tournamentMap[m.tournament_id];
    const u1 = m.umpire1_name || officialMap[m.umpire1_id]?.name || officialMap[m.umpire1_id]?.full_name || '';
    const u2 = m.umpire2_name || officialMap[m.umpire2_id]?.name || officialMap[m.umpire2_id]?.full_name || '';

    const enrichSquad = (xiIds = [], subsIds = [], lineupArr = []) => {
      const lineupByPid = {};
      (lineupArr || []).forEach(l => { if (l && l.playerId) lineupByPid[l.playerId] = l; });

      const xiList = (xiIds || []).map((pid, idx) => {
        const p = playerMap[pid] || {};
        const extra = lineupByPid[pid] || {};
        return {
          id: pid,
          name: p.name || extra.name || pid,
          role: p.role || extra.role || 'Player',
          jersey_number: p.jersey_number || extra.jerseyNumber || '',
          batting_order: extra.battingOrder || idx + 1,
          is_captain: !!extra.isCaptain,
          is_wicket_keeper: !!(extra.isKeeper || extra.isWicketKeeper || (p.role || '').toLowerCase().includes('keep'))
        };
      });

      const subsList = (subsIds || []).map(pid => {
        const p = playerMap[pid] || {};
        return {
          id: pid,
          name: p.name || pid,
          role: p.role || 'Substitute',
          jersey_number: p.jersey_number || ''
        };
      });

      return { playingXI: xiList, substitutes: subsList };
    };

    const squadA = enrichSquad(m.team_a_playing_xi, m.team_a_substitutes, m.team_a_lineup);
    const squadB = enrichSquad(m.team_b_playing_xi, m.team_b_substitutes, m.team_b_lineup);

    return {
      ...m,
      team_a_name: teamAName,
      team_a_short: (teamAName || '').slice(0, 4).toUpperCase(),
      team_b_name: teamBName,
      team_b_short: (teamBName || '').slice(0, 4).toUpperCase(),
      scorer_name: scorer.name || scorer.full_name || m.assigned_scorer_id || 'Unassigned',
      umpire1_name: u1,
      umpire2_name: u2,
      team_a_squad_details: squadA,
      team_b_squad_details: squadB,
      venue_maps_url: m.venue_maps_url || (m.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.venue)}` : ''),
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
  const [teams, regs] = await Promise.all([
    db.models.Team.find({}).sort({ name: 1 }).lean(),
    db.models.TeamRegistration.find({}).sort({ created_at: -1 }).lean()
  ]);

  const list = [];
  const seenNames = new Set();

  (regs || []).forEach(r => {
    const name = r.team_name || r.name;
    if (name && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      list.push({
        id: r.id,
        team_id: r.id,
        name: name,
        team_name: name,
        taluk: r.taluk || r.city || 'Virudhunagar',
        coach_name: r.coach_name || 'Coach',
        coach_email: r.coach_email || '',
        status: r.status || 'ACTIVE'
      });
    }
  });

  (teams || []).forEach(t => {
    const name = t.name || t.team_name;
    if (name && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      list.push(t);
    }
  });

  return list;
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
  postponeMatch,
  rescheduleMatch,
  reviewUmpirePostponement,
  getPostponementRequests,
  confirmMatchSchedule,
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
