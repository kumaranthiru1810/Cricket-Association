/**
 * backend/models/Innings.js
 * Innings, InningsBatter, InningsBowler & Delivery Mongoose Models
 */

const mongoose = require('mongoose');

const InningsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
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
  version: { type: Number, default: 0 },
  is_super_over: { type: Boolean, default: false },
  is_declared: { type: Boolean, default: false },
  status: { type: String, default: 'LIVE' },
  is_completed: { type: Boolean, default: false },
  is_over_complete: { type: Boolean, default: false },
  current_striker_id: { type: String, default: null },
  current_non_striker_id: { type: String, default: null },
  current_bowler_id: { type: String, default: null },
  previous_bowler_id: { type: String, default: null },
  suspended_bowler_ids: [{ type: String }],
  bowler_substitutions: [{ type: mongoose.Schema.Types.Mixed }],
  is_free_hit: { type: Boolean, default: false },
  penalty_runs: { type: Number, default: 0 },
  short_runs: { type: Number, default: 0 },
  bowler_no_balls: { type: mongoose.Schema.Types.Mixed, default: {} },
  last_wide_over: { type: Number, default: -1 },
  over_wide_count: { type: Number, default: 0 },
  prev_ball_was_wide: { type: Boolean, default: false },
  extras: {
    wides: { type: Number, default: 0 },
    no_balls: { type: Number, default: 0 },
    byes: { type: Number, default: 0 },
    leg_byes: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  }
}, { timestamps: true });

InningsSchema.index({ match_id: 1, innings_number: 1 });

const InningsBatterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
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
  id: { type: String, required: true, unique: true },
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

const DeliverySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
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
  is_free_hit: { type: Boolean, default: false },
  shot_type: { type: String, default: null },
  fielding_position: { type: String, default: null },
  shot_angle: { type: Number, default: null },
  shot_distance: { type: Number, default: null },
  shot_zone: { type: String, default: null },
  shot_x: { type: Number, default: null },
  shot_y: { type: Number, default: null },
  fielder_id: { type: String, default: null },
  fielder_name: { type: String, default: null },
  fielding_action: { type: String, default: null },
  reason: { type: String, default: null },
  replacement_batter_id: { type: String, default: null },
  client_delivery_id: { type: String, default: null },
  commentary: { type: String, default: '' },
  created_by: { type: String, default: 'SCR-101' },
  timestamp: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
}, { timestamps: true, strict: false });

InningsBatterSchema.index({ innings_id: 1, player_id: 1 });
InningsBowlerSchema.index({ innings_id: 1, player_id: 1 });
DeliverySchema.index({ match_id: 1, innings_id: 1, over_number: 1, ball_number: 1 });
DeliverySchema.index({ innings_id: 1, over_number: 1, ball_number: 1 });
DeliverySchema.index({ match_id: 1, innings_number: 1 });
DeliverySchema.index({ match_id: 1, client_delivery_id: 1 }, { sparse: true });

const Innings = mongoose.models.Innings || mongoose.model('Innings', InningsSchema);
const InningsBatter = mongoose.models.InningsBatter || mongoose.model('InningsBatter', InningsBatterSchema);
const InningsBowler = mongoose.models.InningsBowler || mongoose.model('InningsBowler', InningsBowlerSchema);
const Delivery = mongoose.models.Delivery || mongoose.model('Delivery', DeliverySchema);

module.exports = {
  Innings,
  InningsSchema,
  InningsBatter,
  InningsBatterSchema,
  InningsBowler,
  InningsBowlerSchema,
  Delivery,
  DeliverySchema
};

