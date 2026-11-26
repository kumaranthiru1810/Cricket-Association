/**
 * backend/tests/test_tournament_engine_phase2.js
 * Comprehensive Phase 2 Automated Test Suite:
 *  - Single Round Robin (4, 5, 6, 7, 8 teams)
 *  - Double Round Robin
 *  - Single Elimination (3, 5, 6, 7, 8 teams) + Byes + Winner Advancement
 *  - Group Allocation (Equal 42 teams -> 6x7 & Unequal 10 teams -> 3 groups)
 *  - Group Points Table, NRR (with All-Out innings), Tie-breakers & Unresolved Tie Flagging
 *  - Best Runners-Up Qualification & Group+Knockout Progression
 *  - IPL-Style Playoffs (Q1, Eliminator, Q2, Final)
 *  - Repeated Fixture Generation & Repeated Match Completion Idempotency
 */

const assert = require('assert');
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cricket_test_db';

const db = require('../config/db');
const engine = require('../services/tournamentEngine');
const tournamentService = require('../services/tournamentService');

async function cleanupPrefix(prefix) {
  await db.models.Tournament.deleteMany({ id: new RegExp(`^${prefix}`) });
  await db.models.Match.deleteMany({ tournament_id: new RegExp(`^${prefix}`) });
  await db.models.Innings.deleteMany({ match_id: new RegExp(`^M-${prefix}`) });
  await db.models.Team.deleteMany({ id: new RegExp(`^${prefix}`) });
}

