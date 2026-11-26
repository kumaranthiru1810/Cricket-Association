/**
 * backend/models/AuditLog.js
 * AuditLog Mongoose Model
 */

const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  action: { type: String, required: true },
  initiated_by: { type: String, default: 'SYSTEM' },
  admin_email: { type: String, default: '' },
  target_user: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  ip_address: { type: String, default: '127.0.0.1' },
  result: { type: String, default: 'SUCCESS' },
  details: { type: String, default: '' }
}, { timestamps: { createdAt: 'timestamp' } });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

module.exports = { AuditLog, AuditLogSchema };

