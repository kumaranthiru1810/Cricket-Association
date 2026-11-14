/**
 * models/notificationModel.js
 * Pure MongoDB Notification Model for Administrative & User Alerts
 */

const db = require('../config/db');

class NotificationModel {
  get Model() {
    return db.models.Notification;
  }

  async create({ type = 'MATCH_SCHEDULED', title, message, reference_id = null, status = 'UNREAD', recipient_role = 'TEAM', recipient_id = null, recipient_email = null, team_id = null, team_name = null, link = '' }) {
    // ONLY match schedule notifications are allowed to be created and stored in the database
    if (type !== 'MATCH_SCHEDULED' && type !== 'MATCH_RESCHEDULED') {
      return null;
    }
    await db.initDb();
    const id = `NOTIF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const notif = await this.Model.create({
      id,
      type,
      title,
      message,
      reference_id,
      recipient_role,
      recipient_id,
      recipient_email,
      team_id,
      team_name,
      link,
      status,
      created_at: new Date()
    });
    return notif.toObject();
  }

  async getAll({ status = null, limit = 50 } = {}) {
    await db.initDb();
    const query = {};
    if (status) query.status = status;
    return this.Model.find(query).sort({ created_at: -1 }).limit(limit).lean();
  }

  async markAsRead(id) {
    await db.initDb();
    const mongoose = require('mongoose');
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const query = isMongoId ? { $or: [{ id }, { _id: id }] } : { id };
    return this.Model.findOneAndUpdate(
      query,
      { $set: { status: 'READ' } },
      { returnDocument: 'after' }
    ).lean();
  }
}

module.exports = new NotificationModel();
