/**
 * backend/services/passportPhotoService.js
 * Authoritative passport-size player photo validation, perceptual hashing,
 * blur/cartoon/dimension checks, Sharp resizing (600x770), and Cloudinary storage.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cloudinaryService = require('./cloudinaryService');
const config = require('../config/photoVerification');

const {
  RECOMMENDED_WIDTH,
  RECOMMENDED_HEIGHT,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
  MAX_FILE_BYTES,
  MIN_PORTRAIT_ASPECT,
  MAX_PORTRAIT_ASPECT,
  MIN_BLUR_VARIANCE,
  MIN_BRIGHTNESS,
  MAX_BRIGHTNESS,
  FLAT_GRAPHIC_REVIEW_RATIO,
  DUPLICATE_HAMMING_THRESHOLD,
  REJECTED_RETENTION_DAYS
} = config;

/**
 * Validates actual image magic bytes (JPG/JPEG or PNG only).
 */
function detectImageFormatByMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}

/**
 * Decodes a data:image/...;base64,... string or Buffer into a raw Buffer.
 */
function decodePhotoInput(input) {
  if (Buffer.isBuffer(input)) {
    return { buffer: input, declaredMime: null };
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
    if (!match) {
      throw { status: 400, message: 'Invalid image payload. Please upload a valid JPG, JPEG, or PNG photo.' };
    }
    const declaredMime = match[1].toLowerCase();
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(declaredMime)) {
      throw { status: 400, message: 'Unsupported image format. Only JPG, JPEG, and PNG images are allowed.' };
    }
    const buffer = Buffer.from(match[2], 'base64');
    return { buffer, declaredMime };
  }
  throw { status: 400, message: 'Invalid photo input.' };
}

/**
 * Computes a 128-bit perceptual fingerprint: 64-bit dHash + ':' + 64-bit aHash.
 */
async function computeDHash(buffer) {
  const [dRaw, aRaw] = await Promise.all([
    sharp(buffer).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer(),
    sharp(buffer).grayscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer()
  ]);

  let dBits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      dBits += dRaw[y * 9 + x] < dRaw[y * 9 + x + 1] ? '1' : '0';
    }
  }

  let sum = 0;
  for (let i = 0; i < 64; i++) sum += aRaw[i];
  const avg = sum / 64;
  let aBits = '';
  for (let i = 0; i < 64; i++) {
    aBits += aRaw[i] >= avg ? '1' : '0';
  }

  let dHex = '';
  let aHex = '';
  for (let i = 0; i < 64; i += 4) {
    dHex += parseInt(dBits.slice(i, i + 4), 2).toString(16);
    aHex += parseInt(aBits.slice(i, i + 4), 2).toString(16);
  }
  return `${dHex}:${aHex}`;
}

/**
 * Computes bit-level Hamming distance between two perceptual fingerprints.
 * When both have dHash:aHash, returns the max of the two distances so BOTH must match.
 */
function hammingDistance(hashA, hashB) {
  if (!hashA || !hashB) return 64;
  const [dA, aA] = String(hashA).split(':');
  const [dB, aB] = String(hashB).split(':');

  const bitDist = (h1, h2) => {
    if (!h1 || !h2 || h1.length !== h2.length) return 64;
    let dist = 0;
    for (let i = 0; i < h1.length; i++) {
      const xor = parseInt(h1[i], 16) ^ parseInt(h2[i], 16);
      dist += (xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1);
    }
    return dist;
  };

  const dDist = bitDist(dA, dB);
  if (aA && aB) {
    return Math.max(dDist, bitDist(aA, aB));
  }
  return dDist;
}

/**
 * Measures sharpness (2D Laplacian variance) and flat-shading ratio (cartoon/illustration signal).
 */
