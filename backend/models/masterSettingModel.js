/**
 * models/masterSettingModel.js
 * Pure MongoDB Master Settings & Dynamic Dropdown Category Options Model
 * Manages dynamic subcategories:
 * - Taluk Jurisdiction
 * - Playing Role
 * - Batting Style
 * - Age Category
 * - Certification Level
 * - Umpire Certification / Qualification
 * - State
 */

const db = require('../config/db');

const VALID_CATEGORIES = [
  'taluk_jurisdiction',
  'playing_role',
  'batting_style',
  'age_category',
  'certification_level',
  'umpire_certification',
  'state'
];

const CATEGORY_META = {
  taluk_jurisdiction: {
    label: 'Taluk Jurisdiction',
    description: 'Administrative taluks and regional jurisdictions within the district'
  },
  playing_role: {
    label: 'Playing Role',
    description: 'Player on-field specializations and match roles'
  },
  batting_style: {
    label: 'Batting Style',
    description: 'Recognized batting stances and styles'
  },
  age_category: {
    label: 'Age Category',
    description: 'Official age brackets for tournaments and player registrations'
  },
  certification_level: {
    label: 'Certification Level',
    description: 'Scorer accreditation and federation qualification tiers'
  },
  umpire_certification: {
    label: 'Umpire Certification / Qualification',
    description: 'Official match umpire panel tiers and qualifications'
  },
  state: {
    label: 'State',
    description: 'Federation affiliated states and territories'
  }
};

class MasterSettingModel {
  get Model() {
    return db.models.MasterSetting;
  }

  get validCategories() {
    return VALID_CATEGORIES;
  }

  get categoryMeta() {
    return CATEGORY_META;
  }

