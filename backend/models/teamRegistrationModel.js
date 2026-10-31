/**
 * models/teamRegistrationModel.js
 * Pure MongoDB Data Model for Team Registrations, Squad Players, and Admin Approvals
 */

const mongoose = require('mongoose');
const db = require('../config/db');
const notificationModel = require('./notificationModel');
const userModel = require('./userModel');

class TeamRegistrationModel {
  get Model() {
    return db.models.TeamRegistration;
  }

  /**
   * Create a new Team Registration in PENDING status
   * Strictly validates exactly 15 squad players, email formats, and duplicates.
   */
  async create({ teamId, teamName, coachName, coachEmail, password, password_hash, passkey, city, taluk, players }) {
    await db.initDb();

    // 1. Validate Coach & Team Info
    if (!teamName || typeof teamName !== 'string' || !teamName.trim()) {
      throw { status: 400, message: 'Team name is required.' };
    }
    if (!coachName || typeof coachName !== 'string' || !coachName.trim()) {
      throw { status: 400, message: 'Coach name is required.' };
    }
    if (!coachEmail || typeof coachEmail !== 'string' || !coachEmail.trim()) {
      throw { status: 400, message: 'Coach email is required.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanCoachEmail = coachEmail.trim().toLowerCase();
    if (!emailRegex.test(cleanCoachEmail)) {
      throw { status: 400, message: 'Invalid coach email address format.' };
    }

    // 2. Validate Squad Players (Any number of players >= 1 allowed)
    if (!Array.isArray(players) || players.length === 0) {
      throw { 
        status: 400, 
        message: 'At least one player is required for team squad registration.' 
      };
    }

    // 3. Duplicate checks in MongoDB
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingTeam = await this.Model.findOne({
      team_name: new RegExp('^' + escapeRegex(teamName.trim()) + '$', 'i')
    });
    if (existingTeam) {
      throw { status: 409, message: `Team name "${teamName.trim()}" is already registered.` };
    }

    const existingCoach = await this.Model.findOne({ coach_email: cleanCoachEmail });
    if (existingCoach) {
      throw { status: 409, message: `Coach email "${cleanCoachEmail}" is already registered for team "${existingCoach.team_name}".` };
    }

    // 4. Validate Squad Player details and duplicate player emails inside squad
    const seenPlayerEmails = new Set();
    const squadPlayers = [];

    for (let index = 0; index < players.length; index++) {
      const p = players[index];
      const pName = (p.name || '').trim();
      const pEmail = (p.email || '').trim().toLowerCase();

      if (!pName) {
        throw { status: 400, message: `Player #${index + 1} name is required.` };
      }
      if (!pEmail || !emailRegex.test(pEmail)) {
        throw { status: 400, message: `Player "${pName || index + 1}" has an invalid email address: "${pEmail}".` };
      }
      if (pEmail === cleanCoachEmail) {
        throw { status: 400, message: `Player "${pName}" cannot have the same email as the Coach (${cleanCoachEmail}).` };
      }
      if (seenPlayerEmails.has(pEmail)) {
        throw { status: 400, message: `Duplicate player email "${pEmail}" detected inside the 15-player squad list.` };
      }
      seenPlayerEmails.add(pEmail);

      squadPlayers.push({
        jersey_number: p.jerseyNumber || p.jersey_number || (index + 1),
        name: pName,
        email: pEmail,
        role: p.role || 'BATTER',
        status: 'PENDING'
      });
    }

    const regId = teamId || `TEAM-VRD-${Math.floor(100000 + Math.random() * 900000)}`;
    const secretPasskey = passkey || `PASS-${Math.floor(1000 + Math.random() * 9000)}`;

    let computedPasswordHash = password_hash || null;
    if (password && !computedPasswordHash) {
      try {
        const bcrypt = require('bcryptjs');
        computedPasswordHash = await bcrypt.hash(password, 10);
      } catch (_e) {}
    }

    const reg = await this.Model.create({
      id: regId,
      team_name: teamName.trim(),
      coach_name: coachName.trim(),
      coach_email: cleanCoachEmail,
      password_hash: computedPasswordHash,
      passkey: secretPasskey,
      city: city || taluk || 'Virudhunagar',
      taluk: taluk || 'Virudhunagar',
      status: 'PENDING',
      players: squadPlayers,
      created_at: new Date()
    });

    // Ensure Coach User account exists with status PENDING and password_hash
    const existingUser = await userModel.findByEmail(cleanCoachEmail);
    if (!existingUser) {
      await userModel.create({
        id: `COACH-${Date.now()}`,
        name: coachName.trim(),
        email: cleanCoachEmail,
        role: 'COACH',
        status: 'PENDING',
        password_hash: computedPasswordHash
      });
    } else {
      await db.models.User.updateOne(
        { email: cleanCoachEmail },
        {
          $set: {
            name: coachName.trim(),
            role: 'COACH',
            status: 'PENDING',
            ...(computedPasswordHash && { password_hash: computedPasswordHash }),
            updated_at: new Date()
          }
        }
      );
    }

    // Create Admin notification for governing review
    await notificationModel.create({
      type: 'TEAM_REGISTRATION',
      title: `New Team Registration: ${teamName.trim()}`,
      message: `Coach ${coachName.trim()} (${cleanCoachEmail}) submitted team "${teamName.trim()}" with ${players.length} squad players. Awaiting administrative review and approval.`,
      reference_id: regId,
      status: 'UNREAD'
    });

    return reg.toObject();
  }

  /**
   * Find team registration by ID
   */
  async findById(id) {
    if (!id) return null;
    await db.initDb();
    const query = { $or: [{ id }, { teamId: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    return this.Model.findOne(query).lean();
  }

  /**
   * Find team registration by Coach Email
   */
  async findByCoachEmail(email) {
    if (!email) return null;
    await db.initDb();
    const cleanEmail = email.trim().toLowerCase();
    return this.Model.findOne({ coach_email: cleanEmail }).lean();
  }

  /**
   * Search for a player in registered squads, player directory, or user records by email or name
   */
  async findPlayerByEmailOrName(nameOrEmail) {
    if (!nameOrEmail) return null;
    await db.initDb();
    const search = nameOrEmail.trim().toLowerCase();

    // 1. Check in team registrations
    const registrations = await this.Model.find({}).sort({ created_at: -1, _id: -1 }).lean();
    for (const reg of registrations) {
      for (const p of reg.players || []) {
        if (p.email?.toLowerCase() === search || p.name?.toLowerCase() === search) {
          return {
            ...p,
            team_registration_id: reg.id,
            team_name: reg.team_name,
            coach_name: reg.coach_name,
            coach_email: reg.coach_email,
            team_status: reg.status
          };
        }
      }
    }

    // 2. Check in db.models.Player (approved district squad players)
    const playerDoc = await db.models.Player.findOne({
      $or: [
        { email: search },
        { name: new RegExp('^' + search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      ]
    }).lean();

    if (playerDoc) {
      const teamDoc = await db.models.Team.findOne({ id: playerDoc.team_id }).lean();
      const userDoc = await db.models.User.findOne({ email: playerDoc.email?.toLowerCase() }).lean();
      return {
        id: playerDoc.id,
        name: playerDoc.name,
        email: playerDoc.email,
        role: playerDoc.role,
        jerseyNumber: playerDoc.jersey_number,
        batting_style: playerDoc.batting_style,
        bowling_style: playerDoc.bowling_style,
        team_id: playerDoc.team_id,
        team_name: teamDoc ? teamDoc.name : 'Virudhunagar District CC',
        coach_name: teamDoc ? teamDoc.coach_name : 'Team Coach',
        coach_email: teamDoc ? teamDoc.coach_email : '',
        team_status: userDoc ? (userDoc.status === 'ACTIVE' ? 'APPROVED' : userDoc.status) : (playerDoc.status === 'ACTIVE' ? 'APPROVED' : playerDoc.status || 'APPROVED')
      };
    }

    // 3. Check in db.models.User (individual player registrations)
    const userDoc = await db.models.User.findOne({
      role: 'PLAYER',
      $or: [
        { email: search },
        { name: new RegExp('^' + search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      ]
    }).lean();

    if (userDoc) {
      return {
        id: userDoc.id,
        name: userDoc.name,
        email: userDoc.email,
        role: 'PLAYER',
        team_id: null,
        team_name: 'District Association Squad',
        coach_name: 'District Association',
        coach_email: 'cricketfederation21@gmail.com',
        team_status: userDoc.status === 'ACTIVE' ? 'APPROVED' : userDoc.status
      };
    }

    return null;
  }

  /**
   * Retrieve all team registrations
   */
  async getAll(status = null) {
    await db.initDb();
    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    return this.Model.find(query).sort({ created_at: -1 }).lean();
  }

  /**
   * Admin approves a team registration
   */
  async approveRegistration(id, approvedBy = 'ADMIN') {
    await db.initDb();
    const query = { $or: [{ id }, { teamId: id }, { team_name: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    const reg = await this.Model.findOne(query);
    if (!reg) throw new Error('Team registration not found');

    reg.status = 'APPROVED';
    reg.approved_by = approvedBy;
    reg.approved_at = new Date();
    (reg.players || []).forEach(p => { p.status = 'APPROVED'; });
    await reg.save();

    // 1. Create or update Team in db.models.Team
    const teamId = `TM-${reg.id.replace(/[^0-9]/g, '').slice(-4) || 'GEN'}`;
    const shortName = reg.team_name.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase();
    
    await db.models.Team.findOneAndUpdate(
      { name: reg.team_name },
      {
        $set: {
          id: teamId,
          name: reg.team_name,
          short_name: shortName,
          city: reg.city,
          taluk: reg.taluk,
          coach_name: reg.coach_name,
          coach_email: reg.coach_email,
          status: 'ACTIVE'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Add approved squad players to db.models.Player & User accounts
    if (reg.players && reg.players.length > 0) {
      for (let i = 0; i < reg.players.length; i++) {
        const p = reg.players[i];
        const playerId = `PLY-${teamId}-${i + 1}`;
        await db.models.Player.findOneAndUpdate(
          { email: p.email },
          {
            $set: {
              id: playerId,
              team_id: teamId,
              name: p.name,
              email: p.email,
              role: p.role || 'BATTER',
              jersey_number: p.jersey_number || (i + 1),
              status: 'ACTIVE'
            }
          },
          { upsert: true, returnDocument: 'after' }
        );

        // Ensure user account exists so player can login via OTP
        const existingUser = await userModel.findByEmail(p.email);
        if (!existingUser) {
          await userModel.create({
            id: playerId,
            name: p.name,
            email: p.email,
            role: 'PLAYER',
            status: 'ACTIVE'
          });
        } else {
          await db.models.User.updateOne(
            { email: p.email },
            { $set: { status: 'ACTIVE', role: 'PLAYER', updated_at: new Date() } }
          );
        }
      }
    }

    // 3. Ensure Coach User account exists so coach can login via password & OTP
    const existingCoach = await userModel.findByEmail(reg.coach_email);
    if (!existingCoach) {
      await userModel.create({
        id: `COACH-${Date.now()}`,
        name: reg.coach_name,
        email: reg.coach_email,
        role: 'COACH',
        status: 'ACTIVE',
        password_hash: reg.password_hash || null
      });
    } else {
      await db.models.User.updateOne(
        { email: reg.coach_email },
        {
          $set: {
            status: 'ACTIVE',
            ...(reg.password_hash && !existingCoach.password_hash && { password_hash: reg.password_hash }),
            updated_at: new Date()
          }
        }
      );
    }

    // 4. Create Notification
    await notificationModel.create({
      type: 'TEAM_APPROVED',
      title: `Team Approved: ${reg.team_name}`,
      message: `Team "${reg.team_name}" and its 15-player squad have been approved by ${approvedBy}. Players and Coach can now log in.`,
      reference_id: reg.id,
      status: 'UNREAD'
    });

    return reg.toObject();
  }

  /**
   * Admin rejects a team registration
   */
  async rejectRegistration(id, reason = 'Document verification failed', rejectedBy = 'ADMIN') {
    await db.initDb();
    const query = { $or: [{ id }, { teamId: id }, { team_name: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    const reg = await this.Model.findOne(query);
    if (!reg) throw new Error('Team registration not found');

    reg.status = 'REJECTED';
    reg.rejection_reason = reason;
    (reg.players || []).forEach(p => { p.status = 'REJECTED'; });
    await reg.save();

    // Update Coach User account in User collection to REJECTED
    await db.models.User.updateOne(
      { email: reg.coach_email },
      { $set: { status: 'REJECTED', rejection_reason: reason, updated_at: new Date() } }
    );

    await notificationModel.create({
      type: 'TEAM_REJECTED',
      title: `Team Rejected: ${reg.team_name}`,
      message: `Registration for team "${reg.team_name}" was rejected by ${rejectedBy}. Reason: ${reason}`,
      reference_id: reg.id,
      status: 'UNREAD'
    });

    return reg.toObject();
  }
}

module.exports = new TeamRegistrationModel();