async function analyzeImageSignals(buffer) {
  const w = 160;
  const h = 205;
  const gray = await sharp(buffer)
    .grayscale()
    .resize(w, h, { fit: 'fill' })
    .raw()
    .toBuffer();

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let flatCount = 0;
  let brightnessSum = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const center = gray[idx];
      brightnessSum += center;
      const lap = 4 * center - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
      sum += lap;
      sumSq += lap * lap;
      count++;

      const dx = Math.abs(center - gray[idx + 1]);
      const dy = Math.abs(center - gray[idx + w]);
      if (dx <= 1 && dy <= 1) flatCount++;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  const blurScore = count > 0 ? (sumSq / count) - mean * mean : 0;
  const flatRatio = count > 0 ? flatCount / count : 1;
  const brightness = count > 0 ? brightnessSum / count : 0;

  return {
    blurScore: Number(blurScore.toFixed(2)),
    flatRatio: Number(flatRatio.toFixed(3)),
    brightness: Number(brightness.toFixed(1))
  };
}

/**
 * Server-side ML face/object detection is not bundled in this runtime;
 * always returns available: false so every photo routes to PENDING_REVIEW
 * for authoritative Admin verification (fail-safe: never auto-approves).
 */
async function runServerSideDetection(_buffer) {
  return {
    available: false,
    uncertain: true,
    faceCount: null,
    animalDetected: false,
    engine: 'manual-admin-review'
  };
}

/**
 * Authoritatively validates, processes (600x770), checks duplicates via dHash,
 * and uploads to Cloudinary (or local fallback if Cloudinary is not configured).
 * NEVER trusts clientFaceAnalysis to mark a photo VERIFIED.
 */
