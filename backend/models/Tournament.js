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
    enum: [
      'SINGLE_ROUND_ROBIN',
      'DOUBLE_ROUND_ROBIN',
      'SINGLE_ELIMINATION',
      'DOUBLE_ELIMINATION',
      'GROUP_KNOCKOUT',
      'LEAGUE_PLAYOFFS',
      'LEAGUE',
      'KNOCKOUT',
      'LEAGUE_KNOCKOUT',
      'GROUP_SUPER_LEAGUE',
      'CUSTOM'
    ],
    default: 'SINGLE_ROUND_ROBIN'
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
  points_win: { type: Number, default: 4 },
  points_loss: { type: Number, default: 0 },
  points_tie: { type: Number, default: 2 },
  points_no_result: { type: Number, default: 2 },
  points_bonus_win: { type: Number, default: 1 },
  points_bonus_loss: { type: Number, default: -1 },
  points_walkover_win: { type: Number, default: 4 },
  points_walkover_loss: { type: Number, default: -1 },
  playing_xi_size: { type: Number, default: 11 },
  substitute_count: { type: Number, default: 4 },
  allow_super_over: { type: Boolean, default: true },
  allow_dls: { type: Boolean, default: false },
  rules: { type: String, default: 'Standard ICC / TNCA Playing Conditions' },
  playing_rules: {
    powerplay_overs: { type: Number, default: 5 },
    max_outside_powerplay: { type: Number, default: 2 },
    max_outside_post_powerplay: { type: Number, default: 5 },
    max_on_side_fielders: { type: Number, default: 5 },
    max_on_side_behind_crease: { type: Number, default: 2 },
    free_hit_on_all_noballs: { type: Boolean, default: true },
    allow_chain_over: { type: Boolean, default: false },
    max_overs_per_bowler: { type: Number, default: 4 },
    delay_penalty_enabled: { type: Boolean, default: true },
    delay_interval_value: { type: Number, default: 4 },
    delay_interval_unit: { type: String, enum: ['HOURS', 'MINUTES', 'SECONDS'], default: 'MINUTES' },
    delay_reduce_unit: { type: String, enum: ['OVERS', 'BALLS'], default: 'OVERS' },
    delay_overs_reduced_per_interval: { type: Number, default: 1 },
    tie_handling: { type: String, enum: ['SHARE_POINTS', 'SUPER_OVER'], default: 'SHARE_POINTS' }
  },
  format_config: {
    round_robin_type: { type: String, enum: ['SINGLE', 'DOUBLE'], default: 'SINGLE' },
    knockout_stages: [{ type: String }],
    qualifying_teams_count: { type: Number, default: 4 },
    qualification_rules: { type: String, default: 'Top qualifying teams advance to knockout stage' },
    group_count: { type: Number, default: 5 },
    allow_extra_group: { type: Boolean, default: true },
    teams_per_group: { type: Number, default: 8 },
    qualifiers_per_group: { type: Number, default: 2 },
    super_league_enabled: { type: Boolean, default: true },
    super_league_groups: { type: Number, default: 4 },
    super_league_qualifiers_per_group: { type: Number, default: 1 },
    include_semifinals: { type: Boolean, default: true },
    include_final: { type: Boolean, default: true },
    group_distribution: { type: String, enum: ['BALANCED', 'RANDOM', 'SEEDED', 'MANUAL'], default: 'BALANCED' },
    best_runners_up_count: { type: Number, default: 0 },
    best_third_place_count: { type: Number, default: 0 },
    group_names: [{ type: String }],
    manual_groups: { type: mongoose.Schema.Types.Mixed, default: null },
    tie_breaker_order: { type: [String], default: ['POINTS', 'WINS', 'NRR', 'HEAD_TO_HEAD'] },
    groups_snapshot: [{ type: mongoose.Schema.Types.Mixed }],
    byes: [{ type: mongoose.Schema.Types.Mixed }],
    unresolved_ties: [{ type: mongoose.Schema.Types.Mixed }],
    manual_groups_tie_resolution: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  progression_lock_until: { type: Date, default: null },
  teams: [{ type: String, ref: 'Team' }],
  winner_team_id: { type: String, default: null },
  winner_team_name: { type: String, default: '' },
  runner_up_team_id: { type: String, default: null },
  runner_up_team_name: { type: String, default: '' },
  awards_config: {
    winner_trophy_title: { type: String, default: 'Championship Winner Trophy' },
    runner_up_trophy_title: { type: String, default: 'Runner-Up Trophy' },
    potm_every_match: { type: Boolean, default: true }
  },
  status: { 
    type: String, 
    enum: ['UPCOMING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ACTIVE', 'INACTIVE'], 
    default: 'UPCOMING',
    index: true 
  },
  created_by: { type: String, default: 'system-admin' }
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
  updated_by: { type: String, default: 'system-admin' },
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

