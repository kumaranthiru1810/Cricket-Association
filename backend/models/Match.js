/**
 * backend/models/Match.js
 * Match & UmpireDecision Mongoose Models
 */

const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tournament_id: { type: String, default: 'T-2026-VPL' },
  tournament_name: { type: String, default: 'Virudhunagar Premier League 2026' },
  team_a_id: { type: String, required: true },
  team_b_id: { type: String, required: true },
  team_a_name: { type: String, default: '' },
  team_b_name: { type: String, default: '' },
  venue: { type: String, default: 'Kamarajar District Stadium' },
  venue_maps_url: { type: String, default: '' },
  match_date: { type: String, default: '2026-10-06' },
  match_time: { type: String, default: '09:30 AM' },
  match_type: { type: String, default: 'T20' },
  overs_per_side: { type: Number, default: 20 },
  stage: { type: String, default: 'LEAGUE' },
  status: { type: String, enum: ['SCHEDULED', 'TOSS', 'LIVE', 'INNINGS_BREAK', 'PAUSED', 'COMPLETED', 'ABANDONED', 'CANCELLED', 'POSTPONED'], default: 'SCHEDULED', index: true },
  postponement: {
    is_postponed: { type: Boolean, default: false },
    reason: { type: String, default: null },
    postponed_at: { type: Date, default: null },
    postponed_by: {
      user_id: { type: String, default: null },
      role: { type: String, default: 'ADMIN' },
      name: { type: String, default: '' }
    },
    original_date: { type: String, default: null },
    original_time: { type: String, default: null },
    rescheduled_date: { type: String, default: null },
    rescheduled_time: { type: String, default: null },
    rescheduled_at: { type: Date, default: null },
    rescheduled_by: {
      user_id: { type: String, default: null },
      role: { type: String, default: null },
      name: { type: String, default: '' }
    }
  },
  umpire_postponement_request: {
    requested: { type: Boolean, default: false },
    umpire_id: { type: String, default: null },
    umpire_name: { type: String, default: '' },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'], default: 'NONE' },
    requested_at: { type: Date, default: null },
    reviewed_by: { type: String, default: null },
    reviewed_at: { type: Date, default: null },
    review_notes: { type: String, default: '' }
  },
  postponement_history: [{
    action: { type: String, required: true },
    reason: { type: String, default: '' },
    from_date: { type: String, default: '' },
    from_time: { type: String, default: '' },
    to_date: { type: String, default: '' },
    to_time: { type: String, default: '' },
    actor_id: { type: String, default: '' },
    actor_name: { type: String, default: '' },
    actor_role: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, default: '' }
  }],
  toss_winner_id: { type: String, default: null },
  toss_decision: { type: String, default: null },
  winner_id: { type: String, default: null, index: true },
  scoring_lock: {
    locked_at: { type: Date, default: null },
    lock_id: { type: String, default: null }
  },
  current_innings_number: { type: Number, default: 1 },
  result_summary: { type: String, default: null },
  player_of_match: { type: String, default: null },
  assigned_scorer_id: { type: String, default: 'SCR-101' },
  scorer_name: { type: String, default: 'Official Scorer' },
  assigned_scorer_name: { type: String, default: '' },
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
  team_a_substitutes: [{ type: String }],
  team_b_substitutes: [{ type: String }],
  team_a_lineup: [mongoose.Schema.Types.Mixed],
  team_b_lineup: [mongoose.Schema.Types.Mixed],
  team_a_allocation_status: { type: String, enum: ['PENDING', 'SUBMITTED'], default: 'PENDING' },
  team_b_allocation_status: { type: String, enum: ['PENDING', 'SUBMITTED'], default: 'PENDING' },
  team_a_allocation_submitted_at: { type: Date, default: null },
  team_b_allocation_submitted_at: { type: Date, default: null },
  schedule_confirmation_status: { type: String, enum: ['PENDING', 'CONFIRMED'], default: 'PENDING' },
  schedule_confirmed_at: { type: Date, default: null },
  schedule_confirmed_by: { type: String, default: null },
  revised_overs: { type: Number, default: null },
  revised_target: { type: Number, default: null },
  revised_comments: { type: String, default: '' },
  is_super_over: { type: Boolean, default: false },
  match_start_time: { type: String, default: null },
  match_end_time: { type: String, default: null },
  status_comment: { type: String, default: '' },
  current_break: { type: mongoose.Schema.Types.Mixed, default: null },
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

MatchSchema.index({ tournament_id: 1, status: 1 });
MatchSchema.index({ team_a_id: 1, team_b_id: 1 });
MatchSchema.index({ match_date: 1, match_time: 1 });

const UmpireDecisionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
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

const Match = mongoose.models.Match || mongoose.model('Match', MatchSchema);
const UmpireDecision = mongoose.models.UmpireDecision || mongoose.model('UmpireDecision', UmpireDecisionSchema);

module.exports = {
  Match,
  MatchSchema,
  UmpireDecision,
  UmpireDecisionSchema
};