async function verifyAndProcessPassportPhoto({
  input,
  email = null,
  userId = null,
  clientFaceAnalysis = null, // Untrusted hint only; never used for VERIFIED
  checkDuplicates = true,
  skipUpload = false
}) {
  const { buffer } = decodePhotoInput(input);

  if (!buffer || buffer.length === 0) {
    throw { status: 400, message: 'Uploaded photo file is empty or corrupted.' };
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw { status: 400, message: 'Photo file size exceeds the 5 MB limit.' };
  }

  const magicFormat = detectImageFormatByMagicBytes(buffer);
  if (!magicFormat) {
    throw { status: 400, message: 'Invalid image content. Only authentic JPG, JPEG, and PNG photos are allowed.' };
  }

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (_err) {
    throw { status: 400, message: 'Corrupted or unreadable image file.' };
  }

  if (!metadata || !['jpeg', 'png'].includes(metadata.format)) {
    throw { status: 400, message: 'Unsupported image encoding. Only JPG, JPEG, and PNG are allowed.' };
  }

  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    throw {
      status: 400,
      message: `Photo resolution too small (${width}x${height}px). Minimum required is ${MIN_WIDTH}x${MIN_HEIGHT}px.`
    };
  }

  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw {
      status: 400,
      message: `Photo resolution too large (${width}x${height}px). Maximum allowed is ${MAX_WIDTH}x${MAX_HEIGHT}px.`
    };
  }

  if (height <= width) {
    throw {
      status: 400,
      message: `Only portrait-style photographs are allowed (current: ${width}x${height}px). Recommended: ${RECOMMENDED_WIDTH}x${RECOMMENDED_HEIGHT}px.`
    };
  }

  const aspect = width / height;
  if (aspect < MIN_PORTRAIT_ASPECT || aspect > MAX_PORTRAIT_ASPECT) {
    throw {
      status: 400,
      message: `Invalid portrait aspect ratio (${width}x${height}px). Please upload a ~7:9 passport-size portrait (recommended ${RECOMMENDED_WIDTH}x${RECOMMENDED_HEIGHT}px).`
    };
  }

  // Blur, brightness & low-texture / flat-graphic signal check
  const { blurScore, flatRatio, brightness } = await analyzeImageSignals(buffer);
  if (blurScore < MIN_BLUR_VARIANCE) {
    throw {
      status: 400,
      message: 'Photo is excessively blurred or unclear. Please upload a sharp, well-lit passport photograph.'
    };
  }
  const lowTextureGraphic = flatRatio > FLAT_GRAPHIC_REVIEW_RATIO;
  const poorLighting = brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS;

  // Authoritative server-side ML detection (never trust clientFaceAnalysis)
  const serverDetection = await runServerSideDetection(buffer);
  if (serverDetection.available) {
    if (serverDetection.animalDetected) {
      throw {
        status: 400,
        message: 'Animal or non-human subject detected. Please upload a clear passport photo of the player.'
      };
    }
    if (serverDetection.faceCount === 0) {
      throw {
        status: 400,
        message: 'No human face detected in the photograph. Please upload a clear front-facing portrait.'
      };
    }
    if (serverDetection.faceCount > 1) {
      throw {
        status: 400,
        message: `Multiple faces detected (${serverDetection.faceCount}). Group photos are not allowed — only 1 human face is permitted.`
      };
    }
  }

  // Perceptual hash duplicate detection (strict threshold <= 2 bits to avoid false positives)
  const phash = await computeDHash(buffer);
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  // Determine honest verification status strictly from server-side checks
  const serverVerified =
    serverDetection.available &&
    serverDetection.faceCount === 1 &&
    !serverDetection.uncertain &&
    !lowTextureGraphic;

  const verificationStatus = serverVerified ? 'VERIFIED' : 'PENDING_REVIEW';
  const verificationReason = serverVerified
    ? 'Passed server-side portrait, quality, and single-face verification.'
    : lowTextureGraphic
      ? 'Low-texture image (possible graphic or studio backdrop); queued for Admin manual review.'
      : 'Photo passed format, dimension, and sharpness checks; queued for Admin manual face verification.';

  const untrustedHintNote =
    clientFaceAnalysis && typeof clientFaceAnalysis === 'object'
      ? `client-hint:${clientFaceAnalysis.engine || 'none'}`
      : 'sharp-dhash';

  if (checkDuplicates) {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const db = require('../config/db');
      const [existingUsers, existingPlayers] = await Promise.all([
        db.models.User.find({ photo_phash: { $ne: null } })
          .select('id email photo photo_phash')
          .lean(),
        db.models.Player.find({ photo_phash: { $ne: null } })
          .select('id email photo photo_phash')
          .lean()
      ]);

      const allRecords = [...(existingUsers || []), ...(existingPlayers || [])];
      for (const rec of allRecords) {
        if (!rec.photo_phash) continue;
        const dist = hammingDistance(phash, rec.photo_phash);
        const isSameAccount =
          (cleanEmail && rec.email && rec.email.toLowerCase() === cleanEmail) ||
          (userId && rec.id && rec.id === userId);

        if (isSameAccount && dist <= DUPLICATE_HAMMING_THRESHOLD && rec.photo && rec.photo.startsWith('http')) {
          return {
            url: rec.photo,
            phash,
            reusedExisting: true,
            verificationStatus,
            verificationReason,
            metadata: {
              width: RECOMMENDED_WIDTH,
              height: RECOMMENDED_HEIGHT,
              format: magicFormat,
              sizeBytes: buffer.length,
              blurScore,
              faceCount: serverDetection.available ? serverDetection.faceCount : null,
              engine: `${serverDetection.engine} (${untrustedHintNote})`
            }
          };
        }

        if (!isSameAccount && dist <= DUPLICATE_HAMMING_THRESHOLD) {
          throw {
            status: 409,
            message: 'Duplicate or nearly identical passport photograph already registered to another player.'
          };
        }
      }
    }
  }

  // Process & resize to 600x770 passport portrait
  const processedBuffer = await sharp(buffer)
    .rotate()
    .resize(RECOMMENDED_WIDTH, RECOMMENDED_HEIGHT, {
      fit: 'cover',
      position: 'attention'
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  let storedUrl = null;
  if (!skipUpload) {
    const cleanId = (userId || cleanEmail || 'player').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (cloudinaryService.isConfigured()) {
      const cloudRes = await cloudinaryService.uploadImage(processedBuffer, {
        folder: 'cfvd/players',
        publicId: `plyr_${cleanId}_${Date.now()}`,
        mimeType: 'image/jpeg'
      });
      if (cloudRes.uploaded && cloudRes.url) {
        storedUrl = cloudRes.url;
      }
    }
    if (!storedUrl) {
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'players');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filename = `plyr_${cleanId}_${Date.now()}.jpg`;
      fs.writeFileSync(path.join(uploadsDir, filename), processedBuffer);
      storedUrl = `/uploads/players/${filename}`;
    }
  }

  const reasons = [];
  if (lowTextureGraphic) reasons.push('low_texture_graphic');
  if (poorLighting) reasons.push('poor_lighting');
  if (!serverDetection.available) reasons.push('awaiting_admin_face_review');

  const photoChecks = {
    faceCount: serverDetection.available ? serverDetection.faceCount : null,
    faceScore: null,
    faceSizeRatio: null,
    yaw: null,
    pitch: null,
    blurScore,
    brightness,
    nsfwScore: null,
    antispoofScore: null,
    livenessScore: null,
    reasons
  };

  return {
    url: storedUrl,
    phash,
    reusedExisting: false,
    verificationStatus,
    photoStatus: verificationStatus === 'VERIFIED' ? 'AUTO_PASS' : 'NEEDS_REVIEW',
    verificationReason,
    photoChecks,
    metadata: {
      width: RECOMMENDED_WIDTH,
      height: RECOMMENDED_HEIGHT,
      format: magicFormat,
      sizeBytes: buffer.length,
      blurScore,
      brightness,
      faceCount: serverDetection.available ? serverDetection.faceCount : null,
      engine: `${serverDetection.engine} (${untrustedHintNote})`
    }
  };
}

