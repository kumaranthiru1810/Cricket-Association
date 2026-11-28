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
  role: { 
    type: String, 
    enum: ['SUPER_ADMIN', 'ADMIN', 'COACH', 'TEAM', 'PLAYER', 'SCORER', 'UMPIRE', 'CONTENT', 'USER'], 
    default: 'USER',
    index: true 
  },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED', 'APPROVED', 'DELETED'], 
    default: 'ACTIVE',
    index: true 
  },
  previous_status: { type: String, default: null },
  deleted_at: { type: Date, default: null },
  deleted_by: { type: String, default: null },
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
    image_path: { type: String, default: null },
    phone: { type: String, default: null },
    mobile: { type: String, default: null },
    aadhaar: { type: String, default: null },
    aadhaar_number: { type: String, default: null },
    father_name: { type: String, default: '' },
    date_of_birth: { type: String, default: '' },
    age: { type: String, default: '' },
    place_of_birth: { type: String, default: '' },
    address: { type: String, default: '' },
    occupation_type: { type: String, default: '' },
    working_institution: { type: String, default: '' },
    studying_institution: { type: String, default: '' },
    study_level: { type: String, default: '' },
    branch_year_sec: { type: String, default: '' },
    class_section: { type: String, default: '' },
    batter_hand: { type: String, default: '' },
    batter_position: { type: String, default: '' },
    bowler_hand: { type: String, default: '' },
    bowler_type: { type: String, default: '' },
    is_wicket_keeper: { type: Boolean, default: false },
    declaration_place: { type: String, default: '' },
    declaration_date: { type: String, default: '' },
    declaration_agreed: { type: Boolean, default: false },
    photo_phash: { type: String, default: null },
    photo_verification_status: {
      type: String,
      enum: ['VERIFIED', 'PENDING_REVIEW', 'REJECTED', 'NONE'],
      default: 'NONE'
    },
    photo_verification_reason: { type: String, default: '' },
    photo_verified_by: { type: String, default: null },
    photo_verified_at: { type: Date, default: null },
    photo_metadata: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      format: { type: String, default: null },
      sizeBytes: { type: Number, default: null },
      blurScore: { type: Number, default: null },
      faceCount: { type: Number, default: null },
      engine: { type: String, default: null }
    }
  },
  photo: { type: String, default: null },
  image_path: { type: String, default: null },
  photo_phash: { type: String, default: null, index: true },
  photo_verification_status: {
    type: String,
    enum: ['VERIFIED', 'PENDING_REVIEW', 'REJECTED', 'NONE'],
    default: 'NONE',
    index: true
  },
  photo_verification_reason: { type: String, default: '' },
  photo_verified_by: { type: String, default: null },
  photo_verified_at: { type: Date, default: null },
  photo_verification_history: [{
    status: { type: String, default: 'PENDING_REVIEW' },
    reason: { type: String, default: '' },
    actor: { type: String, default: '' },
    actor_role: { type: String, default: 'SYSTEM' },
    photo: { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
  }],
  photo_status: {
    type: String,
    enum: ['PENDING', 'AUTO_PASS', 'NEEDS_REVIEW', 'REJECTED', 'APPROVED'],
    default: 'PENDING',
    index: true
  },
  photo_checks: {
    type: {
      faceCount: { type: Number, default: null },
      faceScore: { type: Number, default: null },
      faceSizeRatio: { type: Number, default: null },
      yaw: { type: Number, default: null },
      pitch: { type: Number, default: null },
      blurScore: { type: Number, default: null },
      brightness: { type: Number, default: null },
      nsfwScore: { type: Number, default: null },
      antispoofScore: { type: Number, default: null },
      livenessScore: { type: Number, default: null },
      reasons: { type: [String], default: [] }
    },
    select: false,
    default: undefined
  },
  photo_reviewed_by: { type: String, default: null },
  photo_reviewed_at: { type: Date, default: null },
  photo_reject_reason: { type: String, default: '' },
  face_embedding: { type: [Number], select: false, default: undefined },
  photo_reupload_attempts_today: { type: Number, default: 0 },
  photo_reupload_date: { type: String, default: null },
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

