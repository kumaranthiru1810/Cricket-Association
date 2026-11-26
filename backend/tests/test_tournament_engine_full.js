/**
 * tests/test_tournament_engine_full.js
 * Comprehensive Test Suite for CFVD Tournament Engine, Double Elimination,
 * Group Management, Scheduling Conflicts, Progression, Recovery, History,
 * Withdrawal, Eligibility, What-If Simulation & Full E2E Integration.
 * Runs strictly against cricket_test_db (NODE_ENV=test).
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const db = require('../config/db');
const tournamentService = require('../services/tournamentService');
const tournamentEngine = require('../services/tournamentEngine');
const historyService = require('../services/historyService');
const matchService = require('../services/matchService');
const scoringEngine = require('../services/scoringEngine');
const adminService = require('../services/adminService');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message || JSON.stringify(err)}`);
    if (err.stack) console.error(`     ${err.stack.split('\n')[1]}`);
    failed++;
  }
}

function makeTeamIds(count, prefix = 'TE-TM') {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
}

async function seedTeams(teamIds) {
  for (const tid of teamIds) {
    await db.models.Team.findOneAndUpdate(
      { id: tid },
      {
        $setOnInsert: {
          id: tid,
          team_id: tid,
          name: `Team ${tid}`,
          short_name: tid.slice(-4),
          city: 'Virudhunagar',
          status: 'ACTIVE'
        }
      },
      { upsert: true }
    );
  }
}

async function completeMatchWithWinner(matchId, winnerId) {
  const m = await db.models.Match.findOne({ id: matchId });
  assert(m, `Match ${matchId} must exist`);
  const winnerName = winnerId === m.team_a_id ? m.team_a_name : m.team_b_name;
  m.status = 'COMPLETED';
  m.winner_id = winnerId;
  m.result_summary = `${winnerName} won by 5 wickets`;
  await m.save();
  await tournamentService.onMatchCompleted(m.id);
  return db.models.Match.findOne({ id: matchId }).lean();
}

async function runSuite() {
  console.log('\n==============================================================');
  console.log('🏆 RUNNING CFVD TOURNAMENT ENGINE & E2E INTEGRATION TEST SUITE');
  console.log('==============================================================\n');

  await db.initDb();

  // Clean only TE- prefixed test artifacts in cricket_test_db
  await db.models.Tournament.deleteMany({ id: /^TE-/ });
  await db.models.Match.deleteMany({ tournament_id: /^TE-/ });
  await db.models.Team.deleteMany({ id: /^TE-TM-/ });
  await db.models.Player.deleteMany({ id: /^TE-PL-/ });

  const teams40 = makeTeamIds(40, 'TE-TM');
  await seedTeams(teams40);

  // 1. Single Round Robin (5 teams - odd count with byes)
  await test('1. Single Round Robin (5 teams odd -> 10 matches, 5 rounds with 1 bye/round)', async () => {
    const t = await tournamentService.createTournament({
      id: 'TE-SRR-5',
      name: 'TE Single RR 5',
      tournament_type: 'LEAGUE',
      format_config: { round_robin_type: 'SINGLE' },
      teams: teams40.slice(0, 5),
      start_date: '2026-12-01',
      end_date: '2026-12-10'
    });
    const prev = await tournamentEngine.previewSchedule(t.id);
    assert.strictEqual(prev.fixtures.length, 10, '5 teams SRR = 10 matches');
    assert.strictEqual(prev.byes.length, 5, '5 rounds = 5 byes');
  });

  // 2. Double Round Robin (4 teams -> 12 matches)
  await test('2. Double Round Robin (4 teams -> 12 home & away matches)', async () => {
    const t = await tournamentService.createTournament({
      id: 'TE-DRR-4',
      name: 'TE Double RR 4',
      tournament_type: 'LEAGUE',
      format_config: { round_robin_type: 'DOUBLE' },
      teams: teams40.slice(0, 4),
      start_date: '2026-12-01',
      end_date: '2026-12-15'
    });
    const gen = await tournamentService.generateMatches(t.id, { ignoreConflicts: true }, 'admin@cfvd.org');
    assert.strictEqual(gen.total_matches_generated, 12);
  });

  // 3. Single Elimination (5 teams -> Byes + auto-advancement to Champion)
  await test('3. Single Elimination (5 teams -> power-of-2 byes & full progression to Champion)', async () => {
    const t = await tournamentService.createTournament({
      id: 'TE-SE-5',
      name: 'TE Single Elim 5',
      tournament_type: 'KNOCKOUT',
      teams: teams40.slice(0, 5),
      start_date: '2026-12-01',
      end_date: '2026-12-10'
    });
    const gen = await tournamentService.generateMatches(t.id, { ignoreConflicts: true }, 'admin@cfvd.org');
    assert.strictEqual(gen.bracket.bracket_size, 8);
    // Play all matches round by round until tournament COMPLETED
    for (let safety = 0; safety < 10; safety++) {
      const tour = await db.models.Tournament.findOne({ id: t.id }).lean();
      if (tour.status === 'COMPLETED') break;
      const pending = await db.models.Match.find({ tournament_id: t.id, status: 'SCHEDULED' }).lean();
      assert(pending.length > 0, 'Must have scheduled matches until champion crowned');
      for (const m of pending) {
        await completeMatchWithWinner(m.id, m.team_a_id);
      }
    }
    const finalTour = await db.models.Tournament.findOne({ id: t.id }).lean();
    assert.strictEqual(finalTour.status, 'COMPLETED');
    assert(finalTour.champion_team_id, 'Champion must be determined');
  });

  // 4. Double Elimination for 3, 5, 8, 12, 16 teams + Grand Final Reset
  for (const count of [3, 5, 8, 12, 16]) {
    await test(`4. Double Elimination (${count} teams) -> WB, LB, GF & Grand Final Reset`, async () => {
      const tid = `TE-DE-${count}`;
      await tournamentService.createTournament({
        id: tid,
        name: `TE Double Elim ${count}`,
        tournament_type: 'DOUBLE_ELIMINATION',
        teams: teams40.slice(0, count),
        start_date: '2026-12-01',
        end_date: '2026-12-20'
      });
      const gen = await tournamentService.generateMatches(tid, { ignoreConflicts: true }, 'admin@cfvd.org');
      assert.strictEqual(gen.bracket.format, 'DOUBLE_ELIMINATION');
      assert(gen.bracket.winners_rounds.length >= 2);
      assert(gen.bracket.losers_rounds.length >= 2);

      // Simulate entire Double Elimination tournament where LB champion ALWAYS wins GF-1 to force GF-RESET!
      let resetTriggered = false;
      for (let step = 0; step < 30; step++) {
        const tour = await db.models.Tournament.findOne({ id: tid }).lean();
        if (tour.status === 'COMPLETED') break;
        const pending = await db.models.Match.find({ tournament_id: tid, status: 'SCHEDULED' }).lean();
        if (pending.length === 0) break;
        for (const m of pending) {
          if (m.bracket_slot === 'GF-1') {
            // LB Champion is team_b_id -> let LB Champion win GF-1 to trigger GF-RESET!
            await completeMatchWithWinner(m.id, m.team_b_id);
            resetTriggered = true;
          } else {
            await completeMatchWithWinner(m.id, m.team_a_id);
          }
        }
      }
      const doneTour = await db.models.Tournament.findOne({ id: tid }).lean();
      assert.strictEqual(resetTriggered, true, 'GF-1 must have been reached and LB champion won');
      assert.strictEqual(doneTour.bracket.grand_final_reset.active, true, 'Grand Final Reset must activate');
      assert.strictEqual(doneTour.status, 'COMPLETED', `Double Elim ${count} must complete`);
      assert(doneTour.champion_team_id, `Double Elim ${count} must have champion`);
    });
  }

  // 5. Advanced Group Management (40->5x8, 40->4x10, 32->4x8, 24->6x4, 23->5,5,5,4,4)
  await test('5. Group Allocation: 40->5x8, 40->4x10, 32->4x8, 24->6x4, 23->(5,5,5,4,4) & Manual Move', async () => {
    const t40 = await tournamentService.createTournament({
      id: 'TE-GRP-40',
      name: 'TE Group 40',
      tournament_type: 'GROUP_KNOCKOUT',
      max_teams: 40,
      teams: teams40,
      start_date: '2026-12-01',
      end_date: '2026-12-30'
    });

    const r5x8 = await tournamentEngine.allocateGroups(t40.id, { numGroups: 5, mode: 'BALANCED' });
    assert.deepStrictEqual(r5x8.group_sizes, [8, 8, 8, 8, 8]);
    assert.strictEqual(r5x8.unassigned_teams.length, 0);

    const r4x10 = await tournamentEngine.allocateGroups(t40.id, { numGroups: 4, mode: 'SEEDED', seedOrder: teams40 });
    assert.deepStrictEqual(r4x10.group_sizes, [10, 10, 10, 10]);

    const r32 = await tournamentEngine.allocateGroups(t40.id, { teams: teams40.slice(0, 32), numGroups: 4, mode: 'BALANCED' });
    assert.deepStrictEqual(r32.group_sizes, [8, 8, 8, 8]);

    const r24 = await tournamentEngine.allocateGroups(t40.id, { teams: teams40.slice(0, 24), numGroups: 6, mode: 'RANDOM' });
    assert.deepStrictEqual(r24.group_sizes, [4, 4, 4, 4, 4, 4]);

    const r23 = await tournamentEngine.allocateGroups(t40.id, { teams: teams40.slice(0, 23), numGroups: 5, mode: 'BALANCED' });
    assert.deepStrictEqual(r23.group_sizes, [5, 5, 5, 4, 4]);
    assert.strictEqual(r23.balance_valid, true);

    // Manual move & duplicate prevention
    const movedTeam = r23.groups[0].teams[0];
    const moved = await tournamentEngine.moveTeamBetweenGroups(t40.id, movedTeam, r23.groups[0].id, r23.groups[4].id);
    const occurrences = moved.groups.flatMap(g => g.teams).filter(x => x === movedTeam).length;
    assert.strictEqual(occurrences, 1, 'Team must appear in exactly 1 group (no duplicates)');
    await tournamentEngine.confirmGroups(t40.id);
  });

  // 6. Schedule Conflict Detection
  await test('6. Schedule Conflict Detection (Venue double-booking & Same-team overlap)', async () => {
    const conflictsRes = await tournamentEngine.detectScheduleConflicts([
      { id: 'CF-1', team_a_id: 'TE-TM-01', team_b_id: 'TE-TM-02', venue: 'Main Ground', match_date: '2026-12-25', match_time: '09:30 AM' },
      { id: 'CF-2', team_a_id: 'TE-TM-01', team_b_id: 'TE-TM-03', venue: 'Main Ground', match_date: '2026-12-25', match_time: '10:00 AM' }
    ]);
    assert(conflictsRes.conflicts.some(c => c.type === 'VENUE_CONFLICT'), 'Must detect venue conflict');
    assert(conflictsRes.conflicts.some(c => c.type === 'TEAM_OVERLAP'), 'Must detect team overlap');
  });

  // 7. League + IPL Playoffs (Q1, Eliminator, Q2, Final -> Champion)
  await test('7. League + IPL Playoffs (4 teams -> League -> Q1/Elim/Q2/Final -> Champion)', async () => {
    const tid = 'TE-IPL-4';
    await tournamentService.createTournament({
      id: tid,
      name: 'TE IPL Format',
      tournament_type: 'LEAGUE_PLAYOFFS',
      teams: teams40.slice(0, 4),
      start_date: '2026-12-01',
      end_date: '2026-12-20'
    });
    await tournamentService.generateMatches(tid, { ignoreConflicts: true }, 'admin@cfvd.org');
    const leagueMatches = await db.models.Match.find({ tournament_id: tid, bracket_type: 'LEAGUE' }).lean();
    assert.strictEqual(leagueMatches.length, 6);
    for (const m of leagueMatches) {
      await completeMatchWithWinner(m.id, m.team_a_id);
    }

    // Playoff Q1 & Eliminator should now be auto-generated!
    const poRound1 = await db.models.Match.find({ tournament_id: tid, status: 'SCHEDULED' }).lean();
    assert.strictEqual(poRound1.length, 2, 'Q1 and Eliminator must auto-generate');
    for (const m of poRound1) {
      await completeMatchWithWinner(m.id, m.team_a_id);
    }

    // Q2 should now be generated
    const q2 = await db.models.Match.find({ tournament_id: tid, bracket_slot: 'PO-Q2', status: 'SCHEDULED' }).lean();
    assert.strictEqual(q2.length, 1, 'Qualifier 2 must auto-generate');
    await completeMatchWithWinner(q2[0].id, q2[0].team_a_id);

    // Final should now be generated
    const finalM = await db.models.Match.find({ tournament_id: tid, bracket_slot: 'PO-FINAL', status: 'SCHEDULED' }).lean();
    assert.strictEqual(finalM.length, 1, 'Final must auto-generate');
    await completeMatchWithWinner(finalM[0].id, finalM[0].team_a_id);

    const done = await db.models.Tournament.findOne({ id: tid }).lean();
    assert.strictEqual(done.status, 'COMPLETED');
    assert.strictEqual(done.champion_team_id, finalM[0].team_a_id);
  });

  // 8. Result Correction & Downstream Dependency Protection
  await test('8. Result Correction & Downstream Dependency Protection', async () => {
    const tid = 'TE-REV-4';
    await tournamentService.createTournament({
      id: tid,
      name: 'TE Reverse Test',
      tournament_type: 'KNOCKOUT',
      teams: teams40.slice(0, 4),
      start_date: '2026-12-01',
      end_date: '2026-12-10'
    });
    await tournamentService.generateMatches(tid, { ignoreConflicts: true }, 'admin@cfvd.org');
    const sfMatches = await db.models.Match.find({ tournament_id: tid, status: 'SCHEDULED' }).lean();
    await completeMatchWithWinner(sfMatches[0].id, sfMatches[0].team_a_id);
    await completeMatchWithWinner(sfMatches[1].id, sfMatches[1].team_a_id);

    const finalMatch = await db.models.Match.findOne({ tournament_id: tid, stage: 'FINAL' }).lean();
    assert(finalMatch, 'Final must exist');

    // Reversing SF1 while Final is still SCHEDULED succeeds and cleans up Final
    const rev = await tournamentEngine.reverseMatchProgression(sfMatches[0].id, 'admin@cfvd.org', { reopenMatch: true });
    assert.strictEqual(rev.status, 'LIVE');

    // Re-complete SF1 & SF2, then start Final -> Downstream protection must BLOCK reversing SF1!
    await completeMatchWithWinner(sfMatches[0].id, sfMatches[0].team_a_id);
    await db.models.Match.updateOne({ id: finalMatch.id }, { $set: { status: 'LIVE' } });
    let blocked = false;
    try {
      await tournamentEngine.reverseMatchProgression(sfMatches[0].id, 'admin@cfvd.org');
    } catch (err) {
      if (err.status === 409) blocked = true;
    }
    assert.strictEqual(blocked, true, 'Must block reversal when downstream match is LIVE');
  });

  // 9. Withdrawal, Player Eligibility, What-If Simulator, Team & Player History
  await test('9. Withdrawal, Eligibility, What-If Simulator & Team/Player History', async () => {
    const tid = 'TE-ADV-4';
    await tournamentService.createTournament({
      id: tid,
      name: 'TE Advanced',
      tournament_type: 'LEAGUE',
      teams: teams40.slice(0, 4),
      format_config: { min_squad_size: 2, max_squad_size: 15 },
      start_date: '2026-12-01',
      end_date: '2026-12-15'
    });
    await tournamentService.generateMatches(tid, { ignoreConflicts: true }, 'admin@cfvd.org');

    // What-If Simulator (must not mutate DB)
    const sched = await db.models.Match.find({ tournament_id: tid, status: 'SCHEDULED' }).lean();
    const sim = await tournamentEngine.simulateWhatIf(tid, [
      { match_id: sched[0].id, winner_id: sched[0].team_a_id }
    ]);
    assert.strictEqual(sim.is_simulation, true);
    const dbCountAfterSim = await db.models.Match.countDocuments({ tournament_id: tid, status: 'COMPLETED' });
    assert.strictEqual(dbCountAfterSim, 0, 'What-If simulation must NEVER mutate DB');

    // Eligibility validation
    await db.models.Player.create([
      { id: 'TE-PL-1', team_id: teams40[0], name: 'Test P1', email: 'tep1@test.com', status: 'ACTIVE' },
      { id: 'TE-PL-2', team_id: teams40[0], name: 'Test P2', email: 'tep2@test.com', status: 'ACTIVE' },
      { id: 'TE-PL-3', team_id: teams40[1], name: 'Dup P1', email: 'tep1@test.com', status: 'ACTIVE' }
    ]);
    const eligOk = await tournamentEngine.validatePlayerEligibility(tid, teams40[0]);
    assert.strictEqual(eligOk.eligible, false, 'Duplicate email across teams in same tournament must fail');

    // Withdrawal
    const wd = await tournamentEngine.withdrawTeam(tid, teams40[3], { reason: 'Unable to travel', rule: 'REMAINING_WALKOVER' });
    assert(wd.affected_matches > 0, 'Withdrawal must process remaining scheduled matches');

    // Team History & Player History
    const teamHist = await historyService.getTeamHistory(teams40[0]);
    assert.strictEqual(teamHist.success, true);
    assert(teamHist.summary.matches_played >= 1);

    const playerHist = await historyService.getPlayerHistory('TE-PL-1');
    assert.strictEqual(playerHist.success, true);
    assert.strictEqual(playerHist.player.id, 'TE-PL-1');
  });

  // 10. Full E2E Admin -> Scorer -> Live Delivery -> Result -> Points -> Champion -> History
  await test('10. Full E2E Integration: Admin -> Schedule -> Scorer Live Scoring -> Result -> Champion -> History', async () => {
    const tid = 'TE-E2E-2';
    const tA = teams40[10];
    const tB = teams40[11];
    // Create 9+ players per team to satisfy Rule 15
    const pDocs = [];
    for (let i = 1; i <= 11; i++) {
      pDocs.push({ id: `TE-PL-A${i}`, team_id: tA, name: `Player A${i}`, status: 'ACTIVE' });
      pDocs.push({ id: `TE-PL-B${i}`, team_id: tB, name: `Player B${i}`, status: 'ACTIVE' });
    }
    await db.models.Player.insertMany(pDocs);

    await tournamentService.createTournament({
      id: tid,
      name: 'TE E2E Cup',
      tournament_type: 'KNOCKOUT',
      teams: [tA, tB],
      overs_per_match: 1,
      start_date: '2026-12-01',
      end_date: '2026-12-05'
    });
    const gen = await tournamentService.generateMatches(tid, { ignoreConflicts: true }, 'admin@cfvd.org');
    assert.strictEqual(gen.fixtures.length, 1);
    const matchId = gen.fixtures[0].id;

    // Submit team allocations then confirm schedule as Admin
    await db.models.Match.updateOne(
      { id: matchId },
      { $set: { team_a_allocation_status: 'SUBMITTED', team_b_allocation_status: 'SUBMITTED' } }
    );
    await adminService.confirmMatchSchedule(matchId, 'admin@cfvd.org');

    // Scorer starts match
    await matchService.startMatch(matchId, {
      tossWinner: tA,
      tossDecision: 'BAT',
      teamAPlayingXI: pDocs.filter(p => p.team_id === tA).map(p => p.id),
      teamBPlayingXI: pDocs.filter(p => p.team_id === tB).map(p => p.id),
      overs: 1
    }, { role: 'SCORER', id: 'SCR-101' });

    // Score 6 balls (6 runs total) to finish Innings 1 (auto-transitions to Innings 2)
    for (let b = 0; b < 6; b++) {
      await scoringEngine.recordDelivery(matchId, {
        strikerId: 'TE-PL-A1',
        nonStrikerId: 'TE-PL-A2',
        bowlerId: 'TE-PL-B1',
        runsBatter: 1,
        extraType: 'NONE'
      }, 'SCR-101');
    }

    // Chase target (7 runs) in Innings 2 with a 6 and a 1
    await scoringEngine.recordDelivery(matchId, {
      strikerId: 'TE-PL-B1',
      nonStrikerId: 'TE-PL-B2',
      bowlerId: 'TE-PL-A1',
      runsBatter: 6,
      extraType: 'NONE'
    }, 'SCR-101');
    const chaseRes = await scoringEngine.recordDelivery(matchId, {
      strikerId: 'TE-PL-B1',
      nonStrikerId: 'TE-PL-B2',
      bowlerId: 'TE-PL-A1',
      runsBatter: 1,
      extraType: 'NONE'
    }, 'SCR-101');
    assert.strictEqual(chaseRes.data.isMatchCompleted, true, 'Match must complete on chase');

    // Wait briefly for non-blocking onMatchCompleted hook
    await new Promise(r => setTimeout(r, 400));

    const completedTour = await db.models.Tournament.findOne({ id: tid }).lean();
    assert.strictEqual(completedTour.status, 'COMPLETED', 'Tournament must auto-complete');
    assert.strictEqual(completedTour.champion_team_id, tB, 'Chasing team tB must be crowned Champion');

    const th = await historyService.getTeamHistory(tB);
    assert(th.summary.titles_won >= 1, 'Team history must reflect championship');
  });

  // Cleanup test artifacts
  await db.models.Tournament.deleteMany({ id: /^TE-/ });
  await db.models.Match.deleteMany({ tournament_id: /^TE-/ });
  await db.models.Innings.deleteMany({ match_id: /^M-TE/ });
  await db.models.InningsBatter.deleteMany({ match_id: /^M-TE/ });
  await db.models.InningsBowler.deleteMany({ match_id: /^M-TE/ });
  await db.models.Delivery.deleteMany({ match_id: /^M-TE/ });
  await db.models.Team.deleteMany({ id: /^TE-TM-/ });
  await db.models.Player.deleteMany({ id: /^TE-PL-/ });

  console.log('\n==============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('==============================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch(err => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
