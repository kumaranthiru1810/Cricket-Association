/**
 * backend/tests/test_passport_photo_verification.js
 * Security & correctness audit tests for Passport Photo Verification:
 * - Forged frontend clientFaceAnalysis NEVER produces VERIFIED
 * - Uncertain/low-texture images go to PENDING_REVIEW
 * - Blurred, corrupted, unsupported, oversized, and wrong-dimension photos rejected
 * - Duplicate dHash avoids false positives across distinct players & reuses same-user URL
 * - PENDING_REVIEW & REJECTED players blocked from match selection; NONE/VERIFIED allowed
 */

const assert = require('assert');
const sharp = require('sharp');

process.env.NODE_ENV = 'test';

const db = require('../config/db');
const passportPhotoService = require('../services/passportPhotoService');
const matchService = require('../services/matchService');

async function createTexturedPortraitBuffer(width = 600, height = 770, format = 'jpeg', seedOffset = 0) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const wave = Math.floor(128 + 60 * Math.sin((x + seedOffset) * 0.17) * Math.cos((y + seedOffset) * 0.13));
      const checker = ((x ^ y) + seedOffset) % 53;
      raw[idx] = Math.min(255, Math.max(0, wave + checker - 25));
      raw[idx + 1] = Math.min(255, Math.max(0, 255 - wave + (checker % 30)));
      raw[idx + 2] = Math.min(255, Math.max(0, (x * 3 + y * 5 + seedOffset) % 255));
    }
  }
  const pipeline = sharp(raw, { raw: { width, height, channels: 3 } });
  return format === 'png' ? pipeline.png().toBuffer() : pipeline.jpeg({ quality: 92 }).toBuffer();
}

