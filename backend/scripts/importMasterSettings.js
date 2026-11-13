/**
 * backend/scripts/importMasterSettings.js
 * Script to import Master Settings JSON files into MongoDB.
 * 
 * Usage:
 *   node backend/scripts/importMasterSettings.js              # Imports all 7 categories
 *   node backend/scripts/importMasterSettings.js taluk_jurisdiction  # Imports only taluks
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const db = require('../config/db');

const DATA_DIR = path.join(__dirname, '..', 'data', 'master_settings');

const CATEGORY_FILES = {
  taluk_jurisdiction: 'taluk_jurisdiction.json',
  playing_role: 'playing_role.json',
  batting_style: 'batting_style.json',
  age_category: 'age_category.json',
  certification_level: 'certification_level.json',
  umpire_certification: 'umpire_certification.json',
  state: 'state.json'
};

async function importCategory(categoryKey, filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const items = JSON.parse(fileContent);

  console.log(`\n📂 Importing [${categoryKey}] from ${filename} (${items.length} items)...`);

  const MasterSetting = db.models.MasterSetting;
  let addedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const existing = await MasterSetting.findOne({
      $or: [
        { id: item.id },
        { category: item.category, name: item.name }
      ]
    });

    if (existing) {
      existing.name = item.name;
      existing.code = item.code || null;
      existing.description = item.description || null;
      existing.sort_order = item.sort_order || 0;
      existing.is_active = item.is_active !== undefined ? item.is_active : true;
      existing.updated_at = new Date();
      await existing.save();
      updatedCount++;
    } else {
      await MasterSetting.create({
        id: item.id || `MSET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        category: item.category,
        name: item.name,
        code: item.code || null,
        description: item.description || null,
        is_active: item.is_active !== undefined ? item.is_active : true,
        sort_order: item.sort_order || 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      addedCount++;
    }
  }

  console.log(`   ✅ ${categoryKey}: ${addedCount} inserted, ${updatedCount} updated.`);
}

async function run() {
  const targetCategory = process.argv[2];

  try {
    await db.initDb();
    console.log('🚀 Connected to MongoDB.');

    if (targetCategory && CATEGORY_FILES[targetCategory]) {
      await importCategory(targetCategory, CATEGORY_FILES[targetCategory]);
    } else if (targetCategory && !CATEGORY_FILES[targetCategory]) {
      console.error(`❌ Unknown category: "${targetCategory}". Available categories:`);
      Object.keys(CATEGORY_FILES).forEach(k => console.log(`   - ${k}`));
      process.exit(1);
    } else {
      for (const [key, file] of Object.entries(CATEGORY_FILES)) {
        await importCategory(key, file);
      }
    }

    const totalInDb = await db.models.MasterSetting.countDocuments();
    console.log(`\n🎉 Total Master Settings in DB: ${totalInDb}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Import failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { importCategory, CATEGORY_FILES };

