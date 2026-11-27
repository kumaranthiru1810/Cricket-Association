/**
 * backend/models/SuperAdminNotification.js
 * Stores database-persisted notifications for Super Admin whenever an Admin
 * performs any create, edit/update, delete, approval, or status change.
 */

const mongoose = require('mongoose');

const SuperAdminNotificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    action: { type: String, required: true }, // CREATE, UPDATE, DELETE, APPROVE, REJECT, STATUS_CHANGE
    method: { type: String, default: 'POST' },
    resource: { type: String, default: 'System' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    endpoint: { type: String, default: '' },
    admin_id: { type: String, default: null, index: true },
    admin_name: { type: String, default: 'Admin' },
    admin_email: { type: String, default: '' },
    admin_phone: { type: String, default: '' },
    target_id: { type: String, default: null },
    target_name: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['UNREAD', 'READ'], default: 'UNREAD', index: true },
    read_at: { type: Date, default: null },
    created_at: { type: Date, default: Date.now, index: true }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

SuperAdminNotificationSchema.index({ status: 1, created_at: -1 });
SuperAdminNotificationSchema.index({ created_at: -1 });

const SuperAdminNotification =
  mongoose.models.SuperAdminNotification ||
  mongoose.model('SuperAdminNotification', SuperAdminNotificationSchema);

module.exports = { SuperAdminNotification, SuperAdminNotificationSchema };
