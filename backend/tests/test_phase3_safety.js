/**
 * Phase 3 Final Safety Audit Suite:
 * 1. Failure Recovery (after claim, after Team stats, after Player stats, during stage progression, after fixture insert)
 * 2. Result Correction (group-stage correction, points/NRR recalc, qualification recalc, unstarted downstream cleanup, active downstream 409 block, AuditLog)
 * Runs strictly against cricket_test_db (NODE_ENV=test).
 */
process.env.NODE_ENV = 'test';

const assert = require('assert');
const mongoose = require('mongoose');
const db = require('../config/db');
const tournamentService = require('../services/tournamentService');
const scoringEngine = require('../services/scoringEngine');

let passed = 0;

function ok(label) {
  console.log(`  ✅ PASS: ${label}`);
  passed++;
}

async function seedTeams(prefix, count) {
  const ids = [];
  for (let i = 1; i <= count; i++) {
    const id = `${prefix}-T${i}`;
    ids.push(id);
    await db.models.Team.findOneAndUpdate(
      { id },
      {
        $set: {
          id,
          name: `${prefix} Team ${i}`,
          short_name: `${prefix}${i}`,
          status: 'ACTIVE',
          stats: { matches: 0, won: 0, lost: 0, tied: 0, no_result: 0, win_percentage: 0 }
        }
      },
      { upsert: true, new: true }
    );
  }
  return ids;
}

async function seedInningsWithPlayer(match, winnerId, loserId, winRuns = 160, loseRuns = 120) {
  const pId = `PL-${winnerId}-1`;
  await db.models.Player.findOneAndUpdate(
    { id: pId },
    {
      $set: {
        id: pId,
        name: `Batter ${winnerId}`,
        team_id: winnerId,
        role: 'Batsman',
        stats: { matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, not_outs: 0, fifties: 0, hundreds: 0, highest_score: 0, wickets: 0, overs: 0, maidens: 0, runs_conceded: 0, potm_awards: 0 }
      }
    },
    { upsert: true, new: true }
  );
  await db.models.Innings.deleteMany({ match_id: match.id });
  const inn1Id = `INN-${match.id}-1`;
  const inn2Id = `INN-${match.id}-2`;
  await db.models.Innings.create([
    { id: inn1Id, match_id: match.id, innings_number: 1, batting_team_id: winnerId, bowling_team_id: loserId, total_runs: winRuns, wickets: 4, overs: 20, balls: 0, is_completed: true, status: 'COMPLETED' },
    { id: inn2Id, match_id: match.id, innings_number: 2, batting_team_id: loserId, bowling_team_id: winnerId, total_runs: loseRuns, wickets: 10, overs: 18, balls: 0, is_completed: true, status: 'COMPLETED' }
  ]);
  await db.models.InningsBatter.deleteMany({ innings_id: { $in: [inn1Id, inn2Id] } });
  await db.models.InningsBatter.create({
    id: `IB-${match.id}-1`,
    innings_id: inn1Id,
    player_id: pId,
    player_name: `Batter ${winnerId}`,
    runs: 55,
    balls: 35,
    fours: 6,
    sixes: 2,
    is_out: false
  });
  return pId;
}

