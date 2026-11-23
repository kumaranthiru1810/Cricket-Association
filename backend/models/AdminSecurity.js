/**
 * backend/models/AdminSecurity.js
 * AdminActionOtp & AdminRequest Mongoose Models
 */

const mongoose = require('mongoose');

const AdminActionOtpSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true },
  action: { 
    type: String, 
    required: true,
    enum: [
      'APPROVE_ADMIN',
      'REJECT_ADMIN',
      'CREATE_ADMIN',
      'CHANGE_PERMISSIONS',
      'CHANGE_ROLE',
      'ACTIVATE_ADMIN',
      'SUSPEND_ADMIN',
      'REMOVE_ADMIN'
    ]
  },
  super_admin_email: { type: String, required: true, default: 'admin@cfvd.org' },
  target_id: { type: String, default: null },
  target_email: { type: String, default: null },
  target_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  otp_hash: { type: String, required: true },
  salt: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  max_attempts: { type: Number, default: 5 },
  expires_at: { type: Date, required: true, index: { expires: '1h' } },
  last_sent_at: { type: Date, default: Date.now },
  status: { type: String, enum: ['PENDING', 'VERIFIED', 'EXPIRED', 'MAX_ATTEMPTS_EXCEEDED'], default: 'PENDING' },
  created_at: { type: Date, default: Date.now }
});

const AdminRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: ['PROMOTE', 'REMOVE'], required: true, index: true },
  target_user_id: { type: String, required: true },
  target_email: { type: String, required: true, lowercase: true, trim: true },
  target_name: { type: String, default: '' },
  requested_by_id: { type: String, required: true },
  approver1_id: { type: String, required: true },
  approver2_id: { type: String, required: true },
  approver1_otp_hash: { type: String, required: true },
  approver2_otp_hash: { type: String, required: true },
  approver1_verified: { type: Boolean, default: false },
  approver2_verified: { type: Boolean, default: false },
  candidate_otp_hash: { type: String, default: null },
  candidate_verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'EXECUTING', 'COMPLETED', 'REJECTED', 'EXPIRED', 'LOCKED'],
    default: 'PENDING',
    index: true
  },
  expires_at: { type: Date, required: true, index: { expires: 0 } },
  created_at: { type: Date, default: Date.now },
  ip_address: { type: String, default: '' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

AdminRequestSchema.index(
  { target_user_id: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'APPROVED', 'EXECUTING'] } } }
);

const AdminActionOtp = mongoose.models.AdminActionOtp || mongoose.model('AdminActionOtp', AdminActionOtpSchema);
const AdminRequest = mongoose.models.AdminRequest || mongoose.model('AdminRequest', AdminRequestSchema);

module.exports = {
  AdminActionOtp,
  AdminActionOtpSchema,
  AdminRequest,
  AdminRequestSchema
};
