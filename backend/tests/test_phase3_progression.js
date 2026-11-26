
/**
 * Phase 3 End-to-End Test Suite: Match Completion, Points/NRR,
 * Automatic Progression, Concurrency, Idempotency & Result Correction.
 * Runs strictly against cricket_test_db (NODE_ENV=test).
 */
process.env.NODE_ENV = 'test';

const assert = require('assert');
const mongoose = require('mongoose');
const db = require('../config/db');
const tournamentService = require('../services/tournamentService');
const scoringEngine = require('../services/scoringEngine');

let passed = 0;
let failed = 0;

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

async function seedCompletedInningsForMatch(match, winnerId, loserId, winRuns = 160, loseRuns = 120) {
  await db.models.Innings.deleteMany({ match_id: match.id });
  const batFirst = winnerId;
  const batSecond = loserId;
  await db.models.Innings.create([
    {
      id: `INN-${match.id}-1`,
      match_id: match.id,
      innings_number: 1,
      batting_team_id: batFirst,
      bowling_team_id: batSecond,
      total_runs: winRuns,
      wickets: 4,
      overs: 20,
      balls: 0,
      is_completed: true,
      status: 'COMPLETED'
    },
    {
      id: `INN-${match.id}-2`,
      match_id: match.id,
      innings_number: 2,
      batting_team_id: batSecond,
      bowling_team_id: batFirst,
      total_runs: loseRuns,
      wickets: 10,
      overs: 18,
      balls: 0,
      is_completed: true,
      status: 'COMPLETED'
    }
  ]);
}

