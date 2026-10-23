/**
 * config/db.js
 * Comprehensive Database Layer for Cricket Federation
 * Connects to MongoDB via Mongoose with full Schema & Model definitions,
 * auto-seeding default accounts with hashed passwords, and provides SQL query emulation.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cricket_db';

let isConnected = false;

// -------------------------------------------------------------
// Pure MongoDB Schemas & Mongoose Models
// -------------------------------------------------------------

// 1. User Schema (Multi-Role: Player, Coach, Scorer, Admin, Content)
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  mobile: { type: String, default: null },
  password_hash: { type: String, default: null },
  role: { 
    type: String, 
    enum: ['ADMIN', 'COACH', 'TEAM', 'PLAYER', 'SCORER', 'UMPIRE', 'CONTENT', 'USER'], 
    default: 'USER',
    index: true 
  },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED', 'APPROVED'], 
    default: 'ACTIVE',
    index: true 
  },
  player_details: {
    batting_style: { type: String, default: 'Right-Handed Batsman' },
    bowling_style: { type: String, default: 'Right-arm Fast' },
    role: { type: String, default: 'Batsman' },
    playing_role: { type: String, default: 'Batsman' },
    bowling_arm: { type: String, default: '' },
    bowling_category: { type: String, default: '' },
    bowling_action: { type: String, default: '' },
    taluk: { type: String, default: 'Virudhunagar' },
    category: { type: String, default: 'Senior Men' },
    club_choice: { type: String, default: '' },
    team_id: { type: String, default: null },
    team_name: { type: String, default: null }
  },
  scorer_details: {
    certification_level: { type: String, default: 'District Certified' },
    taluk: { type: String, default: 'Virudhunagar' }
  },
  umpire_details: {
    certification_level: { type: String, default: 'Panel A - Senior' },
    taluk: { type: String, default: 'Virudhunagar' },
    date_of_birth: { type: String, default: '' },
    gender: { type: String, default: '' },
    experience: { type: String, default: '' },
    experience_years: { type: Number, default: 0 },
    qualification: { type: String, default: '' },
    certification_number: { type: String, default: '' },
    previous_organization: { type: String, default: '' },
    specialization: { type: String, default: '' },
    address: { type: String, default: '' },
    district: { type: String, default: 'Virudhunagar' },
    state: { type: String, default: 'Tamil Nadu' },
    profile_photo: { type: String, default: '' },
    additional_info: { type: String, default: '' }
  },
  umpire_info: {
    dateOfBirth: { type: String, default: '' },
    gender: { type: String, default: '' },
    experience: { type: String, default: '' },
    qualification: { type: String, default: '' },
    certificationNumber: { type: String, default: '' },
    previousOrganization: { type: String, default: '' },
    specialization: { type: String, default: '' },
    district: { type: String, default: 'Virudhunagar' },
    state: { type: String, default: 'Tamil Nadu' },
    address: { type: String, default: '' },
    profilePhoto: { type: String, default: '' },
    additionalInfo: { type: String, default: '' }
  },
  otp_hash: { type: String, default: null },
  otp_expires_at: { type: Date, default: null },
  otp_attempts: { type: Number, default: 0 },
  otp_verified_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// 2. Tournament Schema
const TournamentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  season: { type: String, default: '2026' },
  category: { type: String, default: 'Senior District Trophy' },
  format: { type: String, default: 'T20' },
  rules: { type: String, default: 'Standard ICC / TNCA Playing Conditions' },
  status: { type: String, enum: ['UPCOMING', 'ACTIVE', 'COMPLETED'], default: 'ACTIVE' },
  start_date: { type: String },
  end_date: { type: String }
}, { timestamps: true });

// 3. Team Schema
const TeamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  team_id: { type: String, default: null, index: true },
  name: { type: String, required: true },
  team_name: { type: String, default: '' },
  short_name: { type: String, default: 'VND' },
  city: { type: String, default: 'Virudhunagar' },
  taluk: { type: String, default: 'Virudhunagar' },
  coach_name: { type: String, default: '' },
  coach_email: { type: String, default: '' },
  team_passkey_hash: { type: String, default: null },
  captain: { type: String, default: '' },
  vice_captain: { type: String, default: '' },
  password_hash: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'APPROVED', 'PENDING', 'INACTIVE'], default: 'ACTIVE' },
  stats: {
    matches: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    tied: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    nrr: { type: Number, default: 0.0 }
  }
}, { timestamps: true });

// 4. Player Schema
const PlayerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  team_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  password_hash: { type: String, default: null },
  role: { type: String, enum: ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'], default: 'BATTER' },
  jersey_number: { type: Number, default: 0 },
  batting_style: { type: String, default: 'Right Hand Bat' },
  bowling_style: { type: String, default: 'Right Arm Medium' },
  status: { type: String, default: 'ACTIVE' },
  stats: {
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    highest_score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    runs_conceded: { type: Number, default: 0 },
    catches: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 }
  }
}, { timestamps: true });

// 5. Team Registration Schema (Coach submission with 15 squad players)
const TeamRegistrationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  team_name: { type: String, required: true },
  coach_name: { type: String, required: true },
  coach_email: { type: String, required: true, lowercase: true, trim: true, index: true },
  password_hash: { type: String, default: null },
  passkey: { type: String, default: '' },
  city: { type: String, default: 'Virudhunagar' },
  taluk: { type: String, default: 'Virudhunagar' },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED'], 
    default: 'PENDING',
    index: true 
  },
  approved_by: { type: String, default: null },
  approved_at: { type: Date, default: null },
  rejection_reason: { type: String, default: null },
  players: [{
    jersey_number: { type: Number },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password_hash: { type: String, default: null },
    role: { type: String, default: 'BATTER' },
    status: { type: String, default: 'PENDING' }
  }]
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// 6. Match Schema
const MatchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  tournament_id: { type: String, default: 'T-2026-VPL' },
  tournament_name: { type: String, default: 'Virudhunagar Premier League 2026' },
  team_a_id: { type: String, required: true },
  team_b_id: { type: String, required: true },
  venue: { type: String, default: 'Kamarajar District Stadium' },
  match_date: { type: String, default: '2026-10-06' },
  match_time: { type: String, default: '09:30 AM' },
  match_type: { type: String, default: 'T20' },
  overs_per_side: { type: Number, default: 20 },
  status: { type: String, enum: ['SCHEDULED', 'TOSS', 'LIVE', 'INNINGS_BREAK', 'PAUSED', 'COMPLETED', 'ABANDONED', 'CANCELLED'], default: 'SCHEDULED', index: true },
  toss_winner_id: { type: String, default: null },
  toss_decision: { type: String, default: null },
  current_innings_number: { type: Number, default: 1 },
  result_summary: { type: String, default: null },
  player_of_match: { type: String, default: null },
  assigned_scorer_id: { type: String, default: 'SCR-101' },
  umpire1_id: { type: String, default: 'UMP-101', index: true },
  umpire2_id: { type: String, default: 'UMP-102', index: true },
  umpire1_name: { type: String, default: 'Thiru. K. Sundaram' },
  umpire2_name: { type: String, default: 'Thiru. M. Ramanathan' },
  umpire_result_confirmed: { type: Boolean, default: false },
  umpire_confirmed_by: { type: String, default: null },
  umpire_confirmation_notes: { type: String, default: null },
  umpire_confirmed_at: { type: Date, default: null },
  team_a_playing_xi: [{ type: String }],
  team_b_playing_xi: [{ type: String }],
  revised_overs: { type: Number, default: null },
  revised_target: { type: Number, default: null },
  revised_comments: { type: String, default: '' },
  is_super_over: { type: Boolean, default: false },
  match_start_time: { type: String, default: null },
  match_end_time: { type: String, default: null },
  breaks: [{
    type: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    duration: { type: String },
    comments: { type: String },
    excludeBatsmanTime: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
  }],
  sessions: [{
    dayNo: { type: Number, default: 1 },
    type: { type: String },
    startInningsNo: { type: Number, default: 1 },
    endInningsNo: { type: Number, default: 1 },
    startOver: { type: String },
    endOver: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    duration: { type: String },
    created_at: { type: Date, default: Date.now }
  }],
  end_days: [{
    dayNo: { type: Number, default: 1 },
    startInningsNo: { type: Number, default: 1 },
    endInningsNo: { type: Number, default: 1 },
    startOver: { type: String },
    endOver: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    duration: { type: String },
    comments: { type: String },
    created_at: { type: Date, default: Date.now }
  }],
  ball_changes: [{
    ballType: { type: String },
    over: { type: String },
    time: { type: String },
    comments: { type: String },
    created_at: { type: Date, default: Date.now }
  }],
  umpire_assessment: {
    umpire1: { type: String, default: '' },
    rating1: { type: Number, default: 5 },
    umpire2: { type: String, default: '' },
    rating2: { type: Number, default: 5 },
    pitchReport: { type: String, default: 'Normal Good Pitch' },
    comments: { type: String, default: '' }
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// 7. Innings Schema
const InningsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  match_id: { type: String, required: true, index: true },
  innings_number: { type: Number, required: true },
  batting_team_id: { type: String, required: true },
  bowling_team_id: { type: String, required: true },
  total_runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  overs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  target: { type: Number, default: null },
  revised_overs: { type: Number, default: null },
  is_super_over: { type: Boolean, default: false },
  is_declared: { type: Boolean, default: false },
  status: { type: String, default: 'LIVE' },
  is_completed: { type: Boolean, default: false },
  is_over_complete: { type: Boolean, default: false },
  current_striker_id: { type: String, default: null },
  current_non_striker_id: { type: String, default: null },
  current_bowler_id: { type: String, default: null },
  previous_bowler_id: { type: String, default: null },
  extras: {
    wides: { type: Number, default: 0 },
    no_balls: { type: Number, default: 0 },
    byes: { type: Number, default: 0 },
    leg_byes: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  }
}, { timestamps: true });

// 8. Innings Batters & Bowlers
const InningsBatterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  innings_id: { type: String, required: true, index: true },
  player_id: { type: String, required: true },
  batting_position: { type: Number, default: 1 },
  runs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  fours: { type: Number, default: 0 },
  sixes: { type: Number, default: 0 },
  strike_rate: { type: Number, default: 0.0 },
  is_out: { type: Boolean, default: false },
  dismissal_type: { type: String, default: null },
  dismissal_text: { type: String, default: 'not out' },
  bowler_id: { type: String, default: null },
  fielder_id: { type: String, default: null }
}, { timestamps: true });

const InningsBowlerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  innings_id: { type: String, required: true, index: true },
  player_id: { type: String, required: true },
  overs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  maidens: { type: Number, default: 0 },
  runs_conceded: { type: Number, default: 0 },
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  wides: { type: Number, default: 0 },
  no_balls: { type: Number, default: 0 },
  economy: { type: Number, default: 0.0 }
}, { timestamps: true });

// 9. Delivery Schema
const DeliverySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  innings_id: { type: String, required: true, index: true },
  match_id: { type: String, default: null, index: true },
  innings_number: { type: Number, default: 1 },
  over_number: { type: Number, required: true },
  ball_number: { type: Number, required: true },
  bowler_id: { type: String, required: true },
  striker_id: { type: String, required: true },
  non_striker_id: { type: String, default: null },
  runs_batter: { type: Number, default: 0 },
  runs_extras: { type: Number, default: 0 },
  extras: { type: Number, default: 0 },
  total_runs: { type: Number, default: 0 },
  extra_type: { type: String, default: 'NONE' },
  is_wicket: { type: Boolean, default: false },
  wicket: { type: Boolean, default: false },
  wicket_type: { type: String, default: null },
  dismissal_type: { type: String, default: null },
  dismissed_player_id: { type: String, default: null },
  boundary_type: { type: String, default: null },
  is_legal_delivery: { type: Boolean, default: true },
  shot_type: { type: String, default: null },
  fielding_position: { type: String, default: null },
  shot_angle: { type: Number, default: null },
  shot_distance: { type: Number, default: null },
  shot_zone: { type: String, default: null },
  fielder_id: { type: String, default: null },
  fielder_name: { type: String, default: null },
  reason: { type: String, default: null },
  replacement_batter_id: { type: String, default: null },
  commentary: { type: String, default: '' },
  created_by: { type: String, default: 'SCR-101' },
  timestamp: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
}, { timestamps: true, strict: false });

// 10. Scorer Schema (Official Match Scorers)
const ScorerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  mobile: { type: String, default: '' },
  association: { type: String, default: 'Virudhunagar District Cricket Association' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  approved_at: { type: Date, default: null },
  rejected_at: { type: Date, default: null },
  rejection_reason: { type: String, default: null },
  otp_hash: { type: String, default: null },
  otp_expires_at: { type: Date, default: null },
  otp_attempts: { type: Number, default: 0 },
  otp_verified_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// 11. Team Player Schema (Squad Players from Team Registrations)
const TeamPlayerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  team_id: { type: String, required: true, index: true },
  player_name: { type: String, required: true },
  player_email: { type: String, required: true, lowercase: true, trim: true },
  player_role: { type: String, default: 'BATTER' },
  created_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at' } });

// 12. Notifications Schema
const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, default: 'GENERAL' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  reference_id: { type: String, default: null },
  status: { type: String, enum: ['UNREAD', 'READ'], default: 'UNREAD' },
  created_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at' } });

// 13. News Schema
const NewsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, default: 'ANNOUNCEMENT' },
  author: { type: String, default: 'District Secretary' },
  image_url: { type: String, default: '/assets_web/stadium.jpg' },
  status: { type: String, default: 'PUBLISHED' }
}, { timestamps: true });

// 14. Officials & Venues & Audit
const OfficialSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  role: { type: String, default: 'SCORER' },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  status: { type: String, default: 'ACTIVE' }
}, { timestamps: true });

const VenueSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  location: { type: String, default: 'Virudhunagar' },
  capacity: { type: Number, default: 5000 },
  floodlights: { type: Boolean, default: true },
  description: { type: String, default: '' }
}, { timestamps: true });

const AuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  action: { type: String, required: true },
  initiated_by: { type: String, default: 'admin@cfvd.org' },
  admin_email: { type: String, default: '' },
  target_user: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  ip_address: { type: String, default: '127.0.0.1' },
  result: { type: String, default: 'SUCCESS' },
  details: { type: String, default: '' }
}, { timestamps: { createdAt: 'timestamp' } });

// Create or reuse Mongoose Models
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', TournamentSchema);
const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);
const Player = mongoose.models.Player || mongoose.model('Player', PlayerSchema);
const TeamRegistration = mongoose.models.TeamRegistration || mongoose.model('TeamRegistration', TeamRegistrationSchema);
const Match = mongoose.models.Match || mongoose.model('Match', MatchSchema);
const Innings = mongoose.models.Innings || mongoose.model('Innings', InningsSchema);
const InningsBatter = mongoose.models.InningsBatter || mongoose.model('InningsBatter', InningsBatterSchema);
const InningsBowler = mongoose.models.InningsBowler || mongoose.model('InningsBowler', InningsBowlerSchema);
const Delivery = mongoose.models.Delivery || mongoose.model('Delivery', DeliverySchema);
const Scorer = mongoose.models.Scorer || mongoose.model('Scorer', ScorerSchema);
const TeamPlayer = mongoose.models.TeamPlayer || mongoose.model('TeamPlayer', TeamPlayerSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
const News = mongoose.models.News || mongoose.model('News', NewsSchema);
const Official = mongoose.models.Official || mongoose.model('Official', OfficialSchema);
const Venue = mongoose.models.Venue || mongoose.model('Venue', VenueSchema);
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

// 15. Umpire Decisions Schema & Model
const UmpireDecisionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  match_id: { type: String, required: true, index: true },
  umpire_id: { type: String, required: true, index: true },
  umpire_name: { type: String, default: '' },
  decision_type: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  inning: { type: Number, default: 1 },
  over: { type: Number, default: 0 },
  ball: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'timestamp' } });

const UmpireDecision = mongoose.models.UmpireDecision || mongoose.model('UmpireDecision', UmpireDecisionSchema);

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

// Seed default users and records if empty
async function seedDefaultData() {
  try {
    const defaultPasswordHash = await bcrypt.hash('1234', 10);
    const adminPasswordHash = await bcrypt.hash('admin123', 10);

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.insertMany([
        {
          id: 'ADM-1001',
          name: 'System Administrator',
          email: 'admin@example.com',
          mobile: '9876543210',
          role: 'ADMIN',
          status: 'ACTIVE',
          password_hash: defaultPasswordHash
        },
        {
          id: 'ADM-1002',
          name: 'Chief Administrator',
          email: 'admin@cfvd.org',
          mobile: '9876543210',
          role: 'ADMIN',
          status: 'ACTIVE',
          password_hash: adminPasswordHash
        },
        {
          id: 'ADM-1003',
          name: 'Association Admin',
          email: 'cricketfederation21@gmail.com',
          mobile: '9876543211',
          role: 'ADMIN',
          status: 'ACTIVE',
          password_hash: adminPasswordHash
        },
        {
          id: 'ADM-1004',
          name: 'Athilingam (Admin & Scorer)',
          email: 'athilingam3336@gmail.com',
          mobile: '9876543212',
          role: 'ADMIN',
          status: 'ACTIVE',
          password_hash: adminPasswordHash
        },
        {
          id: 'ADM-1005',
          name: 'Ponramanan (Admin & Scorer)',
          email: 'ponramanan21@gmail.com',
          mobile: '9876543221',
          role: 'ADMIN',
          status: 'ACTIVE',
          password_hash: adminPasswordHash
        },
        {
          id: 'SCR-101',
          name: 'S. Ramesh',
          email: 'ramesh@gmail.com',
          mobile: '9876543213',
          role: 'SCORER',
          status: 'ACTIVE',
          password_hash: defaultPasswordHash
        },
        {
          id: 'SCR-102',
          name: 'S. Ramesh',
          email: 'scorer@cfvd.org',
          mobile: '9876543213',
          role: 'SCORER',
          status: 'ACTIVE',
          password_hash: defaultPasswordHash
        },
        {
          id: 'SCR-103',
          name: 'K. Murugan',
          email: 'murugan@cfvd.org',
          mobile: '9876543214',
          role: 'SCORER',
          status: 'ACTIVE',
          password_hash: defaultPasswordHash
        },
        {
          id: 'COACH-101',
          name: 'R. Kannan (Coach)',
          email: 'kannan.coach@strikerscc.org',
          mobile: '9876543215',
          role: 'COACH',
          status: 'ACTIVE',
          password_hash: defaultPasswordHash
        },
        {
          id: 'PLY-101',
          name: 'R. Saravanan (Player)',
          email: 'saravanan.r@strikerscc.org',
          mobile: '9876543216',
          role: 'PLAYER',
          status: 'ACTIVE',
          password_hash: defaultPasswordHash,
          player_details: {
            batting_style: 'Right Hand Bat',
            bowling_style: 'Right Arm Fast/Medium',
            taluk: 'Virudhunagar',
            category: 'Senior Men',
            club_choice: 'Sivakasi Strikers'
          }
        },
        {
          id: 'PLY-201',
          name: 'Arun Pandian',
          email: 'player@example.com',
          mobile: '9876543214',
          password_hash: defaultPasswordHash,
          role: 'PLAYER',
          status: 'ACTIVE'
        },
        {
          id: 'USR-301',
          name: 'General User',
          email: 'user@example.com',
          mobile: '9876543215',
          password_hash: defaultPasswordHash,
          role: 'USER',
          status: 'ACTIVE'
        },
        {
          id: 'UMP-101',
          name: 'Thiru. K. Sundaram',
          email: 'sundaram.umpire@cfvd.org',
          mobile: '9443112345',
          password_hash: defaultPasswordHash,
          role: 'UMPIRE',
          status: 'ACTIVE',
          umpire_details: {
            certification_level: 'Panel A - Senior',
            taluk: 'Virudhunagar'
          }
        },
        {
          id: 'UMP-102',
          name: 'Thiru. M. Ramanathan',
          email: 'ramanathan.umpire@cfvd.org',
          mobile: '9842267890',
          password_hash: defaultPasswordHash,
          role: 'UMPIRE',
          status: 'ACTIVE',
          umpire_details: {
            certification_level: 'Senior Panel',
            taluk: 'Sivakasi'
          }
        }
      ]);
      console.log('✅ Seeded default Admin, Scorer, Umpire, Coach, and Player accounts.');
    }

    // Ensure default Umpire accounts exist even if user collection already had rows
    await User.findOneAndUpdate(
      { email: 'sundaram.umpire@cfvd.org' },
      {
        $setOnInsert: {
          id: 'UMP-101',
          name: 'Thiru. K. Sundaram',
          email: 'sundaram.umpire@cfvd.org',
          mobile: '9443112345',
          password_hash: defaultPasswordHash,
          role: 'UMPIRE',
          status: 'ACTIVE',
          umpire_details: {
            certification_level: 'Panel A - Senior',
            taluk: 'Virudhunagar'
          }
        }
      },
      { upsert: true }
    );
    await User.findOneAndUpdate(
      { email: 'ramanathan.umpire@cfvd.org' },
      {
        $setOnInsert: {
          id: 'UMP-102',
          name: 'Thiru. M. Ramanathan',
          email: 'ramanathan.umpire@cfvd.org',
          mobile: '9842267890',
          password_hash: defaultPasswordHash,
          role: 'UMPIRE',
          status: 'ACTIVE',
          umpire_details: {
            certification_level: 'Senior Panel',
            taluk: 'Sivakasi'
          }
        }
      },
      { upsert: true }
    );

    // Seed Scorers
    const scorerCount = await Scorer.countDocuments();
    if (scorerCount === 0) {
      await Scorer.insertMany([
        { id: 'SCR-101', full_name: 'S. Ramesh', email: 'ramesh@gmail.com', mobile: '9876543213', association: 'Virudhunagar District Cricket Association', status: 'APPROVED' },
        { id: 'SCR-102', full_name: 'S. Ramesh', email: 'scorer@cfvd.org', mobile: '9876543213', association: 'Virudhunagar District Cricket Association', status: 'APPROVED' },
        { id: 'SCR-103', full_name: 'K. Murugan', email: 'murugan@cfvd.org', mobile: '9876543214', association: 'Virudhunagar District Cricket Association', status: 'APPROVED' },
        { id: 'SCORER-101', full_name: 'Thiru. K. Sundararajan', email: 'sundararajan@cfvd.org', mobile: '+91 94431 12345', association: 'Virudhunagar Taluk', status: 'APPROVED' },
        { id: 'SCORER-102', full_name: 'Thiru. M. Venkatesh', email: 'venkatesh.m@gmail.com', mobile: '+91 98422 67890', association: 'Rajapalayam Taluk', status: 'APPROVED' },
        { id: 'SCORER-103', full_name: 'Thiru. S. Pitchaimuthu', email: 'pitchai.s@yahoo.com', mobile: '+91 97890 23456', association: 'Sattur Taluk', status: 'PENDING' },
        { id: 'SCORER-104', full_name: 'Thiru. R. Vignesh Kumar', email: 'vignesh.k@gmail.com', mobile: '+91 96555 89012', association: 'Aruppukottai Taluk', status: 'PENDING' },
        { id: 'SCORER-105', full_name: 'Thiru. P. Arumugam', email: 'arumugam.p@gmail.com', mobile: '+91 99444 34567', association: 'Sivakasi Taluk', status: 'REJECTED' }
      ]);
    }

    // Seed Tournaments
    const tournamentCount = await Tournament.countDocuments();
    if (tournamentCount === 0) {
      await Tournament.insertMany([
        { id: 'T-2026-VPL', name: 'Virudhunagar Premier League 2026', season: '2026', category: 'Senior District Trophy', format: 'T20', status: 'ACTIVE', start_date: '2026-10-01', end_date: '2026-10-25' },
        { id: 'T-2026-U19', name: 'District Under-19 Championship', season: '2026', category: 'Junior Championship', format: 'One Day 50 Overs', status: 'UPCOMING', start_date: '2026-11-01', end_date: '2026-11-20' }
      ]);
    }

    // Seed Teams
    const teamCount = await Team.countDocuments();
    if (teamCount === 0) {
      await Team.insertMany([
        { id: 'TM-01', team_id: 'TEAM-VRD-101', name: 'Virudhunagar Spartans', team_name: 'Virudhunagar Spartans', short_name: 'VND', city: 'Virudhunagar', taluk: 'Virudhunagar', coach_name: 'K. Muthu', coach_email: 'coach@cfvd.org', captain: 'Suresh Kumar', vice_captain: 'Vijay Anand', status: 'ACTIVE', stats: { matches: 5, won: 4, lost: 1, tied: 0, points: 8, nrr: 1.25 } },
        { id: 'TM-02', team_id: 'TEAM-VRD-102', name: 'Sivakasi Strikers', team_name: 'Sivakasi Strikers', short_name: 'SVK', city: 'Sivakasi', taluk: 'Sivakasi', coach_name: 'S. Ganesan', coach_email: 'ganesan@strikers.com', captain: 'Dinesh Karthik', vice_captain: 'R. Ashwin', status: 'ACTIVE', stats: { matches: 5, won: 3, lost: 2, tied: 0, points: 6, nrr: 0.85 } },
        { id: 'TM-03', team_id: 'TEAM-VRD-103', name: 'Rajapalayam Royals', team_name: 'Rajapalayam Royals', short_name: 'RPY', city: 'Rajapalayam', taluk: 'Rajapalayam', coach_name: 'R. Subramanian', coach_email: 'coach.royals@gmail.com', captain: 'M. Vijay', vice_captain: 'K. Balaji', status: 'ACTIVE', stats: { matches: 5, won: 2, lost: 3, tied: 0, points: 4, nrr: -0.15 } },
        { id: 'TM-04', team_id: 'TEAM-VRD-104', name: 'Aruppukottai Aces', team_name: 'Aruppukottai Aces', short_name: 'APK', city: 'Aruppukottai', taluk: 'Aruppukottai', coach_name: 'V. Raman', coach_email: 'coach.aces@gmail.com', captain: 'P. Saravanan', vice_captain: 'T. Prabhu', status: 'ACTIVE', stats: { matches: 4, won: 1, lost: 3, tied: 0, points: 2, nrr: -1.10 } }
      ]);
    }

    // Seed Players
    const playerCount = await Player.countDocuments();
    if (playerCount === 0) {
      await Player.insertMany([
        // Team 1 (TM-01) - 15 Genuine Players
        { id: 'P301', team_id: 'TM-01', name: 'Suresh Kumar', email: 'suresh@spartans.com', role: 'BATTER', jersey_number: 7, batting_style: 'Right Hand Bat', stats: { runs: 284, balls: 195, fours: 32, sixes: 10, highest_score: 88, wickets: 0, overs: 0, runs_conceded: 0, catches: 4, stumpings: 0 } },
        { id: 'P302', team_id: 'TM-01', name: 'Muthu Raj', email: 'muthuraj@spartans.com', role: 'ALL_ROUNDER', jersey_number: 18, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium', stats: { runs: 165, balls: 110, fours: 15, sixes: 6, highest_score: 54, wickets: 8, overs: 18, runs_conceded: 124, catches: 3, stumpings: 0 } },
        { id: 'P303', team_id: 'TM-01', name: 'Vijay', email: 'vijay@spartans.com', role: 'BATTER', jersey_number: 3, batting_style: 'Left Hand Bat', stats: { runs: 142, balls: 98, fours: 14, sixes: 4, highest_score: 45, wickets: 0, overs: 0, runs_conceded: 0, catches: 2, stumpings: 0 } },
        { id: 'P304', team_id: 'TM-01', name: 'K. Balaji', email: 'balaji@spartans.com', role: 'WICKET_KEEPER', jersey_number: 1, batting_style: 'Right Hand Bat', stats: { runs: 112, balls: 85, fours: 10, sixes: 2, highest_score: 38, wickets: 0, overs: 0, runs_conceded: 0, catches: 6, stumpings: 3 } },
        { id: 'P305', team_id: 'TM-01', name: 'R. Vignesh', email: 'vignesh@spartans.com', role: 'BOWLER', jersey_number: 23, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast', stats: { runs: 24, balls: 18, fours: 2, sixes: 1, highest_score: 14, wickets: 12, overs: 20, runs_conceded: 130, catches: 1, stumpings: 0 } },
        { id: 'P306', team_id: 'TM-01', name: 'Arun Pandian', email: 'player@example.com', role: 'ALL_ROUNDER', jersey_number: 10, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium', stats: { runs: 198, balls: 135, fours: 21, sixes: 7, highest_score: 62, wickets: 6, overs: 14, runs_conceded: 98, catches: 5, stumpings: 0 } },
        { id: 'P307', team_id: 'TM-01', name: 'Saravanan', email: 'saravanan@spartans.com', role: 'BOWLER', jersey_number: 25, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast', stats: { runs: 15, balls: 10, fours: 1, sixes: 0, highest_score: 8, wickets: 10, overs: 18, runs_conceded: 120, catches: 1, stumpings: 0 } },
        { id: 'P308', team_id: 'TM-01', name: 'Vijay Anand', email: 'vijayanand@spartans.com', role: 'ALL_ROUNDER', jersey_number: 9, batting_style: 'Right Hand Bat', stats: { runs: 150, balls: 100, fours: 15, sixes: 4, highest_score: 52, wickets: 5, overs: 12, runs_conceded: 80, catches: 2, stumpings: 0 } },
        { id: 'P309', team_id: 'TM-01', name: 'S. Manoj', role: 'BATTER', jersey_number: 11 },
        { id: 'P310', team_id: 'TM-01', name: 'P. Rajesh', role: 'BOWLER', jersey_number: 14 },
        { id: 'P311', team_id: 'TM-01', name: 'K. Siva', role: 'ALL_ROUNDER', jersey_number: 17 },
        { id: 'P312', team_id: 'TM-01', name: 'T. Ashok', role: 'BOWLER', jersey_number: 24 },
        { id: 'P313', team_id: 'TM-01', name: 'M. Guru', role: 'ALL_ROUNDER', jersey_number: 28 },
        { id: 'P314', team_id: 'TM-01', name: 'V. Prakash', role: 'BATTER', jersey_number: 33 },
        { id: 'P315', team_id: 'TM-01', name: 'B. Senthil', role: 'BOWLER', jersey_number: 99 },

        // Team 2 (TM-02) - 15 Genuine Players
        { id: 'P401', team_id: 'TM-02', name: 'Karthik N', email: 'karthik.n@strikers.com', role: 'BOWLER', jersey_number: 21, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast', stats: { runs: 240, balls: 160, fours: 26, sixes: 8, highest_score: 72, wickets: 14, overs: 20, runs_conceded: 110, catches: 7, stumpings: 2 } },
        { id: 'P402', team_id: 'TM-02', name: 'R. Ashwin', email: 'ashwin@strikers.com', role: 'ALL_ROUNDER', jersey_number: 99, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Off Break', stats: { runs: 120, balls: 82, fours: 12, sixes: 3, highest_score: 41, wickets: 11, overs: 20, runs_conceded: 115, catches: 2, stumpings: 0 } },
        { id: 'P403', team_id: 'TM-02', name: 'S. Balamurugan', email: 'bala@strikers.com', role: 'BOWLER', jersey_number: 11, batting_style: 'Right Hand Bat', bowling_style: 'Left Arm Fast', stats: { runs: 18, balls: 12, fours: 2, sixes: 0, highest_score: 11, wickets: 9, overs: 19, runs_conceded: 128, catches: 1, stumpings: 0 } },
        { id: 'P404', team_id: 'TM-02', name: 'Dinesh Karthik', email: 'dinesh@strikers.com', role: 'WICKET_KEEPER', jersey_number: 19, batting_style: 'Right Hand Bat', stats: { runs: 215, balls: 142, fours: 24, sixes: 6, highest_score: 72, wickets: 0, overs: 0, runs_conceded: 0, catches: 5, stumpings: 1 } },
        { id: 'P405', team_id: 'TM-02', name: 'Saravanan', email: 'saravanan.s@strikers.com', role: 'BOWLER', jersey_number: 23, batting_style: 'Right Hand Bat', stats: { runs: 30, balls: 20, fours: 3, sixes: 0, highest_score: 15, wickets: 8, overs: 16, runs_conceded: 105, catches: 2, stumpings: 0 } },
        { id: 'P406', team_id: 'TM-02', name: 'M. Karthik', role: 'BATTER', jersey_number: 5 },
        { id: 'P407', team_id: 'TM-02', name: 'S. Ram', role: 'ALL_ROUNDER', jersey_number: 8 },
        { id: 'P408', team_id: 'TM-02', name: 'P. Selvam', role: 'BOWLER', jersey_number: 12 },
        { id: 'P409', team_id: 'TM-02', name: 'K. Murugan', role: 'BATTER', jersey_number: 15 },
        { id: 'P410', team_id: 'TM-02', name: 'T. Rajan', role: 'WICKET_KEEPER', jersey_number: 16 },
        { id: 'P411', team_id: 'TM-02', name: 'A. Alex', role: 'ALL_ROUNDER', jersey_number: 22 },
        { id: 'P412', team_id: 'TM-02', name: 'G. Gokul', role: 'BOWLER', jersey_number: 27 },
        { id: 'P413', team_id: 'TM-02', name: 'D. Deepak', role: 'BATTER', jersey_number: 30 },
        { id: 'P414', team_id: 'TM-02', name: 'N. Natarajan', role: 'BOWLER', jersey_number: 44 },
        { id: 'P415', team_id: 'TM-02', name: 'V. Vinoth', role: 'BATTER', jersey_number: 88 },

        // Team 3 (TM-03) - 15 Genuine Players
        { id: 'P501', team_id: 'TM-03', name: 'M. Vijay', email: 'vijay@royals.com', role: 'BATTER', jersey_number: 8, batting_style: 'Right Hand Bat', stats: { runs: 210, balls: 140, fours: 22, sixes: 5, highest_score: 65, wickets: 0, overs: 0, runs_conceded: 0, catches: 3, stumpings: 0 } },
        { id: 'P502', team_id: 'TM-03', name: 'K. Balaji', email: 'balaji@royals.com', role: 'ALL_ROUNDER', jersey_number: 12, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium', stats: { runs: 130, balls: 90, fours: 12, sixes: 3, highest_score: 42, wickets: 7, overs: 16, runs_conceded: 110, catches: 2, stumpings: 0 } },
        { id: 'P503', team_id: 'TM-03', name: 'S. Saravanan', email: 'saravanan@royals.com', role: 'BOWLER', jersey_number: 25, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast', stats: { runs: 15, balls: 10, fours: 1, sixes: 0, highest_score: 8, wickets: 10, overs: 18, runs_conceded: 120, catches: 1, stumpings: 0 } },
        { id: 'P504', team_id: 'TM-03', name: 'R. Anbarasu', role: 'BATTER', jersey_number: 3 },
        { id: 'P505', team_id: 'TM-03', name: 'S. Dhanush', role: 'BATTER', jersey_number: 7 },
        { id: 'P506', team_id: 'TM-03', name: 'K. Manikandan', role: 'WICKET_KEEPER', jersey_number: 9 },
        { id: 'P507', team_id: 'TM-03', name: 'P. Thirumalai', role: 'ALL_ROUNDER', jersey_number: 10 },
        { id: 'P508', team_id: 'TM-03', name: 'V. Vasanth', role: 'BOWLER', jersey_number: 13 },
        { id: 'P509', team_id: 'TM-03', name: 'T. Senthil Kumar', role: 'BOWLER', jersey_number: 18 },
        { id: 'P510', team_id: 'TM-03', name: 'M. Siva Sankaran', role: 'BATTER', jersey_number: 21 },
        { id: 'P511', team_id: 'TM-03', name: 'G. Ganeshamoorthi', role: 'BOWLER', jersey_number: 23 },
        { id: 'P512', team_id: 'TM-03', name: 'N. Naveen Kumar', role: 'BATTER', jersey_number: 29 },
        { id: 'P513', team_id: 'TM-03', name: 'C. Chellappa', role: 'ALL_ROUNDER', jersey_number: 31 },
        { id: 'P514', team_id: 'TM-03', name: 'B. Balasubramanian', role: 'BOWLER', jersey_number: 77 },
        { id: 'P515', team_id: 'TM-03', name: 'A. Ayyappan', role: 'ALL_ROUNDER', jersey_number: 91 },

        // Team 4 (TM-04) - 15 Genuine Players
        { id: 'P601', team_id: 'TM-04', name: 'P. Saravanan', email: 'saravanan@aces.com', role: 'BATTER', jersey_number: 5, batting_style: 'Right Hand Bat', stats: { runs: 195, balls: 130, fours: 18, sixes: 4, highest_score: 58, wickets: 0, overs: 0, runs_conceded: 0, catches: 4, stumpings: 0 } },
        { id: 'P602', team_id: 'TM-04', name: 'T. Prabhu', email: 'prabhu@aces.com', role: 'BOWLER', jersey_number: 14, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium', stats: { runs: 20, balls: 15, fours: 2, sixes: 0, highest_score: 12, wickets: 8, overs: 15, runs_conceded: 105, catches: 1, stumpings: 0 } },
        { id: 'P603', team_id: 'TM-04', name: 'R. Kameswaran', role: 'BATTER', jersey_number: 4 },
        { id: 'P604', team_id: 'TM-04', name: 'S. Sundaram', role: 'ALL_ROUNDER', jersey_number: 6 },
        { id: 'P605', team_id: 'TM-04', name: 'K. Alagarsamy', role: 'WICKET_KEEPER', jersey_number: 1 },
        { id: 'P606', team_id: 'TM-04', name: 'M. Selvakumar', role: 'BATTER', jersey_number: 11 },
        { id: 'P607', team_id: 'TM-04', name: 'P. Pandiarajan', role: 'BOWLER', jersey_number: 15 },
        { id: 'P608', team_id: 'TM-04', name: 'V. Vellaisamy', role: 'ALL_ROUNDER', jersey_number: 19 },
        { id: 'P609', team_id: 'TM-04', name: 'D. Dharmaraj', role: 'BOWLER', jersey_number: 22 },
        { id: 'P610', team_id: 'TM-04', name: 'T. Thangavel', role: 'BATTER', jersey_number: 26 },
        { id: 'P611', team_id: 'TM-04', name: 'A. Muthukrishnan', role: 'BOWLER', jersey_number: 32 },
        { id: 'P612', team_id: 'TM-04', name: 'S. Subramani', role: 'BATTER', jersey_number: 35 },
        { id: 'P613', team_id: 'TM-04', name: 'K. Marimuthu', role: 'ALL_ROUNDER', jersey_number: 45 },
        { id: 'P614', team_id: 'TM-04', name: 'M. Ramachandran', role: 'BOWLER', jersey_number: 55 },
        { id: 'P615', team_id: 'TM-04', name: 'R. Ravichandran', role: 'BATTER', jersey_number: 66 }
      ]);
    }

    // Seed Matches
    const matchCount = await Match.countDocuments();
    if (matchCount === 0) {
      await Match.insertMany([
        {
          id: 'M001',
          tournament_id: 'T-2026-VPL',
          tournament_name: 'Virudhunagar Premier League 2026',
          team_a_id: 'TM-01',
          team_b_id: 'TM-03',
          venue: 'Kamarajar District Stadium',
          match_date: '2026-10-08',
          match_time: '02:30 PM',
          match_type: 'T20',
          overs_per_side: 20,
          status: 'SCHEDULED',
          assigned_scorer_id: 'SCR-101',
          umpire1_id: 'UMP-101',
          umpire2_id: 'UMP-102',
          umpire1_name: 'Thiru. K. Sundaram',
          umpire2_name: 'Thiru. M. Ramanathan'
        },
        {
          id: 'M002',
          tournament_id: 'T-2026-VPL',
          tournament_name: 'Virudhunagar Premier League 2026',
          team_a_id: 'TM-01',
          team_b_id: 'TM-02',
          venue: 'Kamarajar District Stadium',
          match_date: '2026-10-06',
          match_time: '09:30 AM',
          match_type: 'T20',
          overs_per_side: 20,
          status: 'LIVE',
          toss_winner_id: 'TM-01',
          toss_decision: 'BAT',
          current_innings_number: 1,
          assigned_scorer_id: 'SCR-101',
          umpire1_id: 'UMP-101',
          umpire2_id: 'UMP-102',
          umpire1_name: 'Thiru. K. Sundaram',
          umpire2_name: 'Thiru. M. Ramanathan'
        },
        {
          id: 'M003',
          tournament_id: 'T-2026-VPL',
          tournament_name: 'Virudhunagar Premier League 2026',
          team_a_id: 'TM-01',
          team_b_id: 'TM-02',
          venue: 'Kamarajar Stadium, Virudhunagar',
          match_date: '2026-10-04',
          match_time: '09:30 AM',
          match_type: 'T20',
          overs_per_side: 20,
          status: 'COMPLETED',
          toss_winner_id: 'TM-01',
          toss_decision: 'BAT',
          result_summary: 'Virudhunagar Strikers won by 7 wickets',
          player_of_match: 'Dinesh Karthik',
          assigned_scorer_id: 'SCR-101',
          umpire1_id: 'UMP-101',
          umpire2_id: 'UMP-102',
          umpire1_name: 'Thiru. K. Sundaram',
          umpire2_name: 'Thiru. M. Ramanathan'
        }
      ]);
    }

    // Ensure matches have umpire assignments populated
    await Match.updateMany(
      { umpire1_id: { $exists: false } },
      { $set: { umpire1_id: 'UMP-101', umpire2_id: 'UMP-102', umpire1_name: 'Thiru. K. Sundaram', umpire2_name: 'Thiru. M. Ramanathan' } }
    );

    // Seed Innings
    const innCount = await Innings.countDocuments();
    if (innCount === 0) {
      await Innings.insertMany([
        {
          id: 'INN-M002-1',
          match_id: 'M002',
          innings_number: 1,
          batting_team_id: 'TM-01',
          bowling_team_id: 'TM-02',
          total_runs: 142,
          wickets: 3,
          overs: 16,
          balls: 2,
          is_completed: false,
          is_over_complete: false,
          status: 'LIVE',
          extras: { wides: 4, no_balls: 1, byes: 2, leg_byes: 1, total: 8 }
        },
        {
          id: 'INN-M003-1',
          match_id: 'M003',
          innings_number: 1,
          batting_team_id: 'TM-01',
          bowling_team_id: 'TM-02',
          total_runs: 160,
          wickets: 8,
          overs: 20,
          balls: 0,
          is_completed: true,
          status: 'COMPLETED',
          extras: { wides: 6, no_balls: 1, byes: 2, leg_byes: 2, total: 11 }
        },
        {
          id: 'INN-M003-2',
          match_id: 'M003',
          innings_number: 2,
          batting_team_id: 'TM-02',
          bowling_team_id: 'TM-01',
          total_runs: 144,
          wickets: 9,
          overs: 20,
          balls: 0,
          is_completed: true,
          status: 'COMPLETED',
          target: 161,
          extras: { wides: 5, no_balls: 0, byes: 1, leg_byes: 3, total: 9 }
        }
      ]);
    }

    // Seed Batters & Bowlers
    const batterCount = await InningsBatter.countDocuments();
    if (batterCount === 0) {
      await InningsBatter.insertMany([
        { id: 'IBAT-01', innings_id: 'INN-M002-1', player_id: 'P301', batting_position: 1, runs: 64, balls: 42, fours: 8, sixes: 2, strike_rate: 152.38, is_out: false },
        { id: 'IBAT-02', innings_id: 'INN-M002-1', player_id: 'P302', batting_position: 2, runs: 28, balls: 22, fours: 3, sixes: 1, strike_rate: 127.27, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P402', fielder_id: 'P401' },
        { id: 'IBAT-03', innings_id: 'INN-M002-1', player_id: 'P303', batting_position: 3, runs: 35, balls: 24, fours: 4, sixes: 1, strike_rate: 145.83, is_out: false },
        { id: 'IBAT-M003-01', innings_id: 'INN-M003-1', player_id: 'P301', batting_position: 1, runs: 42, balls: 30, fours: 4, sixes: 1, strike_rate: 140.0, is_out: false },
        { id: 'IBAT-M003-02', innings_id: 'INN-M003-1', player_id: 'P302', batting_position: 2, runs: 12, balls: 10, fours: 1, sixes: 0, strike_rate: 120.0, is_out: true, dismissal_type: 'BOWLED', bowler_id: 'P401' },
        { id: 'IBAT-M003-03', innings_id: 'INN-M003-1', player_id: 'P303', batting_position: 3, runs: 18, balls: 14, fours: 2, sixes: 0, strike_rate: 128.57, is_out: false }
      ]);
    }

    const bowlerCount = await InningsBowler.countDocuments();
    if (bowlerCount === 0) {
      await InningsBowler.insertMany([
        { id: 'IBOW-01', innings_id: 'INN-M002-1', player_id: 'P401', overs: 3, balls: 2, maidens: 0, runs_conceded: 28, runs: 28, wickets: 1, no_balls: 1, wides: 2, economy: 8.40 },
        { id: 'IBOW-02', innings_id: 'INN-M002-1', player_id: 'P402', overs: 4, balls: 0, maidens: 0, runs_conceded: 32, runs: 32, wickets: 2, no_balls: 0, wides: 1, economy: 8.00 },
        { id: 'IBOW-M003-01', innings_id: 'INN-M003-1', player_id: 'P401', overs: 4, balls: 0, maidens: 0, runs_conceded: 24, runs: 24, wickets: 2, no_balls: 0, wides: 2, economy: 6.00 },
        { id: 'IBOW-M003-02', innings_id: 'INN-M003-1', player_id: 'P307', overs: 4, balls: 0, maidens: 0, runs_conceded: 26, runs: 26, wickets: 2, no_balls: 1, wides: 2, economy: 6.50 }
      ]);
    }

    // Seed Deliveries
    const deliveryCount = await Delivery.countDocuments();
    if (deliveryCount === 0) {
      await Delivery.insertMany([
        {
          id: 'DEL-M002-1-01',
          match_id: 'M002',
          innings_id: 'INN-M002-1',
          innings_number: 1,
          over_number: 1,
          ball_number: 1,
          striker_id: 'P301',
          non_striker_id: 'P302',
          bowler_id: 'P401',
          runs_batter: 1,
          runs_extras: 0,
          total_runs: 1,
          extra_type: 'NONE',
          wicket: false,
          is_legal_delivery: true,
          commentary: '1 run pushed to cover.',
          timestamp: new Date()
        },
        {
          id: 'DEL-M002-1-02',
          match_id: 'M002',
          innings_id: 'INN-M002-1',
          innings_number: 1,
          over_number: 1,
          ball_number: 2,
          striker_id: 'P302',
          non_striker_id: 'P301',
          bowler_id: 'P401',
          runs_batter: 4,
          runs_extras: 0,
          total_runs: 4,
          extra_type: 'NONE',
          boundary_type: 'FOUR',
          wicket: false,
          is_legal_delivery: true,
          commentary: 'FOUR! Dispatched to the boundary.',
          timestamp: new Date()
        }
      ]);
    }

    // Seed Team Registrations
    const regCount = await TeamRegistration.countDocuments();
    if (regCount === 0) {
      await TeamRegistration.insertMany([
        {
          id: 'TEAM-VRD-101',
          team_name: 'Virudhunagar Spartans',
          coach_name: 'K. Muthu',
          coach_email: 'coach@cfvd.org',
          passkey: 'PASS-7788',
          city: 'Virudhunagar',
          taluk: 'Virudhunagar',
          status: 'APPROVED',
          approved_by: 'ADM-1001',
          approved_at: new Date('2026-10-01'),
          players: [
            { jersey_number: 7, name: 'Suresh Kumar', email: 'suresh@spartans.com', role: 'BATTER', status: 'APPROVED' },
            { jersey_number: 18, name: 'Muthu Raj', email: 'muthuraj@spartans.com', role: 'ALL_ROUNDER', status: 'APPROVED' },
            { jersey_number: 3, name: 'Vijay', email: 'vijay@spartans.com', role: 'BATTER', status: 'APPROVED' },
            { jersey_number: 1, name: 'K. Balaji', email: 'balaji@spartans.com', role: 'WICKET_KEEPER', status: 'APPROVED' },
            { jersey_number: 23, name: 'R. Vignesh', email: 'vignesh@spartans.com', role: 'BOWLER', status: 'APPROVED' },
            { jersey_number: 10, name: 'Arun Pandian', email: 'player@example.com', role: 'ALL_ROUNDER', status: 'APPROVED' }
          ]
        },
        {
          id: 'TEAM-VRD-102',
          team_name: 'Sattur Super Kings',
          coach_name: 'R. Kannan',
          coach_email: 'coach.sattur@gmail.com',
          passkey: 'PASS-5544',
          city: 'Sattur',
          taluk: 'Sattur',
          status: 'PENDING',
          players: [
            { jersey_number: 1, name: 'M. Karthik', email: 'karthik@sattur.com', role: 'BATTER', status: 'PENDING' },
            { jersey_number: 2, name: 'S. Ram', email: 'ram@sattur.com', role: 'ALL_ROUNDER', status: 'PENDING' }
          ]
        }
      ]);
    }

    // Seed News
    const newsCount = await News.countDocuments();
    if (newsCount === 0) {
      await News.insertMany([
        {
          id: 'NEWS-01',
          title: 'Virudhunagar Premier League 2026 Inaugurated in Kamarajar Stadium',
          summary: 'The grand opening of VPL 2026 kicked off today with 8 affiliated clubs participating in the premier district championship.',
          content: 'The Cricket Association of Virudhunagar District officially inaugurated the Virudhunagar Premier League 2026.',
          category: 'TOURNAMENT',
          author: 'Association Press',
          image_url: '/assets_web/champions.jpg',
          status: 'PUBLISHED'
        }
      ]);
    }

    // Seed Notifications
    const notifCount = await Notification.countDocuments();
    if (notifCount === 0) {
      await Notification.insertMany([
        {
          id: 'NOTIF-01',
          type: 'TEAM_REGISTRATION',
          title: 'New Team Registration: Sattur Super Kings',
          message: 'Coach R. Kannan submitted team Sattur Super Kings. Awaiting administrative review.',
          reference_id: 'TEAM-VRD-102',
          status: 'UNREAD'
        }
      ]);
    }

    // Seed Venues
    const venueCount = await Venue.countDocuments();
    if (venueCount === 0) {
      await Venue.insertMany([
        { id: 'VEN-01', name: 'Kamarajar District Stadium', location: 'Virudhunagar Central', capacity: 8000, floodlights: true, description: 'Main association ground.' },
        { id: 'VEN-02', name: 'Sivakasi Cricket Ground', location: 'Sivakasi Bypass', capacity: 4000, floodlights: true, description: 'Premium turf pitch ground.' }
      ]);
    }

    // Seed Officials
    const officialCount = await Official.countDocuments();
    if (officialCount === 0) {
      await Official.insertMany([
        { id: 'OFF-01', name: 'S. Ramesh', role: 'SCORER', email: 'ramesh@gmail.com', phone: '9876543213', status: 'ACTIVE' },
        { id: 'OFF-02', name: 'K. Murugan', role: 'SCORER', email: 'murugan@cfvd.org', phone: '9876543214', status: 'ACTIVE' }
      ]);
    }
  } catch (err) {
    console.warn('Seed note:', err.message);
  }
}

// Connect to MongoDB
let connectionPromise = null;
async function initDb() {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  if (connectionPromise) {
    return connectionPromise;
  }
  connectionPromise = (async () => {
    try {
      mongoose.set('strictQuery', false);
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: true
      });
      isConnected = true;
      console.log(`🍃 Connected to MongoDB Database Server at: ${MONGODB_URI}`);
      await seedDefaultData();
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
    UmpireDecision
  }
};
