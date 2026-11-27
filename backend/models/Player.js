/**
 * backend/models/Player.js
 * Player & PlayerMatchRating Mongoose Models
 */

const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  team_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, default: null, lowercase: true, trim: true, index: true },
  phone: { type: String, default: null },
  mobile: { type: String, default: null },
  aadhaar: { type: String, default: null },
  age: { type: Number, default: null },
  date_of_birth: { type: String, default: '' },
  password_hash: { type: String, default: null },
  role: { type: String, enum: ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'], default: 'BATTER' },
  jersey_number: { type: Number, default: 0 },
  batting_style: { type: String, default: 'Right Hand Bat' },
  bowling_style: { type: String, default: 'Right Arm Medium' },
  photo: { type: String, default: null },
  image_path: { type: String, default: null },
  status: { type: String, default: 'ACTIVE' },
  stats: {
    matches: { type: Number, default: 0 },
    innings: { type: Number, default: 0 },
    not_outs: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    fifties: { type: Number, default: 0 },
    hundreds: { type: Number, default: 0 },
    highest_score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    runs_conceded: { type: Number, default: 0 },
    catches: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
    run_outs: { type: Number, default: 0 },
    potm_awards: { type: Number, default: 0 }
  },
  team_membership_history: [{
    team_id: { type: String, required: true },
    team_name: { type: String, default: '' },
    season: { type: String, default: '' },
    role: { type: String, default: 'BATTER' },
    joined_at: { type: Date, default: Date.now },
    left_at: { type: Date, default: null },
    is_current: { type: Boolean, default: true }
  }],
  tournament_history: [{
    tournament_id: { type: String, required: true },
    tournament_name: { type: String, default: '' },
    season: { type: String, default: '' },
    team_id: { type: String, default: '' },
    team_name: { type: String, default: '' },
    matches: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    potm_count: { type: Number, default: 0 }
  }]
}, { timestamps: true });

const PlayerMatchRatingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  player_id: { type: String, required: true, index: true },
  player_name: { type: String, default: '' },
  match_id: { type: String, required: true, index: true },
  tournament_id: { type: String, default: null },
  tournament_name: { type: String, default: '' },
  match_date: { type: Date, default: Date.now },
  format: { type: String, enum: ['T20', 'ONE_DAY', 'MULTI_DAY', 'T10', 'CUSTOM'], default: 'T20' },
  role: { type: String, enum: ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKETKEEPER'], default: 'BATSMAN' },
  batting_rating: { type: Number, default: null },
  bowling_rating: { type: Number, default: null },
  fielding_rating: { type: Number, default: null },
  impact_rating: { type: Number, default: null },
  overall_rating: { type: Number, default: null },
  component_availability: {
    batting: { type: Boolean, default: false },
    bowling: { type: Boolean, default: false },
    fielding: { type: Boolean, default: false },
    impact: { type: Boolean, default: false }
  },
  match_stats: {
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    strike_rate: { type: Number, default: 0 },
    is_out: { type: Boolean, default: false },
    dismissal_text: { type: String, default: '' },
    overs: { type: Number, default: 0 },
    balls_bowled: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    runs_conceded: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    economy: { type: Number, default: 0 },
    catches: { type: Number, default: 0 },
    run_outs: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 }
  },
  calculation_version: { type: String, default: 'v2.0' },
  verification_status: { type: String, enum: ['VERIFIED', 'PROVISIONAL', 'INVALIDATED'], default: 'VERIFIED' },
  calculated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

PlayerMatchRatingSchema.index({ player_id: 1, match_id: 1 }, { unique: true });
PlayerMatchRatingSchema.index({ player_id: 1, match_date: -1 });
PlayerMatchRatingSchema.index({ format: 1, overall_rating: -1 });

const Player = mongoose.models.Player || mongoose.model('Player', PlayerSchema);
const PlayerMatchRating = mongoose.models.PlayerMatchRating || mongoose.model('PlayerMatchRating', PlayerMatchRatingSchema);

module.exports = {
  Player,
  PlayerSchema,
  PlayerMatchRating,
  PlayerMatchRatingSchema
};

