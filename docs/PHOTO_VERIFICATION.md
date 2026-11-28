# Player Passport Photo Verification & Camera-Captured Printed Photo Cropping

## Overview
Players often photograph an already printed passport-size photo using a mobile camera. The raw camera image includes surrounding cloth/table background, white borders, tilt, and perspective distortion, which would fail a strict `0.62–0.90` portrait aspect-ratio check if validated uncropped.

## End-to-End Flow
1. **Capture or Gallery Selection (`PassportPhotoCropperModal.tsx`)**:
   - Players can choose an image from their gallery/files or capture live via camera (`getUserMedia` / `expo-image-picker`).
2. **Automatic Boundary Detection + Manual Perspective/Crop Correction**:
   - On Web, an HTML5 Canvas edge/contrast detector attempts to locate the rectangular printed passport photo inside the camera frame.
   - Players can rotate (`±90°`), fine-tilt (`-15°` to `+15°`), zoom/pan, or drag the 4 perspective corners directly onto the printed photo's corners.
   - Perspective warp / crop outputs a clean `600×770` (`7:9` portrait) JPEG with surrounding background and white borders removed, without stretching faces.
   - A preview of the cropped `600×770` portrait is shown before the player confirms.
3. **Client-Side Pre-Validation (`passportPhotoValidator.ts`)**:
   - Runs **on the cropped image** (JPG/PNG, `<= 5 MB`, `300×386` to `2000×2600`, portrait aspect `0.62–0.90`, optional Browser `FaceDetector` hint).
4. **Authoritative Server-Side Validation (`passportPhotoService.js`)**:
   - Never trusts `clientFaceAnalysis` or client-supplied flags.
   - Validates magic bytes (`FF D8 FF` JPEG, `89 50 4E 47` PNG), Sharp metadata, dimensions, portrait aspect (`0.62–0.90`), Laplacian blur variance, brightness, flat-graphic ratio, and perceptual `dHash:aHash` duplicate detection.
   - Resizes valid cropped images to `600×770` JPEG via Sharp (EXIF stripped) and uploads to Cloudinary (or local `/uploads/players/` fallback).
   - Preserves `VERIFIED` / `PENDING_REVIEW` / `REJECTED` workflow and admin review controls.

## Tunable Configuration
All thresholds live in `backend/config/photoVerification.js`:
- `RECOMMENDED_WIDTH`: `600`, `RECOMMENDED_HEIGHT`: `770`
- `MIN_PORTRAIT_ASPECT`: `0.62`, `MAX_PORTRAIT_ASPECT`: `0.90`
- `MIN_BLUR_VARIANCE`: `8`, `MIN_BRIGHTNESS`: `25`, `MAX_BRIGHTNESS`: `245`
- `DUPLICATE_HAMMING_THRESHOLD`: `2`
- `MAX_REUPLOAD_ATTEMPTS_PER_DAY`: `5`
- `REJECTED_RETENTION_DAYS`: `30`

## Calibration & Privacy Scripts
- **Calibration**: `node backend/scripts/photo-calibration.js <folder>` prints blur, brightness, and flat-ratio distributions.
- **Privacy Deletion**: `node backend/scripts/delete-player-photo.js <id_or_email>` clears stored photo URLs, `photo_phash`, `photo_checks`, and `face_embedding`.
- **Rejected Retention Cleanup**: `passportPhotoService.cleanupExpiredRejectedPhotos(30)` runs nightly via `server.js` to clear rejected photo metadata older than 30 days.

## Performance
On a typical 2 vCPU Node.js server, Sharp decoding + Laplacian/brightness signal analysis + `dHash:aHash` + `600×770` resize completes in ~35–80 ms per photo.

