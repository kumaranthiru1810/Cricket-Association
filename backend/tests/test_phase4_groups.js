/**
 * Phase 4 Automated Test Suite: Flexible Group Management (10-100+ teams),
 * Manual Allocation, Qualification Validation, Fixture Generation & Phase 3 Compatibility.
 * Runs strictly against cricket_test_db (NODE_ENV=test).
 */
process.env.NODE_ENV = 'test';

const assert = require('assert');
const mongoose = require('mongoose');
const db = require('../config/db');
const tournamentEngine = require('../services/tournamentEngine');
const tournamentService = require('../services/tournamentService');
const scoringEngine = require('../services/scoringEngine');

let passed = 0;
function ok(label) {
  console.log(`  ✅ PASS: ${label}`);
  passed++;
}

async function seedTeams(prefix, count) {
  const ids = [];
  const ops = [];
  for (let i = 1; i <= count; i++) {
    const id = `${prefix}-T${i}`;
    ids.push(id);
    ops.push({
      updateOne: {
        filter: { id },
        update: {
          $set: {
            id,
            name: `${prefix} Team ${i}`,
            short_name: `${prefix}${i}`,
            status: 'ACTIVE',
            stats: { matches: 0, won: 0, lost: 0, tied: 0, no_result: 0, win_percentage: 0 }
          }
        },
        upsert: true
      }
    });
  }
  if (ops.length > 0) await db.models.Team.bulkWrite(ops);
  return ids;
}

