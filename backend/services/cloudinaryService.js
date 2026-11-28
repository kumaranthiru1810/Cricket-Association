/**
 * backend/services/cloudinaryService.js
 * Zero-dependency signed Cloudinary image uploader using Node crypto + fetch.
 * Reads CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET from env.
 */

const crypto = require('crypto');

function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').replace(/^"|"$/g, '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').replace(/^"|"$/g, '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').replace(/^"|"$/g, '').trim();
  return { cloudName, apiKey, apiSecret };
}

function isConfigured() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  return Boolean(cloudName && apiKey && apiSecret);
}

/**
 * Uploads an image Buffer or data:image/... base64 URI to Cloudinary.
 * Returns { uploaded: true, url, publicId } or { uploaded: false, url: null, error }.
 */
async function uploadImage(input, options = {}) {
  const { folder = 'cfvd', publicId = null, mimeType = 'image/webp' } = options;

  if (!input) {
    return { uploaded: false, url: null, error: 'No image input provided' };
  }

  if (typeof input === 'string' && input.includes('res.cloudinary.com')) {
    return { uploaded: true, url: input, publicId: null, alreadyHosted: true };
  }

  if (!isConfigured()) {
    return { uploaded: false, url: null, error: 'Cloudinary env vars not configured' };
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  // Build sorted params string for Cloudinary SHA-1 signature
  const signParams = {};
  if (folder) signParams.folder = folder;
  if (publicId) signParams.public_id = publicId;
  signParams.timestamp = timestamp;

  const toSign =
    Object.keys(signParams)
      .sort()
      .map((k) => `${k}=${signParams[k]}`)
      .join('&') + apiSecret;

  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  let fileDataUri = input;
  if (Buffer.isBuffer(input)) {
    fileDataUri = `data:${mimeType};base64,${input.toString('base64')}`;
  }

  try {
    const form = new FormData();
    form.append('file', fileDataUri);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    if (folder) form.append('folder', folder);
    if (publicId) form.append('public_id', publicId);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST',
      body: form
    });

    const data = await res.json();
    if (!res.ok || !data.secure_url) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      console.warn('[Cloudinary] Upload failed:', errMsg);
      return { uploaded: false, url: null, error: errMsg };
    }

    return {
      uploaded: true,
      url: data.secure_url,
      publicId: data.public_id
    };
  } catch (err) {
    console.warn('[Cloudinary] Upload error:', err.message);
    return { uploaded: false, url: null, error: err.message };
  }
}

module.exports = {
  isConfigured,
  getCloudinaryConfig,
  uploadImage
};

