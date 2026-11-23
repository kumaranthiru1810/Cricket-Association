/**
 * backend/models/Team.js
 * Team, TeamRegistration & TeamPlayer Mongoose Models
 */

const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  team_id: { type: String, default: null, index: true },
  name: { type: String, required: true },
  team_name: { type: String, default: '' },
  short_name: { type: String, default: 'VND' },
  city: { type: String, default: 'Virudhunagar' },
  taluk: { type: String, default: 'Virudhunagar' },
  phone: { type: String, default: '' },
  home_ground: { type: String, default: '' },
  certification: { type: String, default: '' },
  coach_name: { type: String, default: '' },
  coach_email: { type: String, default: '' },
  captain: { type: String, default: '' },
  vice_captain: { type: String, default: '' },
  photo: { type: String, default: null },
  image_path: { type: String, default: null },
  logo: { type: String, default: null },
  team_passkey_hash: { type: String, default: null },
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

const TeamRegistrationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  team_name: { type: String, required: true },
  coach_name: { type: String, required: true },
  coach_email: { type: String, required: true, lowercase: true, trim: true, index: true },
  coach_phone: { type: String, default: null },
  coach_aadhaar: { type: String, default: null },
  password_hash: { type: String, default: null },
  current_password: { type: String, default: null },
  passkey: { type: String, default: '' },
  city: { type: String, default: 'Virudhunagar' },
  taluk: { type: String, default: 'Virudhunagar' },
  phone: { type: String, default: '' },
  photo: { type: String, default: null },
  image_path: { type: String, default: null },
  logo: { type: String, default: null },
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
    phone: { type: String, default: null },
    mobile: { type: String, default: null },
    aadhaar: { type: String, default: null },
    role: { type: String, default: 'BATTER' },
    photo: { type: String, default: null },
    image_path: { type: String, default: null },
    status: { type: String, default: 'PENDING' }
  }]
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const TeamPlayerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  team_id: { type: String, required: true, index: true },
  player_name: { type: String, required: true },
  player_email: { type: String, required: true, lowercase: true, trim: true },
  player_role: { type: String, default: 'BATTER' },
  photo: { type: String, default: null },
  image_path: { type: String, default: null },
  created_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at' } });

const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);
const TeamRegistration = mongoose.models.TeamRegistration || mongoose.model('TeamRegistration', TeamRegistrationSchema);
const TeamPlayer = mongoose.models.TeamPlayer || mongoose.model('TeamPlayer', TeamPlayerSchema);

module.exports = {
  Team,
  TeamSchema,
  TeamRegistration,
  TeamRegistrationSchema,
  TeamPlayer,
  TeamPlayerSchema
};

