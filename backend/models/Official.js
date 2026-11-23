/**
 * backend/models/Official.js
 * Official & Venue Mongoose Models
 */

const mongoose = require('mongoose');

const OfficialSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, default: 'SCORER' },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  status: { type: String, default: 'ACTIVE' }
}, { timestamps: true });

const VenueSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, default: 'Virudhunagar' },
  capacity: { type: Number, default: 5000 },
  floodlights: { type: Boolean, default: true },
  description: { type: String, default: '' }
}, { timestamps: true });

const Official = mongoose.models.Official || mongoose.model('Official', OfficialSchema);
const Venue = mongoose.models.Venue || mongoose.model('Venue', VenueSchema);

module.exports = { Official, OfficialSchema, Venue, VenueSchema };
