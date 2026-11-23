/**
 * backend/models/MasterSetting.js
 * MasterSetting Mongoose Model
 */

const mongoose = require('mongoose');

const MasterSettingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  category: { 
    type: String, 
    required: true, 
    index: true,
    enum: [
      'taluk_jurisdiction',
      'playing_role',
      'batting_style',
      'age_category',
      'certification_level',
      'umpire_certification',
      'state'
    ]
  },
  name: { type: String, required: true, trim: true },
  code: { type: String, default: null, trim: true },
  description: { type: String, default: '' },
  is_active: { type: Boolean, default: true },
  sort_order: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const MasterSetting = mongoose.models.MasterSetting || mongoose.model('MasterSetting', MasterSettingSchema);

module.exports = { MasterSetting, MasterSettingSchema };
