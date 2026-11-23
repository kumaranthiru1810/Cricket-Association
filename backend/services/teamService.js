/**
 * teamService.js
 *
 * Business logic for Team Registration, Email Verification, and Login.
 * Supports both MySQL and in-memory fallback modes.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool, getUseMemoryFallback, memoryDb } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'cricket_super_secret_jwt_2026';
const BCRYPT_ROUNDS = 10;

// ──────────────────────────────────────────────
// In-memory stores (used when MySQL is absent)
// ──────────────────────────────────────────────
if (!memoryDb.teams) memoryDb.teams = [];
if (!memoryDb.teamAccounts) memoryDb.teamAccounts = [];
if (!memoryDb.districts) {
  memoryDb.districts = [
    { district_id: 1, name: 'Virudhunagar' },
    { district_id: 2, name: 'Madurai' },
    { district_id: 3, name: 'Dindigul' },
    { district_id: 4, name: 'Sivakasi' },
    { district_id: 5, name: 'Rajapalayam' },
  ];
}

// ──────────────────────────────────────────────
// Helper: generate 6-digit OTP token
// ──────────────────────────────────────────────
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ──────────────────────────────────────────────
// Get all districts
// ──────────────────────────────────────────────
async function getDistricts() {
  if (getUseMemoryFallback()) {
    return memoryDb.districts;
  }
  const [rows] = await pool.query('SELECT * FROM districts ORDER BY name');
  return rows;
}

// ──────────────────────────────────────────────
// Register a new team + account
// ──────────────────────────────────────────────
async function registerTeam({ teamName, districtId, captainName, phone, email, password, players }) {
  if (!teamName || !email || !password || !captainName || !phone || !districtId) {
    throw new Error('All fields are required: teamName, districtId, captainName, phone, email, password.');
  }

  if (!players || players.length !== 15) {
    throw new Error('Exactly 15 players are required for team registration.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verificationToken = generateVerificationToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  if (getUseMemoryFallback()) {
    // Check duplicate email
    const existing = memoryDb.teamAccounts.find(a => a.email === email.toLowerCase());
    if (existing) throw new Error('An account with this email already exists.');

    const teamId = memoryDb.teams.length + 1;
    const accountId = memoryDb.teamAccounts.length + 1;

    const team = {
      team_id: teamId,
      team_name: teamName,
      district_id: parseInt(districtId),
      captain_name: captainName,
      phone,
      created_at: new Date().toISOString(),
    };

    const account = {
      account_id: accountId,
      team_id: teamId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      email_verified: false,
      account_status: 'PENDING_EMAIL_VERIFICATION',
      verification_token: verificationToken,
      verification_expires: verificationExpires.toISOString(),
      created_at: new Date().toISOString(),
    };

    memoryDb.teams.push(team);
    memoryDb.teamAccounts.push(account);

    return {
      message: 'Registration successful. Please verify your email.',
      verificationToken, // In production, send via email
      teamId,
      accountId,
    };
  }

  // MySQL path
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT account_id FROM team_accounts WHERE email = ?', [email.toLowerCase()]);
    if (existing.length > 0) throw new Error('An account with this email already exists.');

    const [teamResult] = await conn.query(
      'INSERT INTO teams (team_name, district_id, captain_name, phone) VALUES (?, ?, ?, ?)',
      [teamName, districtId, captainName, phone]
    );
    const teamId = teamResult.insertId;

    if (players && Array.isArray(players) && players.length > 0) {
      if (players.length !== 15) throw new Error('Exactly 15 players are required.');
      
      const emailSet = new Set();
      for (const p of players) {
        if (!p.name || !p.email || !p.role) throw new Error('All players must have a name, email, and role.');
        if (emailSet.has(p.email.toLowerCase())) throw new Error(`Duplicate player email found in team: ${p.email}`);
        emailSet.add(p.email.toLowerCase());
      }
      
      for (const p of players) {
        await conn.query(
          'INSERT INTO team_players (team_id, player_name, player_email, player_role, status) VALUES (?, ?, ?, ?, ?)',
          [teamId, p.name, p.email.toLowerCase(), p.role, 'ACTIVE']
        );
      }
    }

    const [accountResult] = await conn.query(
      `INSERT INTO team_accounts (team_id, email, password_hash, email_verified, account_status, verification_token, verification_expires)
       VALUES (?, ?, ?, false, 'PENDING_EMAIL_VERIFICATION', ?, ?)`,
      [teamId, email.toLowerCase(), passwordHash, verificationToken, verificationExpires]
    );

    await conn.commit();
    return {
      message: 'Registration successful. Please verify your email.',
      verificationToken,
      teamId,
      accountId: accountResult.insertId,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ──────────────────────────────────────────────
// Verify email with token
// ──────────────────────────────────────────────
async function verifyEmail(token) {
  if (!token) throw new Error('Verification token is required.');

  if (getUseMemoryFallback()) {
    const account = memoryDb.teamAccounts.find(a => a.verification_token === token);
    if (!account) throw new Error('Invalid or expired verification token.');
    if (new Date(account.verification_expires) < new Date()) {
      throw new Error('Verification token has expired. Please re-register.');
    }
    account.email_verified = true;
    account.account_status = 'PENDING_APPROVAL';
    account.verification_token = null;
    return { message: 'Email verified successfully. Your account is now pending admin approval.' };
  }

  const [rows] = await pool.query(
    'SELECT * FROM team_accounts WHERE verification_token = ? AND verification_expires > NOW()',
    [token]
  );
  if (rows.length === 0) throw new Error('Invalid or expired verification token.');

  await pool.query(
    `UPDATE team_accounts SET email_verified = true, account_status = 'PENDING_APPROVAL', verification_token = NULL WHERE account_id = ?`,
    [rows[0].account_id]
  );
  return { message: 'Email verified successfully. Your account is now pending admin approval.' };
}

// ──────────────────────────────────────────────
// Team Login
// ──────────────────────────────────────────────
async function loginTeam({ email, password }) {
  if (!email || !password) throw new Error('Email and password are required.');

  if (getUseMemoryFallback()) {
    const account = memoryDb.teamAccounts.find(a => a.email === email.toLowerCase());
    if (!account) throw new Error('Invalid email or password.');

    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) throw new Error('Invalid email or password.');

    if (!account.email_verified) {
      throw new Error('Please verify your email before logging in.');
    }
    if (account.account_status === 'PENDING_APPROVAL') {
      throw new Error('Your account is pending approval from the admin. Please wait.');
    }
    if (account.account_status === 'REJECTED') {
      throw new Error('Your account registration was rejected. Please contact the admin.');
    }
    if (account.account_status === 'DISABLED') {
      throw new Error('Your account has been disabled. Please contact the admin.');
    }
    if (account.account_status !== 'APPROVED') {
      throw new Error('Your account is not active. Please contact the admin.');
    }

    const team = memoryDb.teams.find(t => t.team_id === account.team_id);
    const district = memoryDb.districts.find(d => d.district_id === team.district_id);

    const payload = {
      accountId: account.account_id,
      teamId: account.team_id,
      email: account.email,
      role: 'TEAM',
      teamName: team.team_name,
      district: district ? district.name : '',
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    return {
      message: 'Login successful.',
      token,
      team: {
        teamId: team.team_id,
        teamName: team.team_name,
        captainName: team.captain_name,
        phone: team.phone,
        district: district ? district.name : '',
        email: account.email,
        status: account.account_status,
      },
    };
  }

  // MySQL path
  const [accounts] = await pool.query(
    `SELECT ta.*, t.team_name, t.captain_name, t.phone, t.district_id,
            d.name AS district_name
     FROM team_accounts ta
     JOIN teams t ON ta.team_id = t.team_id
     LEFT JOIN districts d ON t.district_id = d.district_id
     WHERE ta.email = ?`,
    [email.toLowerCase()]
  );

  if (accounts.length === 0) throw new Error('Invalid email or password.');
  const account = accounts[0];

  const match = await bcrypt.compare(password, account.password_hash);
  if (!match) throw new Error('Invalid email or password.');

  if (!account.email_verified) throw new Error('Please verify your email before logging in.');
  if (account.account_status === 'PENDING_APPROVAL') throw new Error('Your account is pending approval from the admin.');
  if (account.account_status === 'REJECTED') throw new Error('Your account registration was rejected.');
  if (account.account_status === 'DISABLED') throw new Error('Your account has been disabled.');
  if (account.account_status !== 'APPROVED') throw new Error('Your account is not active.');

  const payload = {
    accountId: account.account_id,
    teamId: account.team_id,
    email: account.email,
    role: 'TEAM',
    teamName: account.team_name,
    district: account.district_name,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

  return {
    message: 'Login successful.',
    token,
    team: {
      teamId: account.team_id,
      teamName: account.team_name,
      captainName: account.captain_name,
      phone: account.phone,
      district: account.district_name,
      email: account.email,
      status: account.account_status,
    },
  };
}

// ──────────────────────────────────────────────
// Get team profile (protected)
// ──────────────────────────────────────────────
async function getTeamProfile(teamId) {
  if (getUseMemoryFallback()) {
    const team = memoryDb.teams.find(t => t.team_id === parseInt(teamId));
    if (!team) throw new Error('Team not found.');
    const account = memoryDb.teamAccounts.find(a => a.team_id === team.team_id);
    const district = memoryDb.districts.find(d => d.district_id === team.district_id);
    return {
      teamId: team.team_id,
      teamName: team.team_name,
      captainName: team.captain_name,
      phone: team.phone,
      district: district ? district.name : '',
      email: account ? account.email : '',
      status: account ? account.account_status : '',
      createdAt: team.created_at,
    };
  }

  const [rows] = await pool.query(
    `SELECT t.*, ta.email, ta.account_status, d.name AS district_name
     FROM teams t
     JOIN team_accounts ta ON t.team_id = ta.team_id
     LEFT JOIN districts d ON t.district_id = d.district_id
     WHERE t.team_id = ?`,
    [parseInt(teamId)]
  );
  if (rows.length === 0) throw new Error('Team not found.');
  const r = rows[0];
  return {
    teamId: r.team_id,
    teamName: r.team_name,
    captainName: r.captain_name,
    phone: r.phone,
    district: r.district_name,
    email: r.email,
    status: r.account_status,
    createdAt: r.created_at,
  };
}

// ──────────────────────────────────────────────
// Admin: list all teams with their account status
// ──────────────────────────────────────────────
async function getAllTeams() {
  if (getUseMemoryFallback()) {
    return memoryDb.teams.map(team => {
      const account = memoryDb.teamAccounts.find(a => a.team_id === team.team_id);
      const district = memoryDb.districts.find(d => d.district_id === team.district_id);
      return {
        teamId: team.team_id,
        teamName: team.team_name,
        captainName: team.captain_name,
        phone: team.phone,
        district: district ? district.name : '',
        email: account ? account.email : '',
        status: account ? account.account_status : '',
        emailVerified: account ? account.email_verified : false,
        createdAt: team.created_at,
      };
    });
  }

  const [rows] = await pool.query(
    `SELECT t.*, ta.email, ta.account_status, ta.email_verified, d.name AS district_name
     FROM teams t
     JOIN team_accounts ta ON t.team_id = ta.team_id
     LEFT JOIN districts d ON t.district_id = d.district_id
     ORDER BY t.created_at DESC`
  );
  return rows.map(r => ({
    teamId: r.team_id,
    teamName: r.team_name,
    captainName: r.captain_name,
    phone: r.phone,
    district: r.district_name,
    email: r.email,
    status: r.account_status,
    emailVerified: r.email_verified,
    createdAt: r.created_at,
  }));
}

// ──────────────────────────────────────────────
// Admin: approve or reject a team account
// ──────────────────────────────────────────────
async function updateTeamAccountStatus({ teamId, status }) {
  const allowed = ['APPROVED', 'REJECTED', 'DISABLED'];
  if (!allowed.includes(status)) throw new Error(`Invalid status. Must be one of: ${allowed.join(', ')}`);

  if (getUseMemoryFallback()) {
    const account = memoryDb.teamAccounts.find(a => a.team_id === parseInt(teamId));
    if (!account) throw new Error('Team account not found.');
    account.account_status = status;
    return { message: `Team account status updated to ${status}.` };
  }

  const [result] = await pool.query(
    'UPDATE team_accounts SET account_status = ? WHERE team_id = ?',
    [status, parseInt(teamId)]
  );
  if (result.affectedRows === 0) throw new Error('Team account not found.');
  return { message: `Team account status updated to ${status}.` };
}

module.exports = {
  getDistricts,
  registerTeam,
  verifyEmail,
  loginTeam,
  getTeamProfile,
  getAllTeams,
  updateTeamAccountStatus,
};