async function run() {
  console.log('\n==================================================');
  console.log('🏆 PHASE 4 ADVANCED GROUP & TOURNAMENT MANAGEMENT');
  console.log('==================================================\n');

  await db.initDb();
  assert.strictEqual(mongoose.connection.name, 'cricket_test_db');

  await db.models.Tournament.deleteMany({ id: /^TOUR-P4/ });
  await db.models.Match.deleteMany({ tournament_id: /^TOUR-P4/ });
  await db.models.Team.deleteMany({ id: /^P4-/ });

  const teams40 = await seedTeams('P4-40', 40);

  // 1. 40 teams / 5 groups (8 teams/group -> 5 * 28 = 140 group matches)
  const t40_5 = await tournamentService.createTournament({
    id: 'TOUR-P4-40-5',
    name: 'Phase4 40 Teams 5 Groups',
    short_name: 'P4405',
    tournament_type: 'GROUP_KNOCKOUT',
    teams: teams40,
    max_teams: 40,
    format_config: { group_count: 5, teams_per_group: 8, qualifiers_per_group: 2, best_runners_up_count: 0, group_distribution: 'BALANCED' }
  });
  const prev40_5 = await tournamentService.previewFixtures(t40_5.id);
  assert.strictEqual(prev40_5.groups.length, 5);
  assert(prev40_5.groups.every(g => g.teamCount === 8 && g.matchesPerGroup === 28));
  assert.strictEqual(prev40_5.total_group_matches, 140);
  ok('Test 1: 40 teams / 5 groups -> 8 teams/group, 140 group matches');

  // 2. 40 teams / 4 groups (10 teams/group -> 4 * 45 = 180 group matches)
  const prev40_4 = await tournamentService.previewFixtures(t40_5.id, {
    format_config: { group_count: 4, teams_per_group: 10, qualifiers_per_group: 2, best_runners_up_count: 0 }
  });
  assert.strictEqual(prev40_4.groups.length, 4);
  assert(prev40_4.groups.every(g => g.teamCount === 10 && g.matchesPerGroup === 45));
  assert.strictEqual(prev40_4.total_group_matches, 180);
  ok('Test 2: 40 teams / 4 groups -> 10 teams/group, 180 group matches');

  // 3. 23 teams / 5 uneven groups -> [5, 5, 5, 4, 4]
  const teams23 = teams40.slice(0, 23);
  const alloc23 = tournamentEngine.allocateGroups(teams23, { group_count: 5, teams_per_group: 5, group_distribution: 'BALANCED' });
  assert.deepStrictEqual(alloc23.groups.map(g => g.teams.length), [5, 5, 5, 4, 4]);
  assert.strictEqual(new Set(alloc23.groups.flatMap(g => g.teams)).size, 23);
  ok('Test 3: 23 teams / 5 uneven groups -> [5, 5, 5, 4, 4] with 0 dropped/duplicate teams');

  // 4. Odd number of teams & byes (15 teams / 3 groups of 5 -> 5 byes/group = 15 byes)
  const teams15 = teams40.slice(0, 15);
  const prev15 = await tournamentService.previewFixtures(t40_5.id, {
    teams: teams15,
    format_config: { group_count: 3, teams_per_group: 5, qualifiers_per_group: 1, best_runners_up_count: 1 }
  });
  assert.strictEqual(prev15.groups.length, 3);
  assert.strictEqual(prev15.byes_count, 15);
  assert.strictEqual(prev15.total_group_matches, 30);
  ok('Test 4: Odd-sized groups (3x5=15 teams) -> 15 byes & 30 group matches');

  // 5. Random allocation
  const allocRand = tournamentEngine.allocateGroups(teams23, { group_count: 5, teams_per_group: 5, group_distribution: 'RANDOM' });
  assert.strictEqual(new Set(allocRand.groups.flatMap(g => g.teams)).size, 23);
  ok('Test 5: Random allocation places all 23 teams uniquely');

  // 6. Seeded allocation (snake draft)
  const teams8 = teams40.slice(0, 8);
  const allocSeed = tournamentEngine.allocateGroups(teams8, { group_count: 2, teams_per_group: 4, group_distribution: 'SEEDED' });
  // Snake draft for 2 groups: [T1, T4, T5, T8] and [T2, T3, T6, T7]
  assert.deepStrictEqual(allocSeed.groups[0].teams, ['P4-40-T1', 'P4-40-T4', 'P4-40-T5', 'P4-40-T8']);
  assert.deepStrictEqual(allocSeed.groups[1].teams, ['P4-40-T2', 'P4-40-T3', 'P4-40-T6', 'P4-40-T7']);
  ok('Test 6: Seeded snake-draft allocation verified');

  // 7. Manual allocation via updateTournamentGroups + AuditLog
  const tManual = await tournamentService.createTournament({
    id: 'TOUR-P4-MAN',
    name: 'Phase4 Manual Groups',
    short_name: 'P4MAN',
    tournament_type: 'GROUP_KNOCKOUT',
    teams: teams8,
    max_teams: 8,
    format_config: { group_count: 2, teams_per_group: 4, qualifiers_per_group: 1, best_runners_up_count: 0, group_distribution: 'BALANCED' }
  });
  const manualGroups = {
    GROUP_A: teams8.slice(0, 4),
    GROUP_B: teams8.slice(4, 8)
  };
  const updRes = await tournamentService.updateTournamentGroups(tManual.id, {
    group_distribution: 'MANUAL',
    manual_groups: manualGroups,
    qualifiers_per_group: 1,
    best_third_place_count: 0
  }, 'admin@cfvd.org');
  assert.strictEqual(updRes.success, true);
  assert.strictEqual(updRes.groups[0].teams.length, 4);
  const auditGrp = await db.models.AuditLog.findOne({ action: 'UPDATE_TOURNAMENT_GROUPS', target_user: tManual.name }).lean();
  assert(auditGrp, 'AuditLog must record UPDATE_TOURNAMENT_GROUPS');
  ok('Test 7: Manual group allocation saved via updateTournamentGroups & audited');

  // 8. Duplicate team prevention
  let dupErr = null;
  try {
    tournamentEngine.validateGroupAndQualificationConfig(teams8, 'GROUP_KNOCKOUT', {
      group_count: 2,
      teams_per_group: 4,
      group_distribution: 'MANUAL',
      manual_groups: { GROUP_A: [teams8[0], teams8[1], teams8[2], teams8[3]], GROUP_B: [teams8[0], teams8[4], teams8[5], teams8[6]] }
    });
  } catch (e) { dupErr = e; }
  assert.strictEqual(dupErr?.code, 'DUPLICATE_TEAM_IN_GROUPS');
  ok('Test 8: Duplicate team assignment rejected (DUPLICATE_TEAM_IN_GROUPS)');

  // 9. Unassigned team validation
  let unErr = null;
  try {
    tournamentEngine.validateGroupAndQualificationConfig(teams8, 'GROUP_KNOCKOUT', {
      group_count: 2,
      teams_per_group: 4,
      group_distribution: 'MANUAL',
      manual_groups: { GROUP_A: teams8.slice(0, 3), GROUP_B: teams8.slice(3, 6) }
    });
  } catch (e) { unErr = e; }
  assert.strictEqual(unErr?.code, 'UNASSIGNED_TEAMS_IN_GROUPS');
  ok('Test 9: Unassigned teams rejected (UNASSIGNED_TEAMS_IN_GROUPS)');

  // 10. Qualification configuration (Top N + best third place)
  const qVal = tournamentEngine.validateGroupAndQualificationConfig(teams15, 'GROUP_KNOCKOUT', {
    group_count: 3,
    teams_per_group: 5,
    qualifiers_per_group: 2,
    best_third_place_count: 2
  });
  assert.strictEqual(qVal.totalQualifiers, 8);
  ok('Test 10: Qualification config (3x2 + 2 best 3rd-place = 8 qualifiers) validated');

  // 11. Invalid group configurations
  const invalidCases = [
    { cfg: { group_count: 0, teams_per_group: 4 }, code: 'INVALID_GROUP_COUNT' },
    { cfg: { group_count: 2, teams_per_group: 1 }, code: 'INVALID_TEAMS_PER_GROUP' },
    { cfg: { group_count: 5, teams_per_group: 2 }, code: 'TOO_MANY_GROUPS' },
    { cfg: { group_count: 2, teams_per_group: 4, qualifiers_per_group: 5 }, code: 'QUALIFIERS_EXCEED_GROUP_SIZE' },
    { cfg: { group_count: 1, teams_per_group: 8, qualifiers_per_group: 1, best_runners_up_count: 0 }, code: 'INSUFFICIENT_QUALIFIERS' }
  ];
  for (const ic of invalidCases) {
    let caught = null;
    try {
      tournamentEngine.validateGroupAndQualificationConfig(teams8, 'GROUP_KNOCKOUT', ic.cfg);
    } catch (e) { caught = e; }
    assert.strictEqual(caught?.code, ic.code, `Expected ${ic.code}, got ${caught?.code}`);
  }
  ok('Test 11: Invalid group & qualification configurations rejected cleanly');

  // 12. Fixture generation (Single & Double RR) + duplicate fixture prevention
  const genSingle = await tournamentService.generateMatches(tManual.id, { tournament_type: 'GROUP_KNOCKOUT', round_robin_type: 'SINGLE' });
  assert.strictEqual(genSingle.total_matches_generated, 12); // 2 groups of 4 -> 6+6=12
  assert(genSingle.fixtures.every(f => f.group_key === 'GROUP_A' || f.group_key === 'GROUP_B'));
  const genDup = await tournamentService.generateMatches(tManual.id, { tournament_type: 'GROUP_KNOCKOUT', round_robin_type: 'SINGLE' });
  assert.strictEqual(genDup.total_matches_generated, 12);
  const totalInDb = await db.models.Match.countDocuments({ tournament_id: tManual.id });
  assert.strictEqual(totalInDb, 12, 'Duplicate generateMatches must not create extra fixtures');

  const prevDouble = await tournamentService.previewFixtures(t40_5.id, { teams: teams8, round_robin_type: 'DOUBLE', format_config: { group_count: 2, teams_per_group: 4, qualifiers_per_group: 1 } });
  assert.strictEqual(prevDouble.total_group_matches, 24);
  ok('Test 12: Single & Double RR group fixtures generated with group_key & 0 duplicates');

  // 13. Prevent group modifications after fixtures exist / matches start
  let lockErr = null;
  try {
    await tournamentService.updateTournamentGroups(tManual.id, { group_distribution: 'BALANCED' }, 'admin@cfvd.org');
  } catch (e) { lockErr = e; }
  assert.strictEqual(lockErr?.status, 409);
  ok('Test 13: Group modifications blocked (409) after fixtures exist / matches start');

  // 14. Phase 3 progression compatibility on tManual
  const manMatches = await db.models.Match.find({ tournament_id: tManual.id }).lean();
  for (const m of manMatches) {
    const w = (m.team_a_id === teams8[0] || m.team_b_id === teams8[0])
      ? teams8[0]
      : (m.team_a_id === teams8[4] || m.team_b_id === teams8[4])
        ? teams8[4]
        : m.team_a_id;
    await scoringEngine.endMatch(m.id, { winnerId: w, resultText: `${w} won` });
  }
  const koFinal = await db.models.Match.find({ tournament_id: tManual.id, stage: { $not: /^GROUP_/ } }).lean();
  assert.strictEqual(koFinal.length, 1, 'Phase 3 auto-progression generated Knockout Final from Phase 4 manual groups');
  ok('Test 14: Phase 3 automatic progression compatible with Phase 4 manual groups');

  console.log(`\n🎉 PHASE 4 TEST SUITE COMPLETE: ${passed} PASSED, 0 FAILED\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ PHASE 4 TEST FAILED:', err);
  process.exit(1);
});

