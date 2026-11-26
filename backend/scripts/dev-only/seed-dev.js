/**
 * scripts/dev-only/seed-dev.js
 * Development-only database seeding helper. Refuses to run outside development.
 */
const env = require('../../config/env');

if (!env.isDevelopment) {
  console.error('REFUSED: scripts/dev-only/seed-dev.js can only run when NODE_ENV=development.');
  process.exit(1);
}

const db = require('../../config/db');

(async () => {
  await db.initDb();
  console.log('Development seed verified successfully.');
  process.exit(0);
})().catch(err => {
  console.error('Dev seed failed:', err.message);
  process.exit(1);
});

