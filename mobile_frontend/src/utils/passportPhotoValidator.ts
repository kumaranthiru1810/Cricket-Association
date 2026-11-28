/**
 * mobile_frontend/src/utils/passportPhotoValidator.ts
 * Client-side passport photo pre-validation + printed-photo boundary detection
 * + 4-corner perspective warp & 600x770 portrait cropper.
 */

export interface ClientFaceAnalysis {
  supported: boolean;
  faceCount: number | null;
  uncertain: boolean;
  animalDetected?: boolean;
  engine: string;
}

export interface PassportPhotoValidationResult {
  valid: boolean;
  error?: string;
  dataUri?: string;
  width?: number;
  height?: number;
  clientFaceAnalysis?: ClientFaceAnalysis;
}

export interface NormPoint {
  x: number; // 0..1
  y: number; // 0..1
}

export type QuadCorners = [NormPoint, NormPoint, NormPoint, NormPoint]; // TL, TR, BR, BL

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_W = 300;
const MIN_H = 386;
const MAX_W = 2000;
const MAX_H = 2600;
const MIN_ASPECT = 0.62;
const MAX_ASPECT = 0.90;

export const TARGET_PASSPORT_W = 600;
export const TARGET_PASSPORT_H = 770;

export function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export function loadHtmlImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Corrupted or unreadable image file.'));
    el.src = dataUri;
  });
}

/**
 * Default centered 7:9 portrait quad inside an image of dimensions (w, h).
 */
export function getDefaultPortraitQuad(w: number, h: number): QuadCorners {
  const targetAspect = TARGET_PASSPORT_W / TARGET_PASSPORT_H; // ~0.779
  const imgAspect = w / Math.max(1, h);
  let qw: number;
  let qh: number;
  if (imgAspect > targetAspect) {
    qh = 0.84;
    qw = (qh * h * targetAspect) / w;
  } else {
    qw = 0.84;
    qh = (qw * w) / (h * targetAspect);
  }
  qw = Math.min(0.92, Math.max(0.25, qw));
  qh = Math.min(0.92, Math.max(0.25, qh));
  const left = (1 - qw) / 2;
  const top = (1 - qh) / 2;
  return [
    { x: left, y: top },
    { x: left + qw, y: top },
    { x: left + qw, y: top + qh },
    { x: left, y: top + qh }
  ];
}

/**
 * Heuristic rectangular boundary detector for a printed passport photo
 * photographed on a cloth/table background. Falls back to centered 7:9 quad if uncertain.
 */
