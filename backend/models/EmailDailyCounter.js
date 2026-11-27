/**
 * backend/models/EmailDailyCounter.js
 * Tracks daily email volume, failures, and 250-threshold admin alert state.
 */

const mongoose = require('mongoose');

const EmailDailyCounterSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD (UTC or IST)
  count: { type: Number, default: 0 },
  failures: { type: Number, default: 0 },
  alert_sent_at: { type: Date, default: null },
  last_provider: { type: String, default: null },
  last_error: { type: String, default: null },
  updated_at: { type: Date, default: Date.now }
});

const EmailDailyCounter =
  mongoose.models.EmailDailyCounter ||
  mongoose.model('EmailDailyCounter', EmailDailyCounterSchema);

module.exports = { EmailDailyCounter, EmailDailyCounterSchema };

