/**
 * backend/models/CricketLaw.js
 * CricketLaw, CricketLawSection, CricketLawVersion & CricketLawAuditLog Mongoose Models
 */

const mongoose = require('mongoose');

const CricketLawSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  law_number: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  short_description: { type: String, default: '' },
  category: {
    type: String,
    enum: ['Batters', 'Bowlers', 'Fielders', 'Umpires', 'Scorers', 'Match Officials', 'Dismissals', 'Equipment', 'Match Situations', 'General'],
    default: 'General',
    index: true
  },
  edition: { type: String, default: '2017 Code – Fourth Edition 2026' },
  effective_date: { type: String, default: '1 October 2026' },
  source_url: { type: String, default: 'https://lawsofcricket.lords.org/' },
  is_amended_2026: { type: Boolean, default: false },
  amendment_notes: { type: String, default: '' },
  subsection_count: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true, index: true },
  last_verified_at: { type: Date, default: Date.now },
  display_order: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const CricketLawSectionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  law_id: { type: String, required: true, index: true },
  law_number: { type: Number, required: true, index: true },
  section_number: { type: String, required: true },
  section_title: { type: String, required: true },
  explanation: { type: String, default: '' },
  detailed_explanation: { type: String, default: '' },
  practical_example: { type: String, default: '' },
  parent_section_id: { type: String, default: null, index: true },
  depth: { type: Number, default: 1 },
  display_order: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

CricketLawSectionSchema.index({ law_id: 1, section_number: 1 });
CricketLawSectionSchema.index({ law_number: 1, section_number: 1 });

const CricketLawVersionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  law_id: { type: String, required: true, index: true },
  law_number: { type: Number, required: true },
  edition: { type: String, required: true },
  amendment_notes: { type: String, default: '' },
  effective_date: { type: String, default: '' },
  is_current: { type: Boolean, default: false, index: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const CricketLawAuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  law_id: { type: String, required: true, index: true },
  law_number: { type: Number, required: true },
  action: { type: String, required: true, enum: ['CREATE', 'UPDATE', 'PUBLISH', 'RESTORE', 'SECTION_ADD', 'SECTION_UPDATE'] },
  updated_by: { type: String, required: true },
  updated_by_email: { type: String, default: '' },
  previous_version: { type: mongoose.Schema.Types.Mixed, default: null },
  new_version: { type: mongoose.Schema.Types.Mixed, default: null },
  notes: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: { createdAt: 'timestamp' } });

const CricketLaw = mongoose.models.CricketLaw || mongoose.model('CricketLaw', CricketLawSchema);
const CricketLawSection = mongoose.models.CricketLawSection || mongoose.model('CricketLawSection', CricketLawSectionSchema);
const CricketLawVersion = mongoose.models.CricketLawVersion || mongoose.model('CricketLawVersion', CricketLawVersionSchema);
const CricketLawAuditLog = mongoose.models.CricketLawAuditLog || mongoose.model('CricketLawAuditLog', CricketLawAuditLogSchema);

module.exports = {
  CricketLaw,
  CricketLawSchema,
  CricketLawSection,
  CricketLawSectionSchema,
  CricketLawVersion,
  CricketLawVersionSchema,
  CricketLawAuditLog,
  CricketLawAuditLogSchema
};