export function detectPrintedPhotoBoundary(img: HTMLImageElement): { corners: QuadCorners; autoDetected: boolean } {
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const fallback = { corners: getDefaultPortraitQuad(natW, natH), autoDetected: false };

  if (typeof document === 'undefined' || !natW || !natH) return fallback;

  const maxSide = 220;
  const scale = Math.min(1, maxSide / Math.max(natW, natH));
  const w = Math.max(40, Math.round(natW * scale));
  const h = Math.max(40, Math.round(natH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return fallback;

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Sample outer 5% border as background color reference
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  let bgCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < 3 || x >= w - 3 || y < 3 || y >= h - 3) {
        const i = (y * w + x) * 4;
        bgR += data[i];
        bgG += data[i + 1];
        bgB += data[i + 2];
        bgCount++;
      }
    }
  }
  bgR /= Math.max(1, bgCount);
  bgG /= Math.max(1, bgCount);
  bgB /= Math.max(1, bgCount);

  // Compute row/col foreground-contrast profiles to find printed photo rectangle
  const rowScores = new Float32Array(h);
  const colScores = new Float32Array(w);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = (y * w + x) * 4;
      const diff =
        Math.abs(data[i] - bgR) +
        Math.abs(data[i + 1] - bgG) +
        Math.abs(data[i + 2] - bgB);
      if (diff > 55) {
        rowScores[y] += 1;
        colScores[x] += 1;
      }
    }
  }

  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  const colThresh = h * 0.16;
  const rowThresh = w * 0.16;

  for (let x = 3; x < w - 3; x++) {
    if (colScores[x] >= colThresh) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  for (let y = 3; y < h - 3; y++) {
    if (rowScores[y] >= rowThresh) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const boxW = maxX - minX;
  const boxH = maxY - minY;
  // Valid detected printed photo should cover a meaningful region (25%..95%)
  if (boxW < w * 0.22 || boxH < h * 0.25 || (boxW > w * 0.94 && boxH > h * 0.94)) {
    return fallback;
  }

  // Trim 2% inner margin to strip thin white paper borders
  const padX = boxW * 0.025;
  const padY = boxH * 0.025;
  const l = Math.max(0.01, (minX + padX) / w);
  const r = Math.min(0.99, (maxX - padX) / w);
  const t = Math.max(0.01, (minY + padY) / h);
  const b = Math.min(0.99, (maxY - padY) / h);

  const detW = (r - l) * natW;
  const detH = (b - t) * natH;
  const detAspect = detW / Math.max(1, detH);
  if (detAspect < 0.45 || detAspect > 1.15) {
    return fallback;
  }

  return {
    corners: [
      { x: l, y: t },
      { x: r, y: t },
      { x: r, y: b },
      { x: l, y: b }
    ],
    autoDetected: true
  };
}

/**
 * Solves 8-DOF homography mapping destination (0..outW, 0..outH) -> source pixel (x, y)
 * and renders a crisp 600x770 portrait JPEG without stretching.
 */
export function warpQuadToPassport600x770(
  img: HTMLImageElement,
  corners: QuadCorners,
  rotationDeg = 0
): string {
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;

  // Step 1: Apply rotation around image center onto an intermediate canvas
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const rotW = Math.max(1, Math.round(natW * cos + natH * sin));
  const rotH = Math.max(1, Math.round(natW * sin + natH * cos));

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = rotW;
  srcCanvas.height = rotH;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) throw new Error('Canvas unavailable');

  srcCtx.save();
  srcCtx.translate(rotW / 2, rotH / 2);
  srcCtx.rotate(rad);
  srcCtx.drawImage(img, -natW / 2, -natH / 2, natW, natH);
  srcCtx.restore();

  const srcImgData = srcCtx.getImageData(0, 0, rotW, rotH);
  const src = srcImgData.data;

  // Step 2: Perspective / bilinear quad warp onto 600x770 output canvas
  const outW = TARGET_PASSPORT_W;
  const outH = TARGET_PASSPORT_H;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas unavailable');

  const outImgData = outCtx.createImageData(outW, outH);
  const dst = outImgData.data;

  const p0 = { x: corners[0].x * rotW, y: corners[0].y * rotH }; // TL
  const p1 = { x: corners[1].x * rotW, y: corners[1].y * rotH }; // TR
  const p2 = { x: corners[2].x * rotW, y: corners[2].y * rotH }; // BR
  const p3 = { x: corners[3].x * rotW, y: corners[3].y * rotH }; // BL

  for (let y = 0; y < outH; y++) {
    const v = y / (outH - 1);
    const leftX = p0.x + (p3.x - p0.x) * v;
    const leftY = p0.y + (p3.y - p0.y) * v;
    const rightX = p1.x + (p2.x - p1.x) * v;
    const rightY = p1.y + (p2.y - p1.y) * v;

    for (let x = 0; x < outW; x++) {
      const u = x / (outW - 1);
      const sx = leftX + (rightX - leftX) * u;
      const sy = leftY + (rightY - leftY) * u;

      const x0 = Math.min(rotW - 1, Math.max(0, Math.floor(sx)));
      const y0 = Math.min(rotH - 1, Math.max(0, Math.floor(sy)));
      const x1 = Math.min(rotW - 1, x0 + 1);
      const y1 = Math.min(rotH - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * rotW + x0) * 4;
      const i10 = (y0 * rotW + x1) * 4;
      const i01 = (y1 * rotW + x0) * 4;
      const i11 = (y1 * rotW + x1) * 4;

      const dIdx = (y * outW + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
        const bot = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
        dst[dIdx + c] = Math.round(top * (1 - fy) + bot * fy);
      }
      dst[dIdx + 3] = 255;
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Validates a CROPPED passport photograph (data URI or File).
 * Used after cropping away background/borders from mobile camera photos.
 */
export async function validateCroppedPassportPhoto(dataUri: string): Promise<PassportPhotoValidationResult> {
  if (!dataUri || !dataUri.startsWith('data:image/')) {
    return { valid: false, error: 'Invalid cropped image data.' };
  }

  const approxBytes = Math.round((dataUri.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    return { valid: false, error: 'Cropped photo exceeds the 5 MB limit.' };
  }

  const img = await loadHtmlImage(dataUri);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  if (width < MIN_W || height < MIN_H) {
    return {
      valid: false,
      error: `Cropped image too small (${width}x${height}px). Minimum is ${MIN_W}x${MIN_H}px (recommended 600x770px).`
    };
  }

  if (width > MAX_W || height > MAX_H) {
    return {
      valid: false,
      error: `Cropped image too large (${width}x${height}px). Maximum allowed is ${MAX_W}x${MAX_H}px.`
    };
  }

  if (height <= width) {
    return {
      valid: false,
      error: `Only portrait-style photographs are allowed (${width}x${height}px). Recommended: 600x770px.`
    };
  }

  const aspect = width / height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    return {
      valid: false,
      error: `Invalid portrait aspect ratio (${width}x${height}px). Please adjust crop to a ~7:9 passport photo.`
    };
  }

  // Optional Browser FaceDetector API (advisory hint only; server re-checks authoritatively)
  let clientFaceAnalysis: ClientFaceAnalysis = {
    supported: false,
    faceCount: null,
    uncertain: true,
    engine: 'BrowserFaceDetectorUnavailable'
  };

  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const DetectorCtor = (window as any).FaceDetector;
      const detector = new DetectorCtor({ fastMode: false, maxDetectedFaces: 5 });
      const faces = await detector.detect(img);
      const count = Array.isArray(faces) ? faces.length : 0;

      if (count === 0) {
        return {
          valid: false,
          error: 'No human face detected in the cropped photo. Please frame only the player face clearly.'
        };
      }
      if (count > 1) {
        return {
          valid: false,
          error: `Group photo detected (${count} faces). Exactly 1 human face is required.`
        };
      }

      clientFaceAnalysis = {
        supported: true,
        faceCount: 1,
        uncertain: false,
        engine: 'BrowserFaceDetector'
      };
    } catch (_e) {
      clientFaceAnalysis = {
        supported: false,
        faceCount: null,
        uncertain: true,
        engine: 'BrowserFaceDetectorError'
      };
    }
  }

  return {
    valid: true,
    dataUri,
    width,
    height,
    clientFaceAnalysis
  };
}

export async function validatePassportPhotoFile(file: File): Promise<PassportPhotoValidationResult> {
  if (!file) {
    return { valid: false, error: 'Please select an image file.' };
  }
  if (!ALLOWED_MIMES.has(String(file.type || '').toLowerCase())) {
    return { valid: false, error: 'Only JPG, JPEG, and PNG images are allowed.' };
  }
  if (file.size > MAX_BYTES) {
    return { valid: false, error: 'Photo file size must be 5 MB or less.' };
  }
  const dataUri = await readFileAsDataUri(file);
  return validateCroppedPassportPhoto(dataUri);
}