/**
 * Deletes a player's stored photo URL, pHash, photo_checks, and face_embedding (privacy request).
 */
async function deletePlayerPhotoData(playerIdOrEmail) {
  const db = require('../config/db');
  await db.initDb();
  const key = String(playerIdOrEmail || '').trim();
  const cleanEmail = key.toLowerCase();
  const unsetFields = {
    photo: null,
    image_path: null,
    photo_phash: null,
    photo_verification_status: 'NONE',
    photo_verification_reason: '',
    photo_status: 'PENDING',
    photo_checks: null,
    face_embedding: null,
    'player_details.photo': null,
    'player_details.image_path': null,
    'player_details.photo_phash': null
  };
  const [uRes, pRes] = await Promise.all([
    db.models.User.updateMany({ $or: [{ id: key }, { email: cleanEmail }] }, { $set: unsetFields }),
    db.models.Player.updateMany({ $or: [{ id: key }, { email: cleanEmail }] }, { $set: unsetFields })
  ]);
  return { usersUpdated: uRes.modifiedCount || 0, playersUpdated: pRes.modifiedCount || 0 };
}

/**
 * Clears REJECTED photo URLs and embeddings older than retentionDays (default 30).
 */
async function cleanupExpiredRejectedPhotos(retentionDays = REJECTED_RETENTION_DAYS) {
  const db = require('../config/db');
  await db.initDb();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const clearSet = {
    photo: null,
    image_path: null,
    photo_phash: null,
    photo_checks: null,
    face_embedding: null
  };
  const filter = {
    $or: [{ photo_verification_status: 'REJECTED' }, { photo_status: 'REJECTED' }],
    updatedAt: { $lt: cutoff }
  };
  const [uRes, pRes] = await Promise.all([
    db.models.User.updateMany(filter, { $set: clearSet }),
    db.models.Player.updateMany(filter, { $set: clearSet })
  ]);
  return { usersCleaned: uRes.modifiedCount || 0, playersCleaned: pRes.modifiedCount || 0 };
}

module.exports = {
  RECOMMENDED_WIDTH,
  RECOMMENDED_HEIGHT,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
  MAX_FILE_BYTES,
  detectImageFormatByMagicBytes,
  computeDHash,
  hammingDistance,
  analyzeImageSignals,
  verifyAndProcessPassportPhoto,
  deletePlayerPhotoData,
  cleanupExpiredRejectedPhotos
};

