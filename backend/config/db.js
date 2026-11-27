/**
 * config/db.js
 * Comprehensive Database Layer for Cricket Federation
 * Connects to MongoDB via Mongoose with full Schema & Model definitions,
 * auto-seeding default accounts with hashed passwords, and provides SQL query emulation.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const MONGODB_URI = process.env.NODE_ENV === 'test'
  ? (process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/cricket_test_db')
  : (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cricket_db');

let isConnected = false;

// -------------------------------------------------------------
// Pure MongoDB Schemas & Mongoose Models (Imported from models/)
// -------------------------------------------------------------
const {
  User,
  Tournament,
  TournamentRegistration,
  TournamentCalculation,
  Team,
  Player,
  TeamRegistration,
  Match,
  Innings,
  InningsBatter,
  InningsBowler,
  Delivery,
  Scorer,
  TeamPlayer,
  Notification,
  News,
  Official,
  Venue,
  AuditLog,
  UmpireDecision,
  CricketLaw,
  CricketLawSection,
  CricketLawVersion,
  CricketLawAuditLog,
  PlayerMatchRating,
  MasterSetting,
  AdminActionOtp,
  AdminRequest,
  EmailDailyCounter,
  SuperAdminNotification,
  models
} = require('../models');

// In-Memory Temporary Registrations & OTPs cache
const memoryDb = {
  registrationOtps: new Map(),
  admins: [],
  teams: [],
  districts: [
    { district_id: 1, name: 'Virudhunagar' },
    { district_id: 2, name: 'Madurai' },
    { district_id: 3, name: 'Dindigul' },
    { district_id: 4, name: 'Theni' },
    { district_id: 5, name: 'Tirunelveli' },
    { district_id: 6, name: 'Tenkasi' },
    { district_id: 7, name: 'Thoothukudi' }
  ],
  teamAccounts: []
};

// Seed essential initial admin (if configured) and master settings reference options (no dummy data)
async function seedDefaultData() {
  try {
    const env = require('./env');

    if (env.isProduction) {
      // Run idempotent plaintext password cleanup once at startup in production
      try {
        const { unsetPlaintextPasswords } = require('../scripts/migrations/unset-plaintext-passwords');
        await unsetPlaintextPasswords(mongoose.connection);
      } catch (_migErr) {}
    }

    // Provision initial super admin only when explicitly configured via env
    const adminEmail = env.ADMIN_INITIAL_EMAIL;
    const adminPass = env.ADMIN_INITIAL_PASSWORD;
    if (adminEmail && adminPass) {
      const existingAdmin = await User.findOne({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } });
      if (!existingAdmin) {
        const emailConflict = await User.findOne({ email: adminEmail }).lean();
        if (!emailConflict) {
          const passwordHash = await bcrypt.hash(adminPass, 12);
          await User.create({
            id: env.isProduction ? 'ADM-PROD-001' : `ADM-SUPER-${Date.now()}`,
            name: 'Super Administrator',
            email: adminEmail,
            mobile: '9876543210',
            role: 'ADMIN',
            status: 'ACTIVE',
            is_super_admin: true,
            admin_level: 'Permanent Super Administrator',
            password_hash: passwordHash
          });
          console.log('Initial super admin provisioned.');
        }
      } else {
        await User.updateOne(
          { email: adminEmail, role: 'ADMIN' },
          { $set: { is_super_admin: true, admin_level: 'Permanent Super Administrator' } }
        );
      }
    }

    // Seed Master Settings Dynamic Options (Taluk Jurisdiction, Playing Role, Batting Style, Age Category, Certification Level, Umpire Certification, State)
    const masterSettingCount = await MasterSetting.countDocuments();
    if (masterSettingCount === 0) {
      const jsonSeedPath = path.join(__dirname, '..', 'data', 'master_settings', 'all_master_settings.json');
      let defaultOptions = [];
      if (fs.existsSync(jsonSeedPath)) {
        defaultOptions = JSON.parse(fs.readFileSync(jsonSeedPath, 'utf8'));
      } else {
        defaultOptions = [
          // 1. Taluk Jurisdiction
          { category: 'taluk_jurisdiction', name: 'Virudhunagar', code: 'VNR', sort_order: 1 },
          { category: 'taluk_jurisdiction', name: 'Sivakasi', code: 'SVKS', sort_order: 2 },
          { category: 'taluk_jurisdiction', name: 'Rajapalayam', code: 'RJPM', sort_order: 3 },
          { category: 'taluk_jurisdiction', name: 'Srivilliputhur', code: 'SVPR', sort_order: 4 },
          { category: 'taluk_jurisdiction', name: 'Aruppukottai', code: 'APKI', sort_order: 5 },
          { category: 'taluk_jurisdiction', name: 'Sattur', code: 'STR', sort_order: 6 },
          { category: 'taluk_jurisdiction', name: 'Kariapatti', code: 'KPT', sort_order: 7 },
          { category: 'taluk_jurisdiction', name: 'Tiruchuli', code: 'TCL', sort_order: 8 },
          { category: 'taluk_jurisdiction', name: 'Vembakottai', code: 'VBK', sort_order: 9 },

          // 2. Playing Role
          { category: 'playing_role', name: 'Batsman', code: 'BAT', sort_order: 1 },
          { category: 'playing_role', name: 'Bowler', code: 'BOWL', sort_order: 2 },
          { category: 'playing_role', name: 'All-Rounder', code: 'AR', sort_order: 3 },
          { category: 'playing_role', name: 'Wicket Keeper', code: 'WK', sort_order: 4 },

          // 3. Batting Style
          { category: 'batting_style', name: 'Right-Handed Batsman', code: 'RHB', sort_order: 1 },
          { category: 'batting_style', name: 'Left-Handed Batsman', code: 'LHB', sort_order: 2 },

          // 4. Age Category
          { category: 'age_category', name: 'Senior Men', code: 'SR_MEN', sort_order: 1 },
          { category: 'age_category', name: "Women's Senior", code: 'SR_WOMEN', sort_order: 2 },
          { category: 'age_category', name: 'Under-23', code: 'U23', sort_order: 3 },
          { category: 'age_category', name: 'Under-19', code: 'U19', sort_order: 4 },
          { category: 'age_category', name: 'Under-16', code: 'U16', sort_order: 5 },
          { category: 'age_category', name: 'Under-14', code: 'U14', sort_order: 6 },
          { category: 'age_category', name: 'Under-12', code: 'U12', sort_order: 7 },

          // 5. Certification Level (Scorer)
          { category: 'certification_level', name: 'District Certified', code: 'DIST_CERT', sort_order: 1 },
          { category: 'certification_level', name: 'State Panel', code: 'STATE_PANEL', sort_order: 2 },
          { category: 'certification_level', name: 'Club Scorer', code: 'CLUB_SCR', sort_order: 3 },
          { category: 'certification_level', name: 'Trainee Scorer', code: 'TRAINEE_SCR', sort_order: 4 },

          // 6. Umpire Certification / Qualification
          { category: 'umpire_certification', name: 'State Panel A (Senior)', code: 'STATE_PANEL_A', sort_order: 1 },
          { category: 'umpire_certification', name: 'State Panel B', code: 'STATE_PANEL_B', sort_order: 2 },
          { category: 'umpire_certification', name: 'BCCI Level 1 Certified', code: 'BCCI_L1', sort_order: 3 },
          { category: 'umpire_certification', name: 'District Senior Panel', code: 'DIST_SR_PANEL', sort_order: 4 },
          { category: 'umpire_certification', name: 'District Certified Umpire', code: 'DIST_CERT_UMP', sort_order: 5 },
          { category: 'umpire_certification', name: 'Trainee Umpire', code: 'TRAINEE_UMP', sort_order: 6 },

          // 7. State
          { category: 'state', name: 'Tamil Nadu', code: 'TN', sort_order: 1 },
          { category: 'state', name: 'Kerala', code: 'KL', sort_order: 2 },
          { category: 'state', name: 'Karnataka', code: 'KA', sort_order: 3 },
          { category: 'state', name: 'Andhra Pradesh', code: 'AP', sort_order: 4 },
          { category: 'state', name: 'Telangana', code: 'TS', sort_order: 5 },
          { category: 'state', name: 'Other', code: 'OTHER', sort_order: 6 }
        ];
      }

      await MasterSetting.insertMany(
        defaultOptions.map((opt, idx) => ({
          id: opt.id || `MSET-${Date.now()}-${idx + 1}`,
          ...opt,
          is_active: opt.is_active !== undefined ? opt.is_active : true
        }))
      );
      console.log('✅ Seeded default Master Settings Dynamic Subcategories (Taluk, Roles, Batting, Age, Certs, State).');
    }
  } catch (err) {
    console.warn('Seed note:', err.message);
  }
}

// Connect to MongoDB
let connectionPromise = null;
let listenersAttached = false;

function setupConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    isConnected = true;
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('MongoDB connection lost. Awaiting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('MongoDB connection restored.');
  });

  mongoose.connection.on('error', (err) => {
    console.warn('MongoDB connection error:', err.message);
  });
}

async function ensureIndexes() {
  try {
    const modelsToIndex = [
      User, Tournament, TournamentRegistration, Team, Player,
      TeamRegistration, Match, Innings, InningsBatter, InningsBowler,
      Delivery, Scorer, TeamPlayer, Notification, News, Official,
      Venue, AuditLog, UmpireDecision, CricketLaw, CricketLawSection,
      MasterSetting
    ];
    for (const m of modelsToIndex) {
      if (m && m.syncIndexes) {
        await m.syncIndexes().catch(() => {});
      }
    }
    console.log('Database indexes synchronized.');
  } catch (err) {
    console.warn('Database index sync note:', err.message);
  }
}

async function ping() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (_) {
    return false;
  }
}

async function close() {
  try {
    await mongoose.connection.close();
    isConnected = false;
  } catch (_) {}
}

async function initDb() {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  if (connectionPromise) {
    return connectionPromise;
  }
  setupConnectionListeners();
  connectionPromise = (async () => {
    try {
      mongoose.set('strictQuery', false);
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 20,
        minPoolSize: 5,
        socketTimeoutMS: 45000,
        autoIndex: false
      });
      isConnected = true;
      console.log(`🍃 Connected to MongoDB Database Server at: ${MONGODB_URI}`);
      await seedDefaultData();
      await ensureIndexes();
    } catch (err) {
      console.warn(`⚠️ MongoDB connection note: ${err.message}.`);
    } finally {
      connectionPromise = null;
    }
  })();
  return connectionPromise;
}

// -------------------------------------------------------------
// SQL Emulation Helper (Supports legacy db.query callers)
// -------------------------------------------------------------
async function mongoQuery(sqlOrModel, params = []) {
  await initDb();
  if (typeof sqlOrModel !== 'string') {
    return [sqlOrModel];
  }

  const clean = sqlOrModel.trim();
  const lower = clean.toLowerCase();

  // 1. SELECT from users
  if (lower.startsWith('select') && lower.includes('from users')) {
    if (lower.includes('email = ?') || lower.includes('lower(email) = ?')) {
      const email = params[0]?.toLowerCase().trim();
      const user = await User.findOne({ email }).lean();
      return user ? [[user]] : [[]];
    }
    if (lower.includes('id = ?')) {
      const id = params[0];
      const user = await User.findOne({ id }).lean();
      return user ? [[user]] : [[]];
    }
    if (lower.includes("role = 'scorer'") && lower.includes('status = ?')) {
      const status = params[0];
      const scorers = await User.find({ role: 'SCORER', status }).lean();
      return [scorers];
    }
    if (lower.includes("role = 'scorer'")) {
      const scorers = await User.find({ role: 'SCORER' }).lean();
      return [scorers];
    }
    const allUsers = await User.find({}).sort({ created_at: -1 }).lean();
    return [allUsers];
  }

  // 2. UPDATE users
  if (lower.startsWith('update users')) {
    if (lower.includes('set status = ?') && lower.includes('where id = ?')) {
      const [status, id] = params;
      await User.updateOne({ id }, { $set: { status, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    if (lower.includes('set name = ?') && lower.includes('where id = ?')) {
      const [name, email, mobile, role, status, id] = params;
      await User.updateOne({ id }, { $set: { name, email, mobile, role, status, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    if (lower.includes('otp_hash = ?') && lower.includes('where id = ?')) {
      const [otp_hash, otp_expires_at, id] = params;
      await User.updateOne({ id }, { $set: { otp_hash, otp_expires_at, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    return [{ affectedRows: 1 }];
  }

  // 3. DELETE FROM users
  if (lower.startsWith('delete from users')) {
    const id = params[0];
    await User.deleteOne({ id });
    return [{ affectedRows: 1 }];
  }

  // 4. SELECT / INSERT / UPDATE from scorers
  if (lower.startsWith('select') && lower.includes('from scorers')) {
    if (lower.includes('email = ?') || lower.includes('lower(email) = ?')) {
      const email = params[0]?.toLowerCase().trim();
      const s = await Scorer.findOne({ email }).lean();
      return s ? [[s]] : [[]];
    }
    if (lower.includes('id = ?')) {
      const id = params[0];
      const s = await Scorer.findOne({ id }).lean();
      return s ? [[s]] : [[]];
    }
    if (lower.includes('status = ?')) {
      const status = params[0]?.toUpperCase();
      const scorers = await Scorer.find({ status }).sort({ created_at: -1 }).lean();
      return [scorers];
    }
    if (lower.includes('status = "pending"') || lower.includes("status = 'pending'")) {
      const scorers = await Scorer.find({ status: 'PENDING' }).sort({ created_at: -1 }).lean();
      return [scorers];
    }
    const allScorers = await Scorer.find({}).sort({ created_at: -1 }).lean();
    return [allScorers];
  }

  if (lower.startsWith('insert into scorers')) {
    const [id, full_name, email, mobile, association, status] = params;
    const newScorer = await Scorer.create({
      id,
      full_name,
      email: email?.toLowerCase().trim(),
      mobile,
      association,
      status: status || 'PENDING',
      created_at: new Date(),
      updated_at: new Date()
    });
    return [{ insertId: id, affectedRows: 1, scorer: newScorer }];
  }

  if (lower.startsWith('update scorers')) {
    if (lower.includes("status = 'approved'")) {
      const id = params[0];
      await Scorer.updateOne({ id }, { $set: { status: 'APPROVED', approved_at: new Date(), rejection_reason: null, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    if (lower.includes("status = 'rejected'")) {
      const [reason, id] = params;
      await Scorer.updateOne({ id }, { $set: { status: 'REJECTED', rejected_at: new Date(), rejection_reason: reason, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    if (lower.includes('otp_hash = ?') && lower.includes('otp_attempts = ?')) {
      const [otp_hash, otp_expires_at, otp_attempts, id] = params;
      await Scorer.updateOne({ id }, { $set: { otp_hash, otp_expires_at, otp_attempts, otp_verified_at: null, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    if (lower.includes('otp_attempts = ?')) {
      const [otp_attempts, id] = params;
      await Scorer.updateOne({ id }, { $set: { otp_attempts, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    if (lower.includes('otp_verified_at = now()')) {
      const id = params[0];
      await Scorer.updateOne({ id }, { $set: { otp_verified_at: new Date(), otp_hash: null, otp_expires_at: null, otp_attempts: 0, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    if (lower.includes('otp_hash = null')) {
      const id = params[0];
      await Scorer.updateOne({ id }, { $set: { otp_hash: null, otp_expires_at: null, otp_attempts: 0, updated_at: new Date() } });
      return [{ affectedRows: 1 }];
    }
    return [{ affectedRows: 1 }];
  }

  // 5. SELECT from team_registrations
  if (lower.startsWith('select') && lower.includes('from team_registrations')) {
    if (lower.includes('id = ?')) {
      const reg = await TeamRegistration.findOne({ id: params[0] }).lean();
      return reg ? [[reg]] : [[]];
    }
    if (lower.includes('coach_email = ?')) {
      const reg = await TeamRegistration.findOne({ coach_email: params[0]?.toLowerCase().trim() }).lean();
      return reg ? [[reg]] : [[]];
    }
    if (lower.includes('status = ?')) {
      const regs = await TeamRegistration.find({ status: params[0] }).sort({ created_at: -1 }).lean();
      return [regs];
    }
    const allRegs = await TeamRegistration.find({}).sort({ created_at: -1 }).lean();
    return [allRegs];
  }

  // 6. SELECT from team_registration_players
  if (lower.startsWith('select') && lower.includes('from team_registration_players')) {
    if (lower.includes('team_registration_id = ?')) {
      const reg = await TeamRegistration.findOne({ id: params[0] }).lean();
      return [reg?.players || []];
    }
    if (lower.includes('email = ?') || lower.includes('name = ?')) {
      const input = params[0]?.toLowerCase().trim();
      const allRegs = await TeamRegistration.find({}).lean();
      const matched = [];
      for (const reg of allRegs) {
        for (const p of reg.players || []) {
          if (p.email?.toLowerCase() === input || p.name?.toLowerCase().includes(input)) {
            matched.push({ ...p, team_registration_id: reg.id, team_name: reg.team_name, coach_name: reg.coach_name });
          }
        }
      }
      return [matched];
    }
  }

  // 7. SELECT / INSERT from teams
  if (lower.startsWith('select') && lower.includes('from teams')) {
    if (lower.includes('id = ?') && lower.includes('team_id = ?')) {
      const id = params[0];
      const t = await Team.findOne({ $or: [{ id }, { team_id: id }] }).lean();
      return t ? [[t]] : [[]];
    }
    if (lower.includes('team_id like')) {
      const teams = await Team.find({ team_id: { $regex: /^TEAM-VRD-/i } }).lean();
      return [teams];
    }
    if (lower.includes('coach_email) = ?') || lower.includes('coach_email = ?')) {
      const email = params[0]?.toLowerCase().trim();
      const t = await Team.findOne({ coach_email: email }).lean();
      return t ? [[t]] : [[]];
    }
    if (lower.includes('lower(team_id) = ?') || lower.includes('team_id = ?')) {
      const identifier = params[0]?.toLowerCase().trim();
      const t = await Team.findOne({
        $or: [
          { id: identifier },
          { team_id: identifier },
          { coach_email: identifier }
        ]
      }).lean();
      return t ? [[t]] : [[]];
    }
    if (lower.includes('id = ?')) {
      const id = params[0];
      const t = await Team.findOne({ id }).lean();
      return t ? [[t]] : [[]];
    }
    const teams = await Team.find({}).sort({ created_at: -1 }).lean();
    return [teams];
  }

  if (lower.startsWith('insert into teams')) {
    const [id, teamId, teamName, coachName, coachEmail, passkeyHash] = params;
    await Team.create({
      id,
      team_id: teamId,
      name: teamName,
      team_name: teamName,
      coach_name: coachName,
      coach_email: coachEmail?.toLowerCase().trim(),
      team_passkey_hash: passkeyHash,
      status: 'APPROVED',
      created_at: new Date(),
      updated_at: new Date()
    });
    return [{ insertId: id, affectedRows: 1 }];
  }

  // 8. SELECT / INSERT from team_players
  if (lower.startsWith('select') && lower.includes('from team_players')) {
    if (lower.includes('count(*)') && lower.includes('team_id = ?')) {
      const count = await TeamPlayer.countDocuments({ team_id: params[0] });
      return [[{ player_count: count }]];
    }
    if (lower.includes('team_id = ?')) {
      const players = await TeamPlayer.find({ team_id: params[0] }).sort({ created_at: 1 }).lean();
      return [players];
    }
    const all = await TeamPlayer.find({}).sort({ created_at: 1 }).lean();
    return [all];
  }

  if (lower.startsWith('insert into team_players')) {
    const [id, team_id, player_name, player_email, player_role] = params;
    await TeamPlayer.create({
      id,
      team_id,
      player_name,
      player_email: player_email?.toLowerCase().trim(),
      player_role,
      created_at: new Date()
    });
    return [{ insertId: id, affectedRows: 1 }];
  }

  // 9. SELECT from tournaments
  if (lower.startsWith('select') && lower.includes('from tournaments')) {
    if (lower.includes('id = ?')) {
      const tourn = await Tournament.findOne({ id: params[0] }).lean();
      return tourn ? [[tourn]] : [[]];
    }
    const allTourns = await Tournament.find({}).lean();
    return [allTourns];
  }

  // 10. SELECT from matches
  if (lower.startsWith('select') && lower.includes('from matches')) {
    if (lower.includes('id = ?')) {
      const m = await Match.findOne({ id: params[0] }).lean();
      return m ? [[m]] : [[]];
    }
    const matches = await Match.find({}).sort({ match_date: -1 }).lean();
    return [matches];
  }

  // 11. SELECT from players
  if (lower.startsWith('select') && lower.includes('from players')) {
    if (lower.includes('id = ?')) {
      const p = await Player.findOne({ id: params[0] }).lean();
      return p ? [[p]] : [[]];
    }
    if (lower.includes('team_id = ?')) {
      const ps = await Player.find({ team_id: params[0] }).lean();
      return [ps];
    }
    const players = await Player.find({}).sort({ name: 1 }).lean();
    return [players];
  }

  // 12. SELECT from innings
  if (lower.startsWith('select') && lower.includes('from innings')) {
    if (lower.includes('match_id = ?') && lower.includes('status = ?')) {
      const [match_id, status] = params;
      const inns = await Innings.find({ match_id, status }).sort({ innings_number: 1 }).lean();
      return [inns];
    }
    if (lower.includes('match_id = ?')) {
      const inns = await Innings.find({ match_id: params[0] }).sort({ innings_number: 1 }).lean();
      return [inns];
    }
    if (lower.includes('id = ?')) {
      const inn = await Innings.findOne({ id: params[0] }).lean();
      return inn ? [[inn]] : [[]];
    }
    const allInns = await Innings.find({}).lean();
    return [allInns];
  }

  // 13. SELECT from deliveries
  if (lower.startsWith('select') && lower.includes('from deliveries')) {
    if (lower.includes('innings_id = ?')) {
      const dels = await Delivery.find({ innings_id: params[0] }).sort({ timestamp: 1 }).lean();
      return [dels];
    }
    if (lower.includes('match_id = ?')) {
      const dels = await Delivery.find({ match_id: params[0] }).sort({ timestamp: 1 }).lean();
      return [dels];
    }
    const dels = await Delivery.find({}).lean();
    return [dels];
  }

  // 14. SELECT from audit_logs
  if (lower.startsWith('select') && lower.includes('from audit_logs')) {
    const logs = await AuditLog.find({}).sort({ timestamp: -1 }).limit(10).lean();
    return [logs];
  }

  // 15. SELECT from districts
  if (lower.startsWith('select') && lower.includes('from districts')) {
    return [memoryDb.districts];
  }

  // 16. SELECT / INSERT / UPDATE / DELETE from notifications
  if (lower.includes('from notifications') || lower.includes('into notifications') || lower.startsWith('update notifications') || lower.startsWith('delete from notifications')) {
    if (lower.startsWith('select')) {
      const notifs = await Notification.find({}).sort({ created_at: -1 }).limit(100).lean();
      return [notifs];
    }
    if (lower.startsWith('insert into notifications')) {
      const [id, title, message, type, targetRole] = params;
      const n = await Notification.create({
        id: id || `NOTIF-${Date.now()}`,
        title: title || 'Notice',
        message: message || '',
        type: type || 'ANNOUNCEMENT',
        reference_id: targetRole || null,
        status: 'UNREAD',
        created_at: new Date()
      });
      return [{ insertId: n.id, affectedRows: 1 }];
    }
    if (lower.startsWith('update notifications')) {
      if (lower.includes('where id = ?')) {
        await Notification.updateOne({ id: params[0] }, { $set: { status: 'READ' } });
        return [{ affectedRows: 1 }];
      }
    }
    if (lower.startsWith('delete from notifications')) {
      await Notification.deleteOne({ id: params[0] });
      return [{ affectedRows: 1 }];
    }
  }

  // Default fallback for unhandled queries
  return [[]];
}

class MongoConnection {
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  async release() {}
  async query(sql, params = []) {
    return mongoQuery(sql, params);
  }
}

module.exports = {
  initDb,
  ping,
  close,
  ensureIndexes,
  seedDefaultData,
  getUseMemoryFallback: () => false,
  memoryDb,
  query: mongoQuery,
  getConnection: async () => new MongoConnection(),
  pool: {
    getConnection: async () => new MongoConnection(),
    query: mongoQuery
  },
  models: {
    User,
    Tournament,
    TournamentRegistration,
    Team,
    Player,
    TeamRegistration,
    Match,
    Innings,
    InningsBatter,
    InningsBowler,
    Delivery,
    Scorer,
    TeamPlayer,
    Notification,
    News,
    Official,
    Venue,
    AuditLog,
    UmpireDecision,
    CricketLaw,
    CricketLawSection,
    CricketLawVersion,
    CricketLawAuditLog,
    TournamentCalculation,
    PlayerMatchRating,
    MasterSetting,
    AdminActionOtp,
    AdminRequest,
    EmailDailyCounter,
    SuperAdminNotification
  }
};
