/**
 * scripts/migrations/unset-plaintext-passwords.js
 * Idempotent migration that removes plaintext password fields (`current_password`, `passkey`)
 * from all MongoDB collections. Runs automatically once at startup in production.
 */
const mongoose = require('mongoose');

async function unsetPlaintextPasswords(dbConnection = mongoose.connection) {
  if (!dbConnection || dbConnection.readyState !== 1 || !dbConnection.db) {
    return { skipped: true, reason: 'Database not connected' };
  }
  const collections = ['users', 'teams', 'teamregistrations', 'scorers', 'players'];
  const results = {};
  for (const colName of collections) {
    try {
      const col = dbConnection.db.collection(colName);
      const res = await col.updateMany(
        { $or: [{ current_password: { $exists: true } }, { passkey: { $exists: true } }] },
        { $unset: { current_password: '', passkey: '' } }
      );
      results[colName] = res.modifiedCount || 0;
    } catch (_err) {
      results[colName] = 0;
    }
  }
  return { skipped: false, modified: results };
}

if (require.main === module) {
  const env = require('../../config/env');
  mongoose.connect(env.MONGODB_URI).then(async () => {
    const out = await unsetPlaintextPasswords(mongoose.connection);
    console.log('unset-plaintext-passwords migration complete:', JSON.stringify(out));
    process.exit(0);
  }).catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { unsetPlaintextPasswords };