async function runTests() {
  console.log('\n==================================================');
  console.log('🏆 PHASE 3 END-TO-END MATCH COMPLETION & PROGRESSION');
  console.log('==================================================\n');

  await db.initDb();
  assert(mongoose.connection.name === 'cricket_test_db', `Expected cricket_test_db, got ${mongoose.connection.name}`);

  // Clean previous Phase 3 test artifacts
  const prefixes = ['P3GK', 'P3LP', 'P3SE', 'P3TIE', 'P3COR'];
  for (const px of prefixes) {
    await db.models.Tournament.deleteMany({ id: new RegExp(`^TOUR-${px}`) });
    await db.models.Match.deleteMany({ tournament_id: new RegExp(`^TOUR-${px}`) });
    await db.models.Team.deleteMany({ id: new RegExp(`^${px}-T`) });
  }

  // ── TEST A: Group + Knockout ───────────────────────────────────────────
  const gkTeams = await seedTeams('P3GK', 6);
  const gkTour = await tournamentService.createTournament({
    id: 'TOUR-P3GK-1',
    name: 'Phase 3 Group Knockout Cup',
    short_name: 'P3GKC',
    tournament_type: 'GROUP_KNOCKOUT',
    match_format: 'T20',
    overs_per_match: 20,
    teams: gkTeams,
    format_config: {
      group_count: 2,
      teams_per_group: 4,
      qualifiers_per_group: 1,
      best_runners_up_count: 0,
      group_distribution: 'BALANCED'
    }
  });
  const gkGen = await tournamentService.generateMatches(gkTour.id, {
    tournament_type: 'GROUP_KNOCKOUT',
    round_robin_type: 'SINGLE'
  });
  assert.strictEqual(gkGen.total_matches_generated, 6, 'Expected 6 group matches');

  // Complete all 6 group matches: T1 wins Group A, T2 wins Group B
  const gkMatches = await db.models.Match.find({ tournament_id: gkTour.id }).sort({ fixture_seq: 1 }).lean();
  for (const m of gkMatches) {
    const prefWinner = (m.team_a_id === 'P3GK-T1' || m.team_b_id === 'P3GK-T1')
      ? 'P3GK-T1'
      : (m.team_a_id === 'P3GK-T2' || m.team_b_id === 'P3GK-T2')
        ? 'P3GK-T2'
        : m.team_a_id;
    const loser = prefWinner === m.team_a_id ? m.team_b_id : m.team_a_id;
    await seedCompletedInningsForMatch(m, prefWinner, loser, 170, 130);
    await scoringEngine.endMatch(m.id, {
      winnerId: prefWinner,
      resultText: `${prefWinner} won by 40 runs`
    });
  }

  const gkPoints = await tournamentService.getGroupPointsTables(gkTour.id);
  assert.strictEqual(gkPoints.qualifiers.length, 2, 'Expected 2 qualifiers from 2 groups');
  const koMatches = await db.models.Match.find({
    tournament_id: gkTour.id,
    stage: { $not: /^GROUP_/ }
  }).lean();
  assert.strictEqual(koMatches.length, 1, 'Expected 1 Knockout Final generated automatically');
  const koTeams = new Set([koMatches[0].team_a_id, koMatches[0].team_b_id]);
  assert(koTeams.has('P3GK-T1') && koTeams.has('P3GK-T2'), 'Knockout Final should pair Group A & Group B winners');

  await seedCompletedInningsForMatch(koMatches[0], 'P3GK-T1', 'P3GK-T2', 180, 150);
  await scoringEngine.endMatch(koMatches[0].id, { winnerId: 'P3GK-T1', resultText: 'P3GK-T1 won Final' });
  const gkDone = await db.models.Tournament.findOne({ id: gkTour.id }).lean();
  assert.strictEqual(gkDone.status, 'COMPLETED', 'Group+KO tournament should be COMPLETED');
  assert.strictEqual(gkDone.winner_team_id, 'P3GK-T1', 'P3GK-T1 should be crowned Champion');
  ok('Test A: Group + Knockout end-to-end progression & champion');

  // ── TEST B: League + IPL Playoffs ──────────────────────────────────────
  const lpTeams = await seedTeams('P3LP', 4);
  const lpTour = await tournamentService.createTournament({
    id: 'TOUR-P3LP-1',
    name: 'Phase 3 IPL Playoffs Cup',
    short_name: 'P3LPC',
    tournament_type: 'LEAGUE_PLAYOFFS',
    match_format: 'T20',
    overs_per_match: 20,
    teams: lpTeams
  });
  const lpGen = await tournamentService.generateMatches(lpTour.id, {
    tournament_type: 'LEAGUE_PLAYOFFS',
    round_robin_type: 'SINGLE'
  });
  assert.strictEqual(lpGen.total_matches_generated, 6, 'Expected 6 league matches');
  const lpMatches = await db.models.Match.find({ tournament_id: lpTour.id }).sort({ fixture_seq: 1 }).lean();
  // Rank order: T1 (3W) > T2 (2W) > T3 (1W) > T4 (0W)
  const rankMap = { 'P3LP-T1': 1, 'P3LP-T2': 2, 'P3LP-T3': 3, 'P3LP-T4': 4 };
  for (const m of lpMatches) {
    const w = rankMap[m.team_a_id] < rankMap[m.team_b_id] ? m.team_a_id : m.team_b_id;
    const l = w === m.team_a_id ? m.team_b_id : m.team_a_id;
    await seedCompletedInningsForMatch(m, w, l, 165, 140);
    await scoringEngine.endMatch(m.id, { winnerId: w, resultText: `${w} won` });
  }
  const q1 = await db.models.Match.findOne({ tournament_id: lpTour.id, stage: 'QUALIFIER_1' }).lean();
  const elim = await db.models.Match.findOne({ tournament_id: lpTour.id, stage: 'ELIMINATOR' }).lean();
  assert(q1 && elim, 'Qualifier 1 and Eliminator should be generated automatically');
  assert(new Set([q1.team_a_id, q1.team_b_id]).has('P3LP-T1') && new Set([q1.team_a_id, q1.team_b_id]).has('P3LP-T2'));
  assert(new Set([elim.team_a_id, elim.team_b_id]).has('P3LP-T3') && new Set([elim.team_a_id, elim.team_b_id]).has('P3LP-T4'));

  // Complete Q1 (T1 beats T2) and Eliminator (T3 beats T4) -> Q2 = T2 vs T3
  await scoringEngine.endMatch(q1.id, { winnerId: 'P3LP-T1', resultText: 'T1 won Q1' });
  await scoringEngine.endMatch(elim.id, { winnerId: 'P3LP-T3', resultText: 'T3 won Elim' });
  const q2 = await db.models.Match.findOne({ tournament_id: lpTour.id, stage: 'QUALIFIER_2' }).lean();
  assert(q2, 'Qualifier 2 should be generated automatically');
  assert(new Set([q2.team_a_id, q2.team_b_id]).has('P3LP-T2') && new Set([q2.team_a_id, q2.team_b_id]).has('P3LP-T3'));

  // Complete Q2 (T2 beats T3) -> Final = T1 vs T2
  await scoringEngine.endMatch(q2.id, { winnerId: 'P3LP-T2', resultText: 'T2 won Q2' });
  const lpFinal = await db.models.Match.findOne({ tournament_id: lpTour.id, stage: 'FINAL' }).lean();
  assert(lpFinal, 'Grand Final should be generated automatically');
  assert(new Set([lpFinal.team_a_id, lpFinal.team_b_id]).has('P3LP-T1') && new Set([lpFinal.team_a_id, lpFinal.team_b_id]).has('P3LP-T2'));

  await scoringEngine.endMatch(lpFinal.id, { winnerId: 'P3LP-T1', resultText: 'T1 won Final' });
  const lpDone = await db.models.Tournament.findOne({ id: lpTour.id }).lean();
  assert.strictEqual(lpDone.winner_team_id, 'P3LP-T1');
  ok('Test B: League + IPL Playoffs full progression (Q1, Elim -> Q2 -> Final -> Champion)');

  // ── TEST C: Single Elimination (5 teams, 3 byes) ───────────────────────
  const seTeams = await seedTeams('P3SE', 5);
  const seTour = await tournamentService.createTournament({
    id: 'TOUR-P3SE-1',
    name: 'Phase 3 Single Elim',
    short_name: 'P3SE',
    tournament_type: 'SINGLE_ELIMINATION',
    match_format: 'T20',
    overs_per_match: 20,
    teams: seTeams
  });
  const seGen = await tournamentService.generateMatches(seTour.id, { tournament_type: 'SINGLE_ELIMINATION' });
  assert.strictEqual(seGen.total_matches_generated, 1, '5 teams -> 1 prelim match, 3 byes');
  const seR1 = await db.models.Match.find({ tournament_id: seTour.id, round_number: 1 }).lean();
  await scoringEngine.endMatch(seR1[0].id, { winnerId: seR1[0].team_a_id, resultText: 'Prelim won' });
  const seR2 = await db.models.Match.find({ tournament_id: seTour.id, round_number: 2 }).lean();
  assert.strictEqual(seR2.length, 2, '2 Semi-Finals should be generated');
  for (const sf of seR2) {
    await scoringEngine.endMatch(sf.id, { winnerId: sf.team_a_id, resultText: 'SF won' });
  }
  const seR3 = await db.models.Match.find({ tournament_id: seTour.id, round_number: 3 }).lean();
  assert.strictEqual(seR3.length, 1, '1 Final should be generated');
  await scoringEngine.endMatch(seR3[0].id, { winnerId: seR3[0].team_a_id, resultText: 'Final won' });
  const seDone = await db.models.Tournament.findOne({ id: seTour.id }).lean();
  assert.strictEqual(seDone.status, 'COMPLETED');
  ok('Test C: Single Elimination (5 teams, 3 byes) full progression');

  // ── TEST D & E: Duplicate & Concurrent Submission ──────────────────────
  const dupBefore = await db.models.Team.findOne({ id: 'P3GK-T1' }).lean();
  const dupRes = await scoringEngine.endMatch(koMatches[0].id, { winnerId: 'P3GK-T1' });
  assert.strictEqual(dupRes.alreadyCompleted, true, 'Duplicate endMatch should return alreadyCompleted: true');
  const dupAfter = await db.models.Team.findOne({ id: 'P3GK-T1' }).lean();
  assert.strictEqual(dupAfter.stats.matches, dupBefore.stats.matches, 'Team stats must not increment twice on duplicate endMatch');
  ok('Test D: Duplicate submission prevented idempotently');

  // Concurrent endMatch on a fresh match
  const corTeams = await seedTeams('P3COR', 4);
  const corTour = await tournamentService.createTournament({
    id: 'TOUR-P3COR-1',
    name: 'Phase 3 Concurrency & Correction',
    short_name: 'P3CC',
    tournament_type: 'SINGLE_ELIMINATION',
    match_format: 'T20',
    overs_per_match: 20,
    teams: corTeams
  });
  await tournamentService.generateMatches(corTour.id, { tournament_type: 'SINGLE_ELIMINATION' });
  const corR1 = await db.models.Match.find({ tournament_id: corTour.id, round_number: 1 }).sort({ fixture_seq: 1 }).lean();
  const [c1, c2] = await Promise.all([
    scoringEngine.endMatch(corR1[0].id, { winnerId: corR1[0].team_a_id, resultText: 'Won' }),
    scoringEngine.endMatch(corR1[0].id, { winnerId: corR1[0].team_a_id, resultText: 'Won' })
  ]);
  assert(c1.success && c2.success);
  const tCorA = await db.models.Team.findOne({ id: corR1[0].team_a_id }).lean();
  assert.strictEqual(tCorA.stats.matches, 1, 'Concurrent submission must count match exactly once');
  ok('Test E: Concurrent submission processed atomically (1 count)');

  // ── TEST F: Tie Resolution ─────────────────────────────────────────────
  const tieTeams = await seedTeams('P3TIE', 4);
  const tieTour = await tournamentService.createTournament({
    id: 'TOUR-P3TIE-1',
    name: 'Phase 3 Tie Resolution',
    short_name: 'P3TR',
    tournament_type: 'GROUP_KNOCKOUT',
    match_format: 'T20',
    overs_per_match: 20,
    teams: tieTeams,
    format_config: { group_count: 1, teams_per_group: 4, qualifiers_per_group: 2, best_runners_up_count: 0 }
  });
  await tournamentService.generateMatches(tieTour.id, { tournament_type: 'GROUP_KNOCKOUT', round_robin_type: 'SINGLE' });
  const tieMatches = await db.models.Match.find({ tournament_id: tieTour.id }).lean();
  for (const tm of tieMatches) {
    await scoringEngine.endMatch(tm.id, { winnerId: 'TIE', resultText: 'Match Tied' });
  }
  const tieKO = await db.models.Match.find({ tournament_id: tieTour.id, stage: { $not: /^GROUP_/ } }).lean();
  assert.strictEqual(tieKO.length, 0, 'Unresolved tie must block automatic KO generation');
  await tournamentService.resolveTie(tieTour.id, tieTeams, 'admin@cfvd.org');
  const tieKOAfter = await db.models.Match.find({ tournament_id: tieTour.id, stage: { $not: /^GROUP_/ } }).lean();
  assert.strictEqual(tieKOAfter.length, 1, 'Admin resolveTie should unblock and generate Final');
  ok('Test F: Unresolved tie blocked auto-advancement and resolved via Admin');

  // ── TEST G: Result Correction & Downstream Conflict Guard ──────────────
  // Correct corR1[0] winner from team_a_id to team_b_id (no downstream started yet)
  await scoringEngine.correctMatchResult(corR1[0].id, {
    winnerId: corR1[0].team_b_id,
    resultText: 'Corrected winner'
  });
  const tA_afterCor = await db.models.Team.findOne({ id: corR1[0].team_a_id }).lean();
  const tB_afterCor = await db.models.Team.findOne({ id: corR1[0].team_b_id }).lean();
  assert.strictEqual(tA_afterCor.stats.won, 0, 'Old winner won count reverted to 0');
  assert.strictEqual(tA_afterCor.stats.lost, 1, 'Old winner lost count updated to 1');
  assert.strictEqual(tB_afterCor.stats.won, 1, 'New winner won count updated to 1');

  // Complete corR1[1] -> generates Round 2 Final, start Final (LIVE), then verify correction is blocked with 409
  await scoringEngine.endMatch(corR1[1].id, { winnerId: corR1[1].team_a_id, resultText: 'SF2 won' });
  const corFinal = await db.models.Match.findOne({ tournament_id: corTour.id, round_number: 2 }).lean();
  assert(corFinal, 'Round 2 Final should be generated');
  await db.models.Match.updateOne({ id: corFinal.id }, { $set: { status: 'LIVE' } });
  let blocked409 = false;
  try {
    await scoringEngine.correctMatchResult(corR1[0].id, { winnerId: corR1[0].team_a_id, resultText: 'Should fail' });
  } catch (err) {
    if (err.status === 409 && err.code === 'DOWNSTREAM_STAGE_ACTIVE') blocked409 = true;
  }
  assert(blocked409, 'Correction must be blocked with 409 DOWNSTREAM_STAGE_ACTIVE when Final is LIVE');
  ok('Test G: Result correction reverts/recalculates stats safely and blocks when downstream stage is active');

  console.log(`\n🎉 PHASE 3 E2E SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED\n`);
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ PHASE 3 TEST FAILED:', err);
  process.exit(1);
});
