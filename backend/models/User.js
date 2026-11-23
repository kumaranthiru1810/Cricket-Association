/**
 * backend/models/User.js
 * User Mongoose Model (Multi-Role: Player, Coach, Scorer, Admin, Umpire, Content, User)
 */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: { type: String, default: null },
  aadhaar: { type: String, default: null },
  password_hash: { type: String, default: null },
  current_password: { type: String, default: null },
  role: { 
    type: String, 
    enum: ['SUPER_ADMIN', 'ADMIN', 'COACH', 'TEAM', 'PLAYER', 'SCORER', 'UMPIRE', 'CONTENT', 'USER'], 
    default: 'USER',
    index: true 
  },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED', 'APPROVED'], 
    default: 'ACTIVE',
    index: true 
  },
  token_version: { type: Number, default: 0 },
  role_changed_at: { type: Date, default: null },
  role_changed_by: { type: String, default: null },
  is_super_admin: { type: Boolean, default: false },
  admin_level: { type: String, default: 'Standard Administrator' },
  admin_permissions: { type: [String], default: ['MATCH_MANAGE', 'SCORER_ASSIGN', 'VIEW_REPORTS'] },
  approval_status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
  activation_token: { type: String, default: null },
  activation_token_expires_at: { type: Date, default: null },
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
    team_name: { type: String, default: null },
    photo: { type: String, default: null },
    image_path: { type: String, default: null }
  },
  photo: { type: String, default: null },
  image_path: { type: String, default: null },
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

UserSchema.index({ role: 1, status: 1 });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = { User, UserSchema };