  /**
   * Get all active options, optionally filtered by category
   */
  async getAll({ category = null, includeInactive = false } = {}) {
    await db.initDb();
    const query = {};
    if (category) {
      const cleanCat = String(category).trim();
      const hyphenCat = cleanCat.replace(/_/g, '-');
      const underscoreCat = cleanCat.replace(/-/g, '_');
      query.category = {
        $in: [cleanCat, hyphenCat, underscoreCat, new RegExp(`^${cleanCat}$`, 'i')]
      };
    }
    if (!includeInactive) {
      query.is_active = { $ne: false };
    }

    const mongoose = require('mongoose');
    const isMongoReady = Boolean(mongoose.connection && mongoose.connection.readyState === 1);

    let items = [];

    // 1. Primary query on standard Mongoose collection (mastersettings) ONLY if MongoDB is active
    if (isMongoReady && this.Model) {
      try {
        items = await this.Model.find(query).sort({ sort_order: 1, created_at: 1 }).lean();
      } catch (err) {
        console.warn('[MasterSettingModel] Primary find error:', err.message);
      }
    }

    // 2. Fallback: Check alternate collection names if user imported into master_settings / mastersetting
    if ((!items || items.length === 0) && isMongoReady && mongoose.connection?.db) {
      const alternateCols = [
        'master_settings',
        'master_setting',
        'mastersetting',
        'mastersettings',
        'MasterSetting',
        'MasterSettings',
        'settings',
        'Settings'
      ];
      for (const colName of alternateCols) {
        try {
          const col = mongoose.connection.db.collection(colName);
          const count = await col.countDocuments();
          if (count > 0) {
            // 2a. Check if collection documents contain a mastersetting container field
            const containerDoc = await col.findOne({
              $or: [
                { mastersetting: { $exists: true } },
                { masterSetting: { $exists: true } },
                { master_settings: { $exists: true } },
                { masterSettings: { $exists: true } }
              ]
            });
            if (containerDoc) {
              const rawField =
                containerDoc.mastersetting ||
                containerDoc.masterSetting ||
                containerDoc.master_settings ||
                containerDoc.masterSettings;
              let extracted = [];
              if (Array.isArray(rawField)) {
                extracted = rawField;
              } else if (typeof rawField === 'object' && rawField !== null) {
                for (const [k, v] of Object.entries(rawField)) {
                  if (Array.isArray(v)) {
                    extracted.push(
                      ...v.map(item =>
                        typeof item === 'string'
                          ? { category: k, name: item }
                          : { category: k, ...item }
                      )
                    );
                  }
                }
              }
              if (extracted.length > 0) {
                items = extracted.map(d => ({
                  id: d.id || String(d._id || `MSET-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
                  category: (d.category || '').toLowerCase().replace(/[-\s]/g, '_'),
                  name: d.name || String(d),
                  code: d.code || null,
                  description: d.description || null,
                  is_active: d.is_active !== false,
                  sort_order: d.sort_order || 0
                }));
                if (category) {
                  const clean = String(category).toLowerCase().replace(/[-\s]/g, '_');
                  items = items.filter(i => i.category === clean);
                }
                if (!includeInactive) {
                  items = items.filter(i => i.is_active !== false);
                }
                if (items.length > 0) break;
              }
            }

            // 2b. Direct documents in the collection
            const rawDocs = await col.find(query).sort({ sort_order: 1 }).toArray();
            if (rawDocs && rawDocs.length > 0) {
              items = rawDocs.map(d => ({
                id: d.id || String(d._id),
                category: (d.category || '').toLowerCase().replace(/[-\s]/g, '_'),
                name: d.name,
                code: d.code || null,
                description: d.description || null,
                is_active: d.is_active !== false,
                sort_order: d.sort_order || 0
              }));
              // Auto-sync into primary Mongoose collection
              try {
                await this.Model.insertMany(items, { ordered: false });
              } catch (syncErr) {}
              break;
            }
          }
        } catch (altErr) {}
      }
    }

    // 3. Fallback: Read directly from local JSON files (instantaneous, never times out)
    if (!items || items.length === 0) {
      const fs = require('fs');
      const path = require('path');
      const jsonSeedPath = path.join(__dirname, '..', 'data', 'master_settings', 'all_master_settings.json');
      if (fs.existsSync(jsonSeedPath)) {
        try {
          const allSeeds = JSON.parse(fs.readFileSync(jsonSeedPath, 'utf8'));
          let matched = allSeeds;
          if (category) {
            const clean = String(category).toLowerCase().replace(/-/g, '_');
            matched = allSeeds.filter(s => (s.category || '').toLowerCase().replace(/-/g, '_') === clean);
          }
          if (!includeInactive) {
            matched = matched.filter(s => s.is_active !== false);
          }
          items = matched;
        } catch (parseErr) {}
      }
    }

    return items || [];
  }

  /**
   * Get options grouped by category
   */
  async getGrouped({ items = null, includeInactive = false } = {}) {
    const list = items || await this.getAll({ includeInactive });
    
    // Initialize groups for all valid categories
    const grouped = {};
    for (const cat of VALID_CATEGORIES) {
      grouped[cat] = {
        meta: CATEGORY_META[cat],
        items: []
      };
    }

    // Populate items into respective groups
    for (const item of list) {
      const normalizedCat = (item.category || '').toLowerCase().replace(/[-\s]/g, '_');
      if (grouped[normalizedCat]) {
        grouped[normalizedCat].items.push(item);
      }
    }

    return grouped;
  }

  /**
   * Find option by ID or category + name
   */
  async findById(id) {
    await db.initDb();
    const mongoose = require('mongoose');
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const query = isMongoId ? { $or: [{ id }, { _id: id }] } : { id };
    return this.Model.findOne(query).lean();
  }

  /**
   * Create a new category option
   */
  async create({ category, name, code = null, description = '', sort_order = null }) {
    await db.initDb();
    const cleanCategory = String(category || '').trim().toLowerCase().replace(/-/g, '_');
    if (!VALID_CATEGORIES.includes(cleanCategory)) {
      throw new Error(`Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    const cleanName = String(name || '').trim();
    if (!cleanName) {
      throw new Error('Option name is required.');
    }

    const id = `MSET-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const finalCode = code ? String(code).trim().toUpperCase() : cleanName.toUpperCase().replace(/\s+/g, '_').substring(0, 20);
    const finalOrder = (sort_order !== null && sort_order !== undefined) ? Number(sort_order) : Date.now() % 1000;

    const newObj = {
      id,
      category: cleanCategory,
      name: cleanName,
      code: finalCode,
      description: String(description || '').trim(),
      sort_order: finalOrder,
      is_active: true,
      created_at: new Date().toISOString()
    };

    const mongoose = require('mongoose');
    let isMongoReady = Boolean(mongoose.connection && mongoose.connection.readyState === 1);
    if (!isMongoReady) {
      try {
        await db.initDb();
        isMongoReady = Boolean(mongoose.connection && mongoose.connection.readyState === 1);
      } catch (e) {}
    }

    let savedItem = null;

    // 1. Primary insert to standard MongoDB Mongoose collection (mastersettings)
    if (isMongoReady && this.Model) {
      try {
        // Duplicate check
        const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existing = await this.Model.findOne({
          category: cleanCategory,
          name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
        }).lean();
        if (existing) {
          throw new Error(`"${cleanName}" already exists in ${CATEGORY_META[cleanCategory]?.label || cleanCategory}.`);
        }

        const created = await this.Model.create(newObj);
        savedItem = created.toObject ? created.toObject() : created;
      } catch (dbErr) {
        if (dbErr.message && dbErr.message.includes('already exists')) {
          throw dbErr;
        }
        console.warn('[MasterSettingModel] Mongoose create note (trying collection fallback):', dbErr.message);
      }
    }

    // 2. Direct collection fallback if Mongoose model create had issue
    if (!savedItem && isMongoReady && mongoose.connection?.db) {
      try {
        await mongoose.connection.db.collection('master_settings').insertOne(newObj);
        savedItem = newObj;
      } catch (altErr) {
        console.warn('[MasterSettingModel] Collection insert note:', altErr.message);
      }
    }

    if (!savedItem && !isMongoReady) {
      throw new Error('Database connection is not available. Setting could not be saved to database.');
    }

    // 3. Keep local JSON seed file synced so future seeds include this setting
    try {
      const fs = require('fs');
      const path = require('path');
      const jsonSeedPath = path.join(__dirname, '..', 'data', 'master_settings', 'all_master_settings.json');
      let allSeeds = [];
      if (fs.existsSync(jsonSeedPath)) {
        allSeeds = JSON.parse(fs.readFileSync(jsonSeedPath, 'utf8'));
      }
      allSeeds = allSeeds.filter(s => s.id !== newObj.id && s.name.toLowerCase() !== newObj.name.toLowerCase());
      allSeeds.push(savedItem || newObj);
      fs.writeFileSync(jsonSeedPath, JSON.stringify(allSeeds, null, 2), 'utf8');
    } catch (fileErr) {}

    return savedItem || newObj;
  }

  /**
   * Update an existing option
   */
  async update(id, data) {
    await db.initDb();
    const mongoose = require('mongoose');
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const query = isMongoId ? { $or: [{ id }, { _id: id }] } : { id };

    const updateFields = {};
    if (data.name !== undefined) updateFields.name = String(data.name).trim();
    if (data.code !== undefined) updateFields.code = String(data.code).trim().toUpperCase();
    if (data.description !== undefined) updateFields.description = String(data.description).trim();
    if (data.sort_order !== undefined) updateFields.sort_order = Number(data.sort_order);
    if (data.is_active !== undefined) updateFields.is_active = Boolean(data.is_active);

    try {
      if (this.Model) {
        const updated = await this.Model.findOneAndUpdate(
          query,
          { $set: updateFields },
          { returnDocument: 'after' }
        ).lean();
        if (updated) return updated;
      }
    } catch (err) {}

    return { id, ...updateFields };
  }

  /**
   * Delete an option by ID or name
   */
  async delete(id) {
    await db.initDb();
    const mongoose = require('mongoose');
    let isMongoReady = Boolean(mongoose.connection && mongoose.connection.readyState === 1);
    if (!isMongoReady) {
      try {
        await db.initDb();
        isMongoReady = Boolean(mongoose.connection && mongoose.connection.readyState === 1);
      } catch (e) {}
    }
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const query = isMongoId ? { $or: [{ id }, { _id: id }] } : { $or: [{ id }, { name: id }] };

    let deleted = null;

    // 1. Remove from JSON file (instantaneous)
    try {
      const fs = require('fs');
      const path = require('path');
      const jsonSeedPath = path.join(__dirname, '..', 'data', 'master_settings', 'all_master_settings.json');
      if (fs.existsSync(jsonSeedPath)) {
        let allSeeds = JSON.parse(fs.readFileSync(jsonSeedPath, 'utf8'));
        const beforeLen = allSeeds.length;
        allSeeds = allSeeds.filter(s => s.id !== id && s.name !== id && String(s._id) !== id);
        if (allSeeds.length !== beforeLen) {
          fs.writeFileSync(jsonSeedPath, JSON.stringify(allSeeds, null, 2), 'utf8');
        }
      }
    } catch (fileErr) {}

    // 2. Primary Mongoose model if connected
    if (isMongoReady && this.Model) {
      try {
        deleted = await this.Model.findOneAndDelete(query).lean();
      } catch (err) {
        console.warn('[MasterSettingModel] Primary delete error:', err.message);
      }
    }

    // 3. Alternate collections if connected
    if (!deleted && isMongoReady && mongoose.connection?.db) {
      const alternateCols = [
        'master_settings',
        'master_setting',
        'mastersetting',
        'mastersettings',
        'MasterSetting',
        'MasterSettings',
        'settings'
      ];
      for (const colName of alternateCols) {
        try {
          const col = mongoose.connection.db.collection(colName);
          const res = await col.findOneAndDelete(query);
          if (res && (res.value || res)) {
            deleted = res.value || res;
            break;
          }
        } catch (e) {}
      }
    }

    // Never fail with 400/404 if item already deleted
    return deleted || { id, name: id, deleted: true };
  }
}

module.exports = new MasterSettingModel();

