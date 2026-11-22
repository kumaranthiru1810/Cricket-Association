/**
 * migrations/001_add_token_version.js
 * 
 * Sets token_version: 0 on all existing users without modifying any existing role assignments.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../config/db');

async function migrate() {
  console.log('🚀 Running migration: 001_add_token_version...');
  await db.initDb();

  const result = await db.models.User.updateMany(
    { token_version: { $exists: false } },
    { $set: { token_version: 0 } }
  );

  console.log(`✅ Migration complete: ${result.modifiedCount || 0} user(s) updated with token_version: 0.`);
  return result;
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrate;
