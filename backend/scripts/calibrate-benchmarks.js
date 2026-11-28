/**
 * backend/scripts/calibrate-benchmarks.js
 * Computes median runs per batting innings, strike rate, economy, and balls per wicket
 * per format from COMPLETED matches in MongoDB and prints suggested benchmark values.
 *
 * Usage: node scripts/calibrate-benchmarks.js
 */

require('dotenv').config();
const db = require('../config/db');

function median(arr) {
  if (!arr || arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  await db.initDb();
  const completedMatches = await db.models.Match.find({ status: 'COMPLETED' })
    .select('id match_type')
    .lean();

  if (completedMatches.length === 0) {
    console.log('No COMPLETED matches found in DB.');
    process.exit(0);
  }

  const matchFormatMap = new Map(
    completedMatches.map(m => [m.id, String(m.match_type || 'T20').toUpperCase().replace(/[\s-]/g, '_')])
  );
  const matchIds = [...matchFormatMap.keys()];
  const inningsList = await db.models.Innings.find({ match_id: { $in: matchIds } }).select('id match_id').lean();
  const inningsToMatch = new Map(inningsList.map(i => [i.id, i.match_id]));
  const inningsIds = inningsList.map(i => i.id);

  const [batters, bowlers] = await Promise.all([
    db.models.InningsBatter.find({ innings_id: { $in: inningsIds }, balls: { $gt: 0 } }).lean(),
    db.models.InningsBowler.find({ innings_id: { $in: inningsIds }, overs: { $gt: 0 } }).lean()
  ]);

  const byFormat = {};
  const ensureFmt = (fmt) => {
    if (!byFormat[fmt]) byFormat[fmt] = { runs: [], sr: [], econ: [], bpw: [] };
    return byFormat[fmt];
  };

  for (const b of batters) {
    const mId = b.match_id || inningsToMatch.get(b.innings_id);
    const fmt = matchFormatMap.get(mId) || 'T20';
    const bucket = ensureFmt(fmt);
    bucket.runs.push(Number(b.runs || 0));
    if (Number(b.balls || 0) >= 3) {
      bucket.sr.push((Number(b.runs || 0) / Number(b.balls)) * 100);
    }
  }

  for (const bw of bowlers) {
    const mId = bw.match_id || inningsToMatch.get(bw.innings_id);
    const fmt = matchFormatMap.get(mId) || 'T20';
    const bucket = ensureFmt(fmt);
    const balls = Number(bw.balls || 0) || Math.round(Number(bw.overs || 0) * 6);
    if (balls > 0) {
      bucket.econ.push((Number(bw.runs_conceded || 0) / balls) * 6);
      if (Number(bw.wickets || 0) > 0) {
        bucket.bpw.push(balls / Number(bw.wickets));
      }
    }
  }

  console.log('\n--- Suggested Benchmarks from Completed Matches ---');
  for (const [fmt, data] of Object.entries(byFormat)) {
    console.log(fmt, {
      sampleBatInnings: data.runs.length,
      sampleBowlSpells: data.econ.length,
      parRuns: median(data.runs)?.toFixed(1) ?? 'N/A',
      parSR: median(data.sr)?.toFixed(1) ?? 'N/A',
      parEconomy: median(data.econ)?.toFixed(2) ?? 'N/A',
      parBallsPerWicket: median(data.bpw)?.toFixed(1) ?? 'N/A'
    });
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