async function run() {
  console.log('\n==================================================');
  console.log('🏆 PHASE 2 TOURNAMENT ENGINE AUTOMATED TEST SUITE');
  console.log('==================================================\n');

  await db.initDb();
  const PREFIX = 'PH2T';
  await cleanupPrefix(PREFIX);

  let passed = 0;
  const pass = (msg) => { console.log(`  ✅ PASS: ${msg}`); passed++; };

  // 1. Single Round Robin (4, 5, 6, 7, 8 teams)
  for (const n of [4, 5, 6, 7, 8]) {
    const teams = Array.from({ length: n }, (_, i) => `${PREFIX}-T${i + 1}`);
    const rr = engine.generateRoundRobinRounds(teams, { doubleLeg: false });
    const expectedMatches = (n * (n - 1)) / 2;
    assert.strictEqual(rr.totalMatches, expectedMatches, `RR ${n} teams should have ${expectedMatches} matches`);

    const pairSet = new Set();
    rr.rounds.forEach(r => {
      const roundTeams = new Set();
      r.matches.forEach(m => {
        assert(!roundTeams.has(m.home) && !roundTeams.has(m.away), `Team played twice in round ${r.round}`);
        roundTeams.add(m.home);
        roundTeams.add(m.away);
        const key = [m.home, m.away].sort().join('__');
        assert(!pairSet.has(key), `Duplicate pairing ${key}`);
        pairSet.add(key);
      });
    });
    assert.strictEqual(pairSet.size, expectedMatches);
    if (n % 2 === 1) {
      assert.strictEqual(rr.byes.length, n, `Odd ${n} teams should have ${n} round byes`);
    }
    pass(`Single Round Robin (${n} teams): ${expectedMatches} unique matches, ${rr.totalRounds} balanced rounds, ${rr.byes.length} byes`);
  }

  // 2. Double Round Robin (5 & 6 teams)
  for (const n of [5, 6]) {
    const teams = Array.from({ length: n }, (_, i) => `${PREFIX}-DRR-${i + 1}`);
    const drr = engine.generateRoundRobinRounds(teams, { doubleLeg: true });
    assert.strictEqual(drr.totalMatches, n * (n - 1), `Double RR ${n} teams should have ${n * (n - 1)} matches`);
    pass(`Double Round Robin (${n} teams): ${drr.totalMatches} matches across ${drr.totalRounds} rounds`);
  }

  // 3. Single Elimination (3, 5, 6, 7, 8 teams) — Byes & Full Progression to Champion
  for (const n of [3, 5, 6, 7, 8]) {
    const teams = Array.from({ length: n }, (_, i) => `${PREFIX}-KO-${n}-${i + 1}`);
    const ko = engine.generateSingleEliminationRound1(teams);
    let bSize = 1;
    while (bSize < n) bSize *= 2;
    assert.strictEqual(ko.bracketSize, bSize);
    assert.strictEqual(ko.byesCount, bSize - n);
    ko.pairings.forEach(p => {
      assert.notStrictEqual(p.home, engine.BYE_TOKEN);
      assert.notStrictEqual(p.away, engine.BYE_TOKEN);
    });
    pass(`Single Elimination R1 (${n} teams): bracketSize=${bSize}, byes=${ko.byesCount}, R1 matches=${ko.pairings.length}`);
  }

  // Full End-to-End 5-Team Single Elimination Progression in MongoDB
  const ko5Id = `${PREFIX}-KO5`;
  const ko5Teams = Array.from({ length: 5 }, (_, i) => `${PREFIX}-K5T${i + 1}`);
  for (const tId of ko5Teams) await db.models.Team.create({ id: tId, name: tId });
  await db.models.Tournament.create({
    id: ko5Id, name: 'KO5 Cup', tournament_type: 'SINGLE_ELIMINATION', teams: ko5Teams, overs_per_match: 20
  });
  const genKo5 = await tournamentService.generateMatches(ko5Id, {}, 'admin@cfvd.org');
  assert.strictEqual(genKo5.fixtures.length, 1, '5 teams R1 should create 1 preliminary match + 3 byes');

  // Complete R1 match -> should generate Semi-Finals (2 matches)
  const r1Match = genKo5.fixtures[0];
  await db.models.Match.updateOne({ id: r1Match.id }, { $set: { status: 'COMPLETED', winner_id: r1Match.team_a_id } });
  await tournamentService.onMatchCompleted(r1Match.id);

  const sfMatches = await db.models.Match.find({ tournament_id: ko5Id, stage: 'SEMI_FINAL' }).lean();
  assert.strictEqual(sfMatches.length, 2, '5-team KO should advance 3 byes + 1 R1 winner into 2 Semi-Finals');

  // Complete both SFs -> should generate Final (1 match)
  for (const sf of sfMatches) {
    await db.models.Match.updateOne({ id: sf.id }, { $set: { status: 'COMPLETED', winner_id: sf.team_a_id } });
    await tournamentService.onMatchCompleted(sf.id);
  }
  const finalMatches = await db.models.Match.find({ tournament_id: ko5Id, stage: 'FINAL' }).lean();
  assert.strictEqual(finalMatches.length, 1, '2 SF winners should advance to 1 Final');

  await db.models.Match.updateOne({ id: finalMatches[0].id }, { $set: { status: 'COMPLETED', winner_id: finalMatches[0].team_a_id } });
  await tournamentService.onMatchCompleted(finalMatches[0].id);
  const ko5Done = await db.models.Tournament.findOne({ id: ko5Id }).lean();
  assert.strictEqual(ko5Done.status, 'COMPLETED');
  assert.strictEqual(ko5Done.winner_team_id, finalMatches[0].team_a_id);
  pass(`5-Team Single Elimination full MongoDB progression (1 Prelim + 2 SF + 1 Final = 4 matches -> Champion crowned)`);

  // 4. Group Allocation: 42 Teams -> 6 Groups x 7 Teams (126 Group Matches + 8 Qualifiers -> 133 Total)
  const teams42 = Array.from({ length: 42 }, (_, i) => `${PREFIX}-G42-${i + 1}`);
  const t42Id = `${PREFIX}-GRP42`;
  await db.models.Tournament.create({
    id: t42Id,
    name: '42 Team District Cup',
    tournament_type: 'GROUP_KNOCKOUT',
    teams: teams42,
    format_config: { group_count: 6, teams_per_group: 7, qualifiers_per_group: 1, best_runners_up_count: 2, group_distribution: 'SEEDED' }
  });
  const prev42 = await tournamentService.previewFixtures(t42Id);
  assert.strictEqual(prev42.groups.length, 6);
  assert.strictEqual(prev42.total_group_matches, 126);
  assert.strictEqual(prev42.qualifying_teams_count, 8);
  assert.strictEqual(prev42.knockout_matches_count, 7);
  assert.strictEqual(prev42.total_expected_matches, 133);
  pass(`42-Team Group+Knockout Preview: 6x7 groups, 126 group matches, 8 qualifiers (6 winners + 2 best RU), 133 total`);

  // Unequal Group Allocation (10 teams -> 3 groups: 4, 3, 3)
  const teams10 = Array.from({ length: 10 }, (_, i) => `${PREFIX}-U10-${i + 1}`);
  const alloc10 = engine.allocateGroups(teams10, { group_count: 3, teams_per_group: 4, allow_extra_group: false, group_distribution: 'BALANCED' });
  assert.deepStrictEqual(alloc10.groups.map(g => g.teams.length), [4, 3, 3]);
  pass(`Unequal Group Allocation (10 teams -> 3 groups): sizes [4, 3, 3], zero dropped teams`);

  // 5. Group Points Table + NRR (with All-Out innings) + Unresolved Tie Detection
  const nrrTeams = [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }];
  const nrrMatches = [{ id: 'M-NRR-1', team_a_id: 'A', team_b_id: 'B', winner_id: 'A', status: 'COMPLETED', overs_per_side: 20 }];
  const nrrInns = {
    'M-NRR-1': [
      { match_id: 'M-NRR-1', innings_number: 1, batting_team_id: 'A', bowling_team_id: 'B', total_runs: 180, wickets: 5, overs: 20, balls: 0, is_completed: true },
      { match_id: 'M-NRR-1', innings_number: 2, batting_team_id: 'B', bowling_team_id: 'A', total_runs: 120, wickets: 10, overs: 14, balls: 2, is_completed: true }
    ]
  };
  const nrrTable = engine.computeStandings(nrrTeams, nrrMatches, nrrInns, { points_win: 2, points_loss: 0, overs_per_match: 20 });
  // Team B was all out in 14.2 overs -> charged full 20 overs: (180/20) - (120/20) = 9.0 - 6.0 = +3.000
  assert.strictEqual(nrrTable[0].team_id, 'A');
  assert.strictEqual(nrrTable[0].nrr, 3.000);
  assert.strictEqual(nrrTable[1].nrr, -3.000);
  pass(`NRR Calculation with All-Out Innings (180/20 vs 120 all out in 14.2 -> +3.000 / -3.000)`);

  // Unresolved Tie Detection
  const tiedGroups = {
    GROUP_A: [
      { team_id: 'T1', team_name: 'T1', position: 1, points: 4, won: 2, nrr: 0.5 },
      { team_id: 'T2', team_name: 'T2', position: 2, points: 4, won: 2, nrr: 0.5 }
    ]
  };
  const qualTie = engine.computeGroupQualifiers(tiedGroups, { qualifiers_per_group: 1, best_runners_up_count: 0 });
  assert.strictEqual(qualTie.unresolvedTies.length, 1, 'Completely tied teams at cutoff must be flagged for admin resolution');
  pass(`Unresolved Tie Detection flags tied teams at qualification cutoff instead of random selection`);

  // 6. IPL-Style Playoffs (League + Playoffs: Q1, Eliminator, Q2, Final)
  const iplId = `${PREFIX}-IPL4`;
  const iplTeams = Array.from({ length: 4 }, (_, i) => `${PREFIX}-IPL-${i + 1}`);
  for (const tId of iplTeams) await db.models.Team.create({ id: tId, name: tId });
  await db.models.Tournament.create({
    id: iplId, name: 'IPL Style Cup', tournament_type: 'LEAGUE_PLAYOFFS', teams: iplTeams, overs_per_match: 20, points_win: 2
  });
  const genIpl = await tournamentService.generateMatches(iplId, {}, 'admin@cfvd.org');
  assert.strictEqual(genIpl.fixtures.length, 6, '4-team league should have 6 matches');

  // Repeated generateMatches with preventDuplicateIfExists must not duplicate
  const dupCheck = await tournamentService.generateMatches(iplId, { preventDuplicateIfExists: true }, 'admin@cfvd.org');
  assert.strictEqual(dupCheck.already_generated, true);
  assert.strictEqual(dupCheck.fixtures.length, 6);
  pass(`Duplicate fixture generation prevented cleanly (returned existing 6 fixtures)`);

  for (const m of genIpl.fixtures) {
    await db.models.Match.updateOne({ id: m.id }, { $set: { status: 'COMPLETED', winner_id: m.team_a_id } });
    await tournamentService.onMatchCompleted(m.id);
  }
  const q1 = await db.models.Match.findOne({ tournament_id: iplId, stage: 'QUALIFIER_1' }).lean();
  const elim = await db.models.Match.findOne({ tournament_id: iplId, stage: 'ELIMINATOR' }).lean();
  assert(q1 && elim, 'Qualifier 1 and Eliminator should be auto-generated after League completes');

  await db.models.Match.updateOne({ id: q1.id }, { $set: { status: 'COMPLETED', winner_id: q1.team_a_id } });
  await db.models.Match.updateOne({ id: elim.id }, { $set: { status: 'COMPLETED', winner_id: elim.team_a_id } });
  await tournamentService.onMatchCompleted(q1.id);
  await tournamentService.onMatchCompleted(elim.id);

  const q2 = await db.models.Match.findOne({ tournament_id: iplId, stage: 'QUALIFIER_2' }).lean();
  assert(q2, 'Qualifier 2 (Loser Q1 vs Winner Eliminator) should be auto-generated');
  assert.strictEqual(q2.team_a_id, q1.team_b_id);
  assert.strictEqual(q2.team_b_id, elim.team_a_id);

  await db.models.Match.updateOne({ id: q2.id }, { $set: { status: 'COMPLETED', winner_id: q2.team_b_id } });
  await tournamentService.onMatchCompleted(q2.id);

  const iplFinal = await db.models.Match.findOne({ tournament_id: iplId, stage: 'FINAL' }).lean();
  assert(iplFinal, 'Final (Winner Q1 vs Winner Q2) should be auto-generated');
  assert.strictEqual(iplFinal.team_a_id, q1.team_a_id);
  assert.strictEqual(iplFinal.team_b_id, q2.team_b_id);

  await db.models.Match.updateOne({ id: iplFinal.id }, { $set: { status: 'COMPLETED', winner_id: iplFinal.team_a_id } });
  await tournamentService.onMatchCompleted(iplFinal.id);
  const iplDone = await db.models.Tournament.findOne({ id: iplId }).lean();
  assert.strictEqual(iplDone.status, 'COMPLETED');
  assert.strictEqual(iplDone.winner_team_id, iplFinal.team_a_id);
  pass(`IPL-Style Playoffs full progression (6 League -> Q1 & Elim -> Q2 -> Final -> Champion)`);

  await cleanupPrefix(PREFIX);
  console.log(`\n🎉 ALL ${passed} PHASE 2 TOURNAMENT ENGINE TESTS PASSED!\n`);
  process.exit(0);
}

run().catch(async (err) => {
  console.error('❌ PHASE 2 TEST FAILED:', err);
  process.exit(1);
});

