/**
 * backend/models/Notification.js
 * Notification Mongoose Model
 */

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, default: 'MATCH_SCHEDULED' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  reference_id: { type: String, default: null },
  recipient_role: { type: String, enum: ['TEAM', 'PLAYER', 'ADMIN'], default: 'TEAM' },
  recipient_id: { type: String, default: null, index: true },
  recipient_email: { type: String, default: null, index: true },
  team_id: { type: String, default: null, index: true },
  team_name: { type: String, default: null },
  link: { type: String, default: '' },
  status: { type: String, enum: ['UNREAD', 'READ'], default: 'UNREAD' },
  created_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at' } });

NotificationSchema.index({ recipient_id: 1, status: 1 });
NotificationSchema.index({ status: 1, created_at: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

module.exports = { Notification, NotificationSchema };
