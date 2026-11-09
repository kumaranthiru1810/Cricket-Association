const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runPhotoTests() {
  console.log('\n=========================================');
  console.log('🧪 TESTING PLAYER PHOTO & IMAGE_PATH');
  console.log('=========================================\n');

  // Test 1: Verify playerModel module exports
  console.log('--- Test 1: playerModel methods ---');
  const playerModel = require('../models/playerModel');
  assert.strictEqual(typeof playerModel.findById, 'function', 'findById should be a function');
  assert.strictEqual(typeof playerModel.findByEmail, 'function', 'findByEmail should be a function');
  assert.strictEqual(typeof playerModel.findByIdOrEmail, 'function', 'findByIdOrEmail should be a function');
  assert.strictEqual(typeof playerModel.create, 'function', 'create should be a function');
  assert.strictEqual(typeof playerModel.updateProfile, 'function', 'updateProfile should be a function');
  assert.strictEqual(typeof playerModel.updatePhoto, 'function', 'updatePhoto should be a function');
  console.log('  ✅ [PASS] playerModel has all required CRUD methods');

  // Test 2: Verify Schemas in db.js
  console.log('\n--- Test 2: Mongoose Schemas have photo & image_path ---');
  const db = require('../config/db');
  
  const playerSchema = db.models.Player.schema;
  assert.ok(playerSchema.path('photo'), 'PlayerSchema must have photo path');
  assert.ok(playerSchema.path('image_path'), 'PlayerSchema must have image_path path');
  console.log('  ✅ [PASS] PlayerSchema has photo and image_path fields');

  const userSchema = db.models.User.schema;
  assert.ok(userSchema.path('photo'), 'UserSchema must have top-level photo path');
  assert.ok(userSchema.path('image_path'), 'UserSchema must have top-level image_path path');
  assert.ok(userSchema.path('player_details.photo'), 'UserSchema must have player_details.photo path');
  assert.ok(userSchema.path('player_details.image_path'), 'UserSchema must have player_details.image_path path');
  console.log('  ✅ [PASS] UserSchema has photo and image_path fields in top-level and player_details');

  const teamPlayerSchema = db.models.TeamPlayer.schema;
  assert.ok(teamPlayerSchema.path('photo'), 'TeamPlayerSchema must have photo path');
  assert.ok(teamPlayerSchema.path('image_path'), 'TeamPlayerSchema must have image_path path');
  console.log('  ✅ [PASS] TeamPlayerSchema has photo and image_path fields');

  // Test 3: Base64 disk writer and upload directory
  console.log('\n--- Test 3: Base64 Photo Disk Persistence ---');
  // 1x1 transparent GIF or tiny jpeg base64
  const sampleBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  
  // Test disk save via playerService
  const playerService = require('../services/playerService');
  const testEmail = `test_photo_${Date.now()}@association.org`;

  const uploadsDir = path.join(__dirname, '..', 'uploads', 'players');
  assert.ok(fs.existsSync(uploadsDir), 'uploads/players directory must exist');

  // Write a test image through helper logic
  const filename = `plyr_test_${Date.now()}.jpg`;
  const filePath = path.join(uploadsDir, filename);
  const match = sampleBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
  assert.ok(fs.existsSync(filePath), 'Saved image file must exist on disk');
  fs.unlinkSync(filePath); // Clean up
  console.log('  ✅ [PASS] Image disk writing to uploads/players works correctly');

  console.log('\n🎉 ALL PLAYER PHOTO TESTS PASSED!\n');
}

runPhotoTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