async function runTests() {
  await db.initDb();
  await db.models.User.deleteMany({ id: /^PLY-DUP-/ });

  // 1. Forged frontend clientFaceAnalysis MUST NEVER produce VERIFIED when server ML is unavailable
  const validJpg = await createTexturedPortraitBuffer(620, 800, 'jpeg', 11);
  const forgedRes = await passportPhotoService.verifyAndProcessPassportPhoto({
    input: validJpg,
    email: 'forged-hint@example.com',
    userId: 'PLY-FORGED-1',
    clientFaceAnalysis: { supported: true, faceCount: 1, uncertain: false, engine: 'BrowserFaceDetector' },
    checkDuplicates: false,
    skipUpload: true
  });
  assert.strictEqual(
    forgedRes.verificationStatus,
    'PENDING_REVIEW',
    'Server MUST NOT trust clientFaceAnalysis to set VERIFIED'
  );
  assert.strictEqual(forgedRes.metadata.width, 600);
  assert.strictEqual(forgedRes.metadata.height, 770);
  assert.strictEqual(forgedRes.phash.length, 33);

  // 2. Low-texture / flat graphic -> queued for Admin manual review (PENDING_REVIEW)
  const flatGraphic = await sharp({
    create: { width: 600, height: 770, channels: 3, background: { r: 240, g: 180, b: 120 } }
  })
    .png()
    .toBuffer();
  // Create a slightly textured graphic (blurScore >= 8) with high flatRatio (> 0.85)
  const flatWithBorder = await sharp(flatGraphic)
    .composite([
      {
        input: await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 10, b: 10 } } }).png().toBuffer(),
        top: 50,
        left: 50
      }
    ])
    .png()
    .toBuffer();
  const flatRes = await passportPhotoService.verifyAndProcessPassportPhoto({
    input: flatWithBorder,
    clientFaceAnalysis: { supported: true, faceCount: 1, uncertain: false },
    checkDuplicates: false,
    skipUpload: true
  });
  assert.strictEqual(flatRes.verificationStatus, 'PENDING_REVIEW', 'Low-texture/graphic must go to PENDING_REVIEW');

  // 3. Excessively blurred photo -> rejected (400)
  const blurred = await sharp(validJpg).blur(25).jpeg().toBuffer();
  await assert.rejects(
    () =>
      passportPhotoService.verifyAndProcessPassportPhoto({
        input: blurred,
        checkDuplicates: false,
        skipUpload: true
      }),
    (err) => err.status === 400 && /blurred/i.test(err.message)
  );

  // 4. Corrupted / fake JPEG -> rejected (400)
  const fakeJpgUri = 'data:image/jpeg;base64,' + Buffer.from('NOT_A_REAL_JPEG_FILE_CONTENT').toString('base64');
  await assert.rejects(
    () =>
      passportPhotoService.verifyAndProcessPassportPhoto({
        input: fakeJpgUri,
        checkDuplicates: false,
        skipUpload: true
      }),
    (err) => err.status === 400 && /Invalid image content/i.test(err.message)
  );

  // 5. Unsupported format (WebP) -> rejected (400)
  const webpBuf = await sharp(validJpg).webp().toBuffer();
  await assert.rejects(
    () =>
      passportPhotoService.verifyAndProcessPassportPhoto({
        input: webpBuf,
        checkDuplicates: false,
        skipUpload: true
      }),
    (err) => err.status === 400
  );

  // 6. Oversized (> 5 MB) & wrong dimensions / landscape -> rejected (400)
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 100, 0xff);
  oversized[0] = 0xff;
  oversized[1] = 0xd8;
  oversized[2] = 0xff;
  await assert.rejects(
    () =>
      passportPhotoService.verifyAndProcessPassportPhoto({
        input: oversized,
        checkDuplicates: false,
        skipUpload: true
      }),
    (err) => err.status === 400 && /5 MB/i.test(err.message)
  );

  const landscape = await createTexturedPortraitBuffer(800, 600, 'jpeg', 5);
  await assert.rejects(
    () =>
      passportPhotoService.verifyAndProcessPassportPhoto({
        input: landscape,
        checkDuplicates: false,
        skipUpload: true
      }),
    (err) => err.status === 400 && /portrait/i.test(err.message)
  );

  // 7. Duplicate detection: distinct portraits NOT blocked; identical blocked for different user & reused for same user
  const dupEmail = `dup-owner-${Date.now()}@example.com`;
  const dupId = `PLY-DUP-${Date.now()}`;
  await db.models.User.create({
    id: dupId,
    name: 'DUP OWNER',
    email: dupEmail,
    role: 'PLAYER',
    status: 'ACTIVE',
    photo: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    photo_phash: forgedRes.phash
  });

  // Create a genuinely distinct portrait (left-to-right & top-to-bottom asymmetric luminance)
  const distinctRaw = Buffer.alloc(600 * 770 * 3);
  for (let y = 0; y < 770; y++) {
    for (let x = 0; x < 600; x++) {
      const idx = (y * 600 + x) * 3;
      const lum = x < 300 ? (y < 385 ? 40 : 210) : (y < 385 ? 220 : 60);
      const texture = ((x * 7 + y * 13) % 41) - 20;
      const v = Math.min(255, Math.max(0, lum + texture));
      distinctRaw[idx] = v;
      distinctRaw[idx + 1] = v;
      distinctRaw[idx + 2] = v;
    }
  }
  const distinctPortrait = await sharp(distinctRaw, { raw: { width: 600, height: 770, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
  const distinctRes = await passportPhotoService.verifyAndProcessPassportPhoto({
    input: distinctPortrait,
    email: `distinct-${Date.now()}@example.com`,
    userId: `PLY-DIST-${Date.now()}`,
    checkDuplicates: true,
    skipUpload: true
  });
  assert.strictEqual(distinctRes.reusedExisting, false, 'Distinct portrait must NOT be blocked as duplicate');

  const sameUserRes = await passportPhotoService.verifyAndProcessPassportPhoto({
    input: validJpg,
    email: dupEmail,
    userId: dupId,
    checkDuplicates: true,
    skipUpload: true
  });
  assert.strictEqual(sameUserRes.reusedExisting, true, 'Same user identical photo must reuse existing Cloudinary URL');

  await assert.rejects(
    () =>
      passportPhotoService.verifyAndProcessPassportPhoto({
        input: validJpg,
        email: `other-player-${Date.now()}@example.com`,
        userId: `PLY-OTHER-${Date.now()}`,
        checkDuplicates: true,
        skipUpload: true
      }),
    (err) => err.status === 409 && /Duplicate/i.test(err.message)
  );

  // 8. Match selection restrictions for PENDING_REVIEW & REJECTED players
  const pendingPlayerId = `PLY-PEND-${Date.now()}`;
  const rejectedPlayerId = `PLY-REJ-${Date.now()}`;
  const testMatchId = `M-PHOTO-AUDIT-${Date.now()}`;

  await Promise.all([
    db.models.User.create({
      id: pendingPlayerId,
      name: 'Pending Photo Player',
      email: `pend-${Date.now()}@example.com`,
      role: 'PLAYER',
      status: 'ACTIVE',
      photo_verification_status: 'PENDING_REVIEW'
    }),
    db.models.User.create({
      id: rejectedPlayerId,
      name: 'Rejected Photo Player',
      email: `rej-${Date.now()}@example.com`,
      role: 'PLAYER',
      status: 'ACTIVE',
      photo_verification_status: 'REJECTED'
    }),
    db.models.Match.create({
      id: testMatchId,
      tournament_id: 'T-AUDIT',
      team_a_id: 'TM-A',
      team_b_id: 'TM-B',
      team_a_name: 'Team A',
      team_b_name: 'Team B',
      overs_per_side: 20,
      status: 'SCHEDULED',
      schedule_confirmation_status: 'CONFIRMED'
    })
  ]);

  await assert.rejects(
    () =>
      matchService.startMatch(testMatchId, {
        tossWinner: 'TM-A',
        tossDecision: 'BAT',
        teamAPlayingXI: [pendingPlayerId],
        teamBPlayingXI: ['PLY-EXISTING-OK']
      }),
    (err) => err.status === 400 && /PENDING_REVIEW/i.test(err.message)
  );

  await assert.rejects(
    () =>
      matchService.startMatch(testMatchId, {
        tossWinner: 'TM-A',
        tossDecision: 'BAT',
        teamAPlayingXI: [rejectedPlayerId],
        teamBPlayingXI: ['PLY-EXISTING-OK']
      }),
    (err) => err.status === 400 && /REJECTED/i.test(err.message)
  );

  // Cleanup test records
  await Promise.all([
    db.models.User.deleteMany({ id: { $in: [dupId, pendingPlayerId, rejectedPlayerId] } }),
    db.models.Match.deleteOne({ id: testMatchId })
  ]);

  // 10. Simulate camera-captured printed photo: uncropped landscape fails, cropped 600x770 passes
  const rawCameraLandscape = await createTexturedPortraitBuffer(1200, 900, 'jpeg', 91);
  await assert.rejects(
    () =>
      passportPhotoService.verifyAndProcessPassportPhoto({
        input: rawCameraLandscape,
        checkDuplicates: false,
        skipUpload: true
      }),
    (err) => err.status === 400 && /portrait-style/i.test(err.message)
  );
  const croppedFromCamera = await sharp(rawCameraLandscape)
    .extract({ left: 300, top: 65, width: 600, height: 770 })
    .jpeg({ quality: 92 })
    .toBuffer();
  const croppedRes = await passportPhotoService.verifyAndProcessPassportPhoto({
    input: croppedFromCamera,
    email: 'camera-cropped@example.com',
    userId: 'PLY-CAM-1',
    checkDuplicates: false,
    skipUpload: true
  });
  assert.strictEqual(croppedRes.verificationStatus, 'PENDING_REVIEW');
  assert.strictEqual(croppedRes.metadata.width, 600);
  assert.strictEqual(croppedRes.metadata.height, 770);

  console.log('✅ All Security & Passport Photo Verification Audit tests passed!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Passport Photo Verification Audit test failed:', err);
    process.exit(1);
  });
