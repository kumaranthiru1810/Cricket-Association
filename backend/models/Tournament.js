/**
 * backend/models/Tournament.js
 * Tournament, TournamentRegistration & TournamentCalculation Mongoose Models
 */

const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  short_name: { type: String, default: '', trim: true },
  logo_url: { type: String, default: '' },
  description: { type: String, default: '' },
  tournament_type: { 
    type: String, 
    enum: ['LEAGUE', 'KNOCKOUT', 'LEAGUE_KNOCKOUT'], 
    default: 'LEAGUE' 
  },
  category: { type: String, default: 'Senior District Trophy' },
  gender: { type: String, default: 'Men' },
  ball_type: { type: String, default: 'Red Leather' },
  match_format: { 
    type: String, 
    enum: ['T10', 'T20', 'ODI', 'CUSTOM'], 
    default: 'T20' 
  },
  format: { type: String, default: 'T20' },
  overs_per_match: { type: Number, default: 20 },
  season: { type: String, default: '2026' },
  team_a_name: { type: String, default: '' },
  team_b_name: { type: String, default: '' },
  venue: { type: String, default: 'Kamarajar District Stadium' },
  venue_maps_url: { type: String, default: '' },
  start_date: { type: String },
  end_date: { type: String },
  registration_start_date: { type: String, default: null },
  registration_end_date: { type: String, default: null },
  max_teams: { type: Number, default: 16 },
  min_teams: { type: Number, default: 2 },
  points_win: { type: Number, default: 2 },
  points_tie: { type: Number, default: 1 },
  points_no_result: { type: Number, default: 1 },
  playing_xi_size: { type: Number, default: 11 },
  substitute_count: { type: Number, default: 4 },
  allow_super_over: { type: Boolean, default: true },
  allow_dls: { type: Boolean, default: false },
  rules: { type: String, default: 'Standard ICC / TNCA Playing Conditions' },
  format_config: {
    round_robin_type: { type: String, enum: ['SINGLE', 'DOUBLE'], default: 'SINGLE' },
    knockout_stages: [{ type: String }],
    qualifying_teams_count: { type: Number, default: 4 },
    qualification_rules: { type: String, default: 'Top qualifying teams advance to knockout stage' }
  },
  teams: [{ type: String, ref: 'Team' }],
  status: { 
    type: String, 
    enum: ['UPCOMING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ACTIVE', 'INACTIVE'], 
    default: 'UPCOMING',
    index: true 
  },
  created_by: { type: String, default: 'admin@cfvd.org' }
}, { timestamps: true });

const TournamentRegistrationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tournament_id: { type: String, required: true, index: true },
  tournament_name: { type: String, required: true },
  team_id: { type: String, required: true, index: true },
  team_name: { type: String, required: true },
  coach_name: { type: String, required: true },
  coach_email: { type: String, required: true, lowercase: true, trim: true, index: true },
  coach_phone: { type: String, default: null },
  coach_aadhaar: { type: String, default: null },
  team_city: { type: String, default: 'Virudhunagar' },
  team_taluk: { type: String, default: 'Virudhunagar' },
  captain: { type: String, default: '' },
  squad_count: { type: Number, default: 15 },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED'], 
    default: 'PENDING',
    index: true 
  },
  registration_date: { type: Date, default: Date.now },
  approved_by: { type: String, default: null },
  approved_at: { type: Date, default: null },
  rejected_by: { type: String, default: null },
  rejected_at: { type: Date, default: null },
  rejection_reason: { type: String, default: null },
  notes: { type: String, default: '' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

TournamentRegistrationSchema.index({ tournament_id: 1, team_id: 1 });

const TournamentCalculationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tournament_id: { type: String, required: true, unique: true },
  tournament_name: { type: String, default: '' },
  calculation_method: {
    type: String,
    enum: ['DLS', 'VJD'],
    default: 'DLS',
    required: true
  },
  updated_by: { type: String, default: 'admin@cfvd.org' },
  updated_by_name: { type: String, default: 'Administrator' },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', TournamentSchema);
const TournamentRegistration = mongoose.models.TournamentRegistration || mongoose.model('TournamentRegistration', TournamentRegistrationSchema);
const TournamentCalculation = mongoose.models.TournamentCalculation || mongoose.model('TournamentCalculation', TournamentCalculationSchema);

module.exports = {
  Tournament,
  TournamentSchema,
  TournamentRegistration,
  TournamentRegistrationSchema,
  TournamentCalculation,
  TournamentCalculationSchema
};

