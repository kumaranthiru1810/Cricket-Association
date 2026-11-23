/**
 * backend/models/Scorer.js
 * Scorer Mongoose Model
 */

const mongoose = require('mongoose');

const ScorerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: { type: String, default: '' },
  aadhaar: { type: String, default: '' },
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

const Scorer = mongoose.models.Scorer || mongoose.model('Scorer', ScorerSchema);

module.exports = { Scorer, ScorerSchema };
