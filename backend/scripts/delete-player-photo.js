/**
 * backend/scripts/delete-player-photo.js
 * Privacy utility to delete a player's stored photo, perceptual hash,
 * photo checks, and face embedding on request.
 *
 * Usage: node scripts/delete-player-photo.js <player_id_or_email>
 */

require('dotenv').config();
const db = require('../config/db');
const passportPhotoService = require('../services/passportPhotoService');

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/delete-player-photo.js <player_id_or_email>');
    process.exit(1);
  }

  await db.initDb();
  const result = await passportPhotoService.deletePlayerPhotoData(target);
  console.log('Deleted photo & biometric metadata:', result);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to delete player photo data:', err.message);
  process.exit(1);
});

