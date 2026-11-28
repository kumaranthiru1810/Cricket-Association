/**
 * backend/scripts/photo-calibration.js
 * Runs image quality and perceptual hash analysis on a folder of sample photos
 * and prints score distributions so thresholds in config/photoVerification.js can be tuned.
 *
 * Usage: node scripts/photo-calibration.js <folder_path>
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const passportPhotoService = require('../services/passportPhotoService');

async function main() {
  const folder = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../uploads/players');
  if (!fs.existsSync(folder)) {
    console.error(`Folder not found: ${folder}`);
    process.exit(1);
  }

  const files = fs.readdirSync(folder).filter((f) => /\.(jpe?g|png)$/i.test(f));
  if (files.length === 0) {
    console.log(`No JPG/PNG files found in ${folder}`);
    return;
  }

  const blurScores = [];
  const flatRatios = [];
  const brightnesses = [];

  for (const file of files) {
    const buf = fs.readFileSync(path.join(folder, file));
    const meta = await sharp(buf).metadata();
    const signals = await passportPhotoService.analyzeImageSignals(buf);
    blurScores.push(signals.blurScore);
    flatRatios.push(signals.flatRatio);
    brightnesses.push(signals.brightness);
    console.log(
      `${file}: ${meta.width}x${meta.height} (${meta.format}) | blur=${signals.blurScore} | brightness=${signals.brightness} | flatRatio=${signals.flatRatio}`
    );
  }

  const summarize = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    return {
      min: sorted[0],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      max: sorted[sorted.length - 1],
      avg: Number(avg.toFixed(2))
    };
  };

  console.log('\n--- Calibration Summary ---');
  console.log('Blur Variance:', summarize(blurScores));
  console.log('Brightness:   ', summarize(brightnesses));
  console.log('Flat Ratio:   ', summarize(flatRatios));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