async function runAudit() {
  console.log('\n==================================================');
  console.log('🛡️ PHASE 3 FAILURE RECOVERY & CORRECTION AUDIT');
  console.log('==================================================\n');

  await db.initDb();
  assert.strictEqual(mongoose.connection.name, 'cricket_test_db');

  for (const px of ['P3FR', 'P3RC']) {
    await db.models.Tournament.deleteMany({ id: new RegExp(`^TOUR-${px}`) });
    await db.models.Match.deleteMany({ tournament_id: new RegExp(`^TOUR-${px}`) });
    await db.models.Team.deleteMany({ id: new RegExp(`^${px}-T`) });
    await db.models.Player.deleteMany({ id: new RegExp(`^PL-${px}`) });
  }

  // ── 1. FAILURE RECOVERY TESTS ──────────────────────────────────────────
  const frTeams = await seedTeams('P3FR', 4);
  const frTour = await tournamentService.createTournament({
    id: 'TOUR-P3FR-1',
    name: 'Phase 3 Failure Recovery Cup',
    short_name: 'P3FR',
    tournament_type: 'SINGLE_ELIMINATION',
    match_format: 'T20',
    overs_per_match: 20,
    teams: frTeams
  });
  await tournamentService.generateMatches(frTour.id, { tournament_type: 'SINGLE_ELIMINATION' });
  const frMatches = await db.models.Match.find({ tournament_id: frTour.id, round_number: 1 }).sort({ fixture_seq: 1 }).lean();

  // 1a. Failure after Match stats processing is claimed (before Team stats)
  const m0 = frMatches[0];
  const pId0 = await seedInningsWithPlayer(m0, m0.team_a_id, m0.team_b_id);
  await db.models.Match.updateOne({ id: m0.id }, { $set: { status: 'COMPLETED', winner_id: m0.team_a_id, stats_processed: false, stats_processing_status: 'IDLE' } });
  const origTeamFind = db.models.Team.findOneAndUpdate.bind(db.models.Team);
  db.models.Team.findOneAndUpdate = async () => { throw new Error('SIMULATED_FAIL_AFTER_CLAIM'); };
  const fail1 = await tournamentService.onMatchCompleted(m0.id);
  db.models.Team.findOneAndUpdate = origTeamFind;
  assert.strictEqual(fail1.processed, false);
  const m0AfterFail1 = await db.models.Match.findOne({ id: m0.id }).lean();
  assert.strictEqual(m0AfterFail1.stats_processing_status, 'FAILED');
  ok('Failure 1: Failure after claim sets FAILED status cleanly');

  // 1b. Failure after Team stats update (before Player stats update) -> verify rollback + retry no double count
  const origBatterFind = db.models.InningsBatter.find.bind(db.models.InningsBatter);
  db.models.InningsBatter.find = () => ({ lean: async () => { throw new Error('SIMULATED_FAIL_AFTER_TEAM_STATS'); } });
  await tournamentService.onMatchCompleted(m0.id);
  db.models.InningsBatter.find = origBatterFind;
  const tAfterFail2 = await db.models.Team.findOne({ id: m0.team_a_id }).lean();
  assert.strictEqual(tAfterFail2.stats.matches, 0, 'Team stats must be rolled back on mid-rollup failure');

  // Now retry cleanly
  const retry1 = await tournamentService.onMatchCompleted(m0.id);
  assert.strictEqual(retry1.processed, true);
  const tAfterRetry1 = await db.models.Team.findOne({ id: m0.team_a_id }).lean();
  const pAfterRetry1 = await db.models.Player.findOne({ id: pId0 }).lean();
  assert.strictEqual(tAfterRetry1.stats.matches, 1, 'Retry counts team match exactly once');
  assert.strictEqual(pAfterRetry1.stats.runs, 55, 'Retry counts player runs exactly once');
  ok('Failure 2: Failure after Team stats rolled back cleanly; retry produces exact 1x stats');

  // 1c. Failure after Player stats update (before Match stats_processed=true)
  const m1 = frMatches[1];
  const pId1 = await seedInningsWithPlayer(m1, m1.team_a_id, m1.team_b_id);
  await db.models.Match.updateOne({ id: m1.id }, { $set: { status: 'COMPLETED', winner_id: m1.team_a_id, stats_processed: false, stats_processing_status: 'IDLE' } });
  const origMatchUpdateOne = db.models.Match.updateOne.bind(db.models.Match);
  let throwOnce = true;
  db.models.Match.updateOne = async (filter, update, ...rest) => {
    if (throwOnce && update?.$set?.stats_processed === true) {
      throwOnce = false;
      throw new Error('SIMULATED_FAIL_AFTER_PLAYER_STATS');
    }
    return origMatchUpdateOne(filter, update, ...rest);
  };
  await tournamentService.onMatchCompleted(m1.id);
  db.models.Match.updateOne = origMatchUpdateOne;
  const pAfterFail3 = await db.models.Player.findOne({ id: pId1 }).lean();
  assert.strictEqual(pAfterFail3.stats.runs, 0, 'Player stats rolled back when final Match mark fails');

  // 1d. Failure during tournament stage progression (advanceTournamentStage throws once)
  const origAdv = tournamentService.advanceTournamentStage.bind(tournamentService);
  let advThrowOnce = true;
  tournamentService.advanceTournamentStage = async (tid) => {
    if (advThrowOnce) {
      advThrowOnce = false;
      throw new Error('SIMULATED_FAIL_DURING_PROGRESSION');
    }
    return origAdv(tid);
  };
  await tournamentService.onMatchCompleted(m1.id);
  tournamentService.advanceTournamentStage = origAdv;
  // Stats were completed on m1, progression failed -> retry onMatchCompleted advances stage without duplicating stats!
  await tournamentService.onMatchCompleted(m1.id);
  const r2Matches = await db.models.Match.find({ tournament_id: frTour.id, round_number: 2 }).lean();
  assert.strictEqual(r2Matches.length, 1, 'Retry after progression failure creates exactly 1 Final');
  const tM1A = await db.models.Team.findOne({ id: m1.team_a_id }).lean();
  assert.strictEqual(tM1A.stats.matches, 1, 'Team stats still counted exactly once after progression retry');
  ok('Failure 3 & 4: Failure after Player stats & during progression recover with 0 duplicate stats/fixtures');

  // 1e. Failure after fixtures created before tournament status save -> retry does not duplicate fixtures
  await tournamentService.advanceTournamentStage(frTour.id);
  const r2AfterRetry = await db.models.Match.find({ tournament_id: frTour.id, round_number: 2 }).lean();
  assert.strictEqual(r2AfterRetry.length, 1, 'Re-running advanceTournamentStage never duplicates existing Final');
  ok('Failure 5: Stage progression retry does not duplicate fixtures');

  // ── 2. RESULT CORRECTION TESTS (Group Stage + Downstream Safety + AuditLog) ──
  const rcTeams = await seedTeams('P3RC', 4);
  const rcTour = await tournamentService.createTournament({
    id: 'TOUR-P3RC-1',
    name: 'Phase 3 Result Correction Cup',
    short_name: 'P3RC',
    tournament_type: 'GROUP_KNOCKOUT',
    match_format: 'T20',
    overs_per_match: 20,
    teams: rcTeams,
    format_config: { group_count: 1, teams_per_group: 4, qualifiers_per_group: 2, best_runners_up_count: 0 }
  });
  await tournamentService.generateMatches(rcTour.id, { tournament_type: 'GROUP_KNOCKOUT', round_robin_type: 'SINGLE' });
  const rcGroupMatches = await db.models.Match.find({ tournament_id: rcTour.id }).sort({ fixture_seq: 1 }).lean();
  assert.strictEqual(rcGroupMatches.length, 6);

  // Rank order initially: T1 > T2 > T3 > T4
  const initRank = { 'P3RC-T1': 1, 'P3RC-T2': 2, 'P3RC-T3': 3, 'P3RC-T4': 4 };
  for (const m of rcGroupMatches) {
    const w = initRank[m.team_a_id] < initRank[m.team_b_id] ? m.team_a_id : m.team_b_id;
    const l = w === m.team_a_id ? m.team_b_id : m.team_a_id;
    await seedInningsWithPlayer(m, w, l, 180, 120);
    await scoringEngine.endMatch(m.id, { winnerId: w, resultText: `${w} won by 60 runs` });
  }

  let rcKO = await db.models.Match.find({ tournament_id: rcTour.id, stage: { $not: /^GROUP_/ } }).lean();
  assert.strictEqual(rcKO.length, 1, 'Initial qualifiers T1 & T2 generated 1 Final');
  assert(new Set([rcKO[0].team_a_id, rcKO[0].team_b_id]).has('P3RC-T2'));

  // Now correct T2 vs T3 group match so T3 beats T2 (and T3 also gets higher NRR -> T3 overtakes T2 for #2 qualifier!)
  const t2VsT3 = rcGroupMatches.find(m =>
    (m.team_a_id === 'P3RC-T2' && m.team_b_id === 'P3RC-T3') ||
    (m.team_a_id === 'P3RC-T3' && m.team_b_id === 'P3RC-T2')
  );
  // Also correct T3 vs T1 so T3 has 2 wins and overtakes T2 cleanly
  const t1VsT3 = rcGroupMatches.find(m =>
    (m.team_a_id === 'P3RC-T1' && m.team_b_id === 'P3RC-T3') ||
    (m.team_a_id === 'P3RC-T3' && m.team_b_id === 'P3RC-T1')
  );
  await seedInningsWithPlayer(t2VsT3, 'P3RC-T3', 'P3RC-T2', 200, 100);
  await scoringEngine.correctMatchResult(t2VsT3.id, { winnerId: 'P3RC-T3', resultText: 'P3RC-T3 won by 100 runs' });

  await seedInningsWithPlayer(t1VsT3, 'P3RC-T3', 'P3RC-T1', 200, 100);
  await scoringEngine.correctMatchResult(t1VsT3.id, { winnerId: 'P3RC-T3', resultText: 'P3RC-T3 won by 100 runs' });

  const rcPoints = await tournamentService.getGroupPointsTables(rcTour.id);
  const groupA = rcPoints.groups.GROUP_A;
  const t3Row = groupA.find(r => r.team_id === 'P3RC-T3');
  const t2Row = groupA.find(r => r.team_id === 'P3RC-T2');
  assert.strictEqual(t3Row.won, 3, 'T3 wins recalculated to 3');
  assert.strictEqual(t2Row.won, 1, 'T2 wins recalculated to 1');
  assert(t3Row.nrr > t2Row.nrr, 'T3 NRR recalculated higher than T2');

  const qualIds = rcPoints.qualifiers.map(q => q.team_id);
  assert(qualIds.includes('P3RC-T3') && !qualIds.includes('P3RC-T2'), 'Qualification recalculated: T3 replaces T2');

  rcKO = await db.models.Match.find({ tournament_id: rcTour.id, stage: { $not: /^GROUP_/ } }).lean();
  assert.strictEqual(rcKO.length, 1, 'Old unstarted Final replaced safely with 1 updated Final');
  assert(new Set([rcKO[0].team_a_id, rcKO[0].team_b_id]).has('P3RC-T3'), 'Updated Final contains recalculated qualifier T3');

  const auditEntry = await db.models.AuditLog.findOne({ action: 'MATCH_COMPLETION_REVERTED', target_user: t2VsT3.id }).lean();
  assert(auditEntry, 'AuditLog must record MATCH_COMPLETION_REVERTED');
  ok('Result Correction: Group points, NRR, qualification, unstarted downstream Final & AuditLog verified');

  // Verify correction blocked when downstream Final is LIVE
  await db.models.Match.updateOne({ id: rcKO[0].id }, { $set: { status: 'LIVE' } });
  let blocked409 = false;
  try {
    await scoringEngine.correctMatchResult(t2VsT3.id, { winnerId: 'P3RC-T2', resultText: 'Should block' });
  } catch (err) {
    if (err.status === 409 && err.code === 'DOWNSTREAM_STAGE_ACTIVE') blocked409 = true;
  }
  assert(blocked409, 'Correction must be blocked with 409 DOWNSTREAM_STAGE_ACTIVE when downstream Final is LIVE');
  ok('Result Correction Guard: Blocked with 409 when downstream Final is active');

  console.log(`\n🎉 PHASE 3 SAFETY AUDIT COMPLETE: ${passed} PASSED, 0 FAILED\n`);
  process.exit(0);
}

runAudit().catch(err => {
  console.error('❌ SAFETY AUDIT FAILED:', err);
  process.exit(1);
});
