/**
 * middleware/uploadMiddleware.js
 * Secure multipart photo upload middleware using multer and sharp:
 * - 2MB file size limit
 * - Strict image MIME and magic bytes validation (JPEG, PNG, WebP)
 * - Auto-resizing and compression to max 800px with sharp (WebP format)
 * - Cryptographically random filenames
 * - Configurable upload storage location (UPLOAD_DIR) outside git tracking
 */

const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Configurable upload directory (defaults to backend/uploads, can be an external volume)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// In-memory buffer storage for inspection and sharp processing before disk write
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

// Magic bytes lookup
function isValidImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WebP: RIFF ... WEBP (buffer[0..3] == 'RIFF' and buffer[8..11] == 'WEBP')
  if (buffer.length >= 12) {
    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    if (riff === 'RIFF' && webp === 'WEBP') return true;
  }
  return false;
}

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
  }
});

/**
 * Middleware that takes uploaded file, verifies magic bytes,
 * resizes/compresses to max 800px WebP, and writes to disk.
 */
async function processImageUpload(req, res, next) {
  if (!req.file) {
    return next();
  }

  try {
    const buffer = req.file.buffer;

    // Validate magic bytes to prevent renamed malicious files
    if (!isValidImageMagicBytes(buffer)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image file content. File does not match image signature.'
      });
    }

    // Generate secure random filename
    const randomHex = crypto.randomBytes(16).toString('hex');
    const filename = `${randomHex}.webp`;
    const outputPath = path.join(UPLOAD_DIR, filename);

    // Resize to max 800px on the longest dimension and compress with WebP
    await sharp(buffer)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Attach processed file URL and path to request
    req.uploadedFile = {
      filename,
      path: outputPath,
      url: `/uploads/${filename}`
    };
    req.fileUrl = `/uploads/${filename}`;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Image processing failed: ' + err.message
    });
  }
}

module.exports = {
  uploadSingle: upload.single('photo'),
  uploadLogo: upload.single('logo'),
  uploadField: (fieldName) => upload.single(fieldName),
  processImageUpload,
  UPLOAD_DIR
};

