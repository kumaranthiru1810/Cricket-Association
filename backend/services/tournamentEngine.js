/**
 * services/tournamentEngine.js
 * Unified Tournament Engine for CFVD Cricket Association:
 * - Formats: Single/Double Round Robin (Berger/Circle with Byes),
 *   Single Elimination (Power-of-2 seeding + Byes + Auto-advancement),
 *   Double Elimination (Winners Bracket, Losers Bracket, Grand Final, Grand Final Reset, Byes),
 *   Group Stage + Knockout, League + IPL Playoffs (Q1, Eliminator, Q2, Final).
 * - Group Management: BALANCED, RANDOM, SEEDED, MANUAL, unequal groups, lock after start.
 * - Scheduling & Conflict Detection: Preview, venue/team/official overlap, min rest hours.
 * - Progression & Recovery: Idempotent winner/loser advancement, champion determination,
 *   safe result correction & downstream dependency protection.
 * - Advanced: Withdrawal handling, Player eligibility validation, What-If simulator.
 */

const db = require('../config/db');
const tournamentModel = require('../models/tournamentModel');

function sanitizeIdPart(val) {
  return String(val || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'T';
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 9 * 60 + 30;
  const s = String(timeStr).trim().toUpperCase();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return 9 * 60 + 30;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3];
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function getMatchTimestampMinutes(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 60000) + parseTimeToMinutes(timeStr);
}

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard tournament bracket seed ordering for size P (power of 2)
 * e.g. P=8 -> [0, 7, 3, 4, 1, 6, 2, 5] (1v8, 4v5, 2v7, 3v6)
 */
function buildBracketSeedOrder(p) {
  let seeds = [0, 1];
  while (seeds.length < p) {
    const nextSize = seeds.length * 2;
    const expanded = [];
    for (const s of seeds) {
      expanded.push(s);
      expanded.push(nextSize - 1 - s);
    }
    seeds = expanded;
  }
  return seeds;
}

class TournamentEngine {
  async _logAudit(action, adminEmail, target, result, details) {
    try {
      await db.initDb();
      await db.models.AuditLog.create({
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        action,
        initiated_by: adminEmail || 'admin@cfvd.org',
        target_user: target || 'Tournament',
        result,
        details,
        timestamp: new Date()
      });
    } catch (_err) {
      // Non-blocking
    }
  }

  async _resolveTeamNameMap(teamIds = []) {
    const validObjIds = teamIds.filter(id => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id));
    const [teamDocs, regDocs] = await Promise.all([
      db.models.Team.find({
        $or: [
          { id: { $in: teamIds } },
          { team_id: { $in: teamIds } },
          { name: { $in: teamIds } },
          ...(validObjIds.map(id => ({ _id: id })))
        ]
      }).lean(),
      db.models.TeamRegistration.find({
        $or: [
          { id: { $in: teamIds } },
          { team_name: { $in: teamIds } },
          ...(validObjIds.map(id => ({ _id: id })))
        ]
      }).lean()
    ]);

    const map = {};
    teamDocs.forEach(t => {
      const name = t.name || t.team_name || t.id;
      if (t.id) map[t.id] = name;
      if (t.team_id) map[t.team_id] = name;
      if (t._id) map[t._id.toString()] = name;
    });
    regDocs.forEach(r => {
      const name = r.team_name || r.id;
      if (r.id && !map[r.id]) map[r.id] = name;
      if (r._id && !map[r._id.toString()]) map[r._id.toString()] = name;
    });
    return map;
  }

  async _getDefaultOfficials() {
    const [scorers, umpires] = await Promise.all([
      db.models.Scorer.find({ status: 'APPROVED' }).select('id full_name').lean(),
      db.models.Official.find({ role: { $in: ['UMPIRE', 'Umpire'] }, status: 'ACTIVE' }).select('id name').lean()
    ]);
    const scorer = scorers[0] || { id: 'SCR-101', full_name: 'Official Scorer' };
    const u1 = umpires[0] || { id: 'UMP-101', name: 'Thiru. K. Sundaram' };
    const u2 = umpires[1] || umpires[0] || { id: 'UMP-102', name: 'Thiru. M. Ramanathan' };
    return {
      scorerId: scorer.id,
      scorerName: scorer.full_name || 'Official Scorer',
      umpire1Id: u1.id,
      umpire1Name: u1.name,
      umpire2Id: u2.id,
      umpire2Name: u2.name
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 4: ADVANCED GROUP MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Allocate teams into groups supporting BALANCED, RANDOM, SEEDED, MANUAL,
   * and unequal group sizes (e.g., 23 teams -> 5 groups: 5, 5, 5, 4, 4).
   */
  allocateGroups(firstArg, secondArg, thirdArg) {
    if (Array.isArray(firstArg)) return allocateGroupsPure(firstArg, secondArg);
    return this._allocateGroupsAsync(firstArg, secondArg, thirdArg);
  }

  async _allocateGroupsAsync(tournamentId, config = {}, adminEmail = 'system-admin') {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    // Lock group changes if matches have already started
    const activeMatches = await db.models.Match.countDocuments({
      tournament_id: tournament.id,
      status: { $in: ['LIVE', 'INNINGS_BREAK', 'PAUSED', 'COMPLETED'] }
    });
    if (activeMatches > 0 && !config.force) {
      throw {
        status: 409,
        message: `Cannot modify groups: ${activeMatches} match(es) have already started or completed.`
      };
    }

    const teams = Array.isArray(config.teams) && config.teams.length > 0
      ? [...new Set(config.teams)]
      : [...new Set(tournament.teams || [])];

    if (teams.length < 2) {
      throw { status: 400, message: 'At least 2 participating teams are required for group allocation.' };
    }

    const mode = String(config.mode || 'BALANCED').toUpperCase();
    if (!['BALANCED', 'RANDOM', 'SEEDED', 'MANUAL'].includes(mode)) {
      throw { status: 400, message: `Invalid allocation mode '${mode}'.` };
    }

    let numGroups = Number(config.numGroups || config.num_groups || 0);
    const teamsPerGroup = Number(config.teamsPerGroup || config.teams_per_group || 0);

    if (!numGroups && teamsPerGroup > 0) {
      numGroups = Math.ceil(teams.length / teamsPerGroup);
    }
    if (!numGroups || numGroups < 1) {
      numGroups = teams.length >= 8 ? 2 : 1;
    }
    if (numGroups > teams.length) {
      throw { status: 400, message: `Number of groups (${numGroups}) cannot exceed total teams (${teams.length}).` };
    }

    const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let groups = Array.from({ length: numGroups }, (_, idx) => ({
      id: `GRP-${groupNames[idx] || idx + 1}`,
      name: `Group ${groupNames[idx] || idx + 1}`,
      teams: [],
      locked: false
    }));

    if (mode === 'MANUAL' && Array.isArray(config.manualGroups) && config.manualGroups.length > 0) {
      const assignedSet = new Set();
      groups = config.manualGroups.map((g, idx) => {
        const gTeams = [];
        for (const tid of (g.teams || [])) {
          if (assignedSet.has(tid)) {
            throw { status: 400, message: `Duplicate team assignment detected for team '${tid}'.` };
          }
          if (!teams.includes(tid)) {
            throw { status: 400, message: `Team '${tid}' is not a participating team in this tournament.` };
          }
          assignedSet.add(tid);
          gTeams.push(tid);
        }
        return {
          id: g.id || `GRP-${groupNames[idx] || idx + 1}`,
          name: g.name || `Group ${groupNames[idx] || idx + 1}`,
          teams: gTeams,
          locked: false
        };
      });
    } else {
      let ordered = [...teams];
      if (mode === 'RANDOM') {
        for (let i = ordered.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
        }
      } else if (mode === 'SEEDED' && Array.isArray(config.seedOrder) && config.seedOrder.length > 0) {
        const seedSet = new Set(config.seedOrder.filter(t => teams.includes(t)));
        ordered = [...seedSet, ...teams.filter(t => !seedSet.has(t))];
      }

      if (mode === 'SEEDED') {
        // Serpentine (snake) draft so top seeds are balanced across groups
        ordered.forEach((tid, idx) => {
          const cycle = Math.floor(idx / numGroups);
          const pos = idx % numGroups;
          const gIdx = cycle % 2 === 0 ? pos : (numGroups - 1 - pos);
          groups[gIdx].teams.push(tid);
        });
      } else {
        // BALANCED / RANDOM: Distribute evenly; first (N % G) groups get +1 team (e.g. 23 -> 5,5,5,4,4)
        const baseSize = Math.floor(ordered.length / numGroups);
        const remainder = ordered.length % numGroups;
        let cursor = 0;
        for (let gIdx = 0; gIdx < numGroups; gIdx++) {
          const size = baseSize + (gIdx < remainder ? 1 : 0);
          groups[gIdx].teams = ordered.slice(cursor, cursor + size);
          cursor += size;
        }
      }
    }

    const assignedTeams = new Set(groups.flatMap(g => g.teams));
    const unassignedTeams = teams.filter(t => !assignedTeams.has(t));
    const sizes = groups.map(g => g.teams.length);
    const maxDiff = Math.max(...sizes) - Math.min(...sizes);
    const balanceValid = maxDiff <= 1;

    const updated = await db.models.Tournament.findOneAndUpdate(
      { id: tournament.id },
      {
        $set: {
          groups,
          group_allocation_mode: mode,
          groups_confirmed: Boolean(config.confirm)
        }
      },
      { new: true }
    ).lean();

    await this._logAudit(
      'ALLOCATE_GROUPS',
      adminEmail,
      tournament.name,
      `Allocated ${teams.length} teams into ${groups.length} groups (${mode})`,
      `Sizes: [${sizes.join(', ')}]`
    );

    return {
      success: true,
      tournament_id: tournament.id,
      mode,
      groups: updated.groups,
      unassigned_teams: unassignedTeams,
      balance_valid: balanceValid,
      group_sizes: sizes,
      groups_confirmed: updated.groups_confirmed
    };
  }

  /**
   * Manually move a team between groups (with duplicate & lock protection)
   */
  async moveTeamBetweenGroups(tournamentId, teamId, fromGroupId, toGroupId, adminEmail = 'system-admin') {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    const activeMatches = await db.models.Match.countDocuments({
      tournament_id: tournament.id,
      status: { $in: ['LIVE', 'INNINGS_BREAK', 'PAUSED', 'COMPLETED'] }
    });
    if (activeMatches > 0) {
      throw { status: 409, message: 'Cannot move teams after matches have started.' };
    }

    const groups = (tournament.groups || []).map(g => ({ ...g, teams: [...(g.teams || [])] }));
    const targetGroup = groups.find(g => g.id === toGroupId || g.name === toGroupId);
    if (!targetGroup) throw { status: 404, message: `Target group '${toGroupId}' not found.` };

    // Remove from any existing group to strictly prevent duplicate assignment
    groups.forEach(g => {
      g.teams = g.teams.filter(t => t !== teamId);
    });
    targetGroup.teams.push(teamId);

    await db.models.Tournament.findOneAndUpdate(
      { id: tournament.id },
      { $set: { groups, group_allocation_mode: 'MANUAL', groups_confirmed: false } }
    );

    const assigned = new Set(groups.flatMap(g => g.teams));
    const unassigned = (tournament.teams || []).filter(t => !assigned.has(t));
    const sizes = groups.map(g => g.teams.length);

    await this._logAudit(
      'MOVE_TEAM_GROUP',
      adminEmail,
      tournament.name,
      `Moved team '${teamId}' to '${targetGroup.name}'`,
      `From: ${fromGroupId || 'Unassigned'}`
    );

    return {
      success: true,
      groups,
      unassigned_teams: unassigned,
      balance_valid: (Math.max(...sizes) - Math.min(...sizes)) <= 1
    };
  }

  async confirmGroups(tournamentId, adminEmail = 'system-admin') {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };
    const groups = tournament.groups || [];
    if (groups.length === 0) throw { status: 400, message: 'No groups configured to confirm.' };

    const seen = new Set();
    for (const g of groups) {
      for (const tid of (g.teams || [])) {
        if (seen.has(tid)) throw { status: 400, message: `Duplicate team '${tid}' found across groups.` };
        seen.add(tid);
      }
    }

    await db.models.Tournament.findOneAndUpdate(
      { id: tournament.id },
      { $set: { groups_confirmed: true } }
    );
    await this._logAudit('CONFIRM_GROUPS', adminEmail, tournament.name, 'Confirmed group allocation', `Groups: ${groups.length}`);
    return { success: true, groups_confirmed: true, groups };
  }

  async updateQualificationConfig(tournamentId, config = {}, adminEmail = 'system-admin') {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    const existingCfg = tournament.format_config || {};
    const merged = {
      ...existingCfg,
      ...(config.top_n_per_group !== undefined ? { top_n_per_group: Number(config.top_n_per_group) } : {}),
      ...(config.best_third_place_count !== undefined ? { best_third_place_count: Number(config.best_third_place_count) } : {}),
      ...(config.qualifying_teams_count !== undefined ? { qualifying_teams_count: Number(config.qualifying_teams_count) } : {}),
      ...(config.qualification_rules !== undefined ? { qualification_rules: String(config.qualification_rules) } : {}),
      ...(Array.isArray(config.tie_breaker_order) ? { tie_breaker_order: config.tie_breaker_order } : {}),
      ...(config.playoffs_format ? { playoffs_format: config.playoffs_format } : {}),
      ...(config.allow_grand_final_reset !== undefined ? { allow_grand_final_reset: Boolean(config.allow_grand_final_reset) } : {})
    };

    await db.models.Tournament.findOneAndUpdate(
      { id: tournament.id },
      { $set: { format_config: merged } }
    );
    await this._logAudit('UPDATE_QUALIFICATION_CONFIG', adminEmail, tournament.name, 'Updated qualification rules', JSON.stringify(merged));
    return { success: true, format_config: merged };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 3 & 5: FIXTURE GENERATION, DOUBLE ELIMINATION & CONFLICT DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Circle / Berger round-robin generator.
   * Handles odd team counts by inserting a BYE slot so every round has valid pairings
   * and no team plays twice in the same round.
   */
  _generateRoundRobinRounds(teamIds, isDouble = false) {
    const list = [...teamIds];
    if (list.length % 2 !== 0) list.push('__BYE__');
    const n = list.length;
    const numRounds = n - 1;
    const rounds = [];

    const fixed = list[0];
    let rotating = list.slice(1);

    for (let r = 0; r < numRounds; r++) {
      const roundTeams = [fixed, ...rotating];
      const matches = [];
      const byes = [];
      for (let i = 0; i < n / 2; i++) {
        const a = roundTeams[i];
        const b = roundTeams[n - 1 - i];
        if (a === '__BYE__' && b !== '__BYE__') byes.push(b);
        else if (b === '__BYE__' && a !== '__BYE__') byes.push(a);
        else if (a !== '__BYE__' && b !== '__BYE__') {
          matches.push({
            home: r % 2 === 0 ? a : b,
            away: r % 2 === 0 ? b : a
          });
        }
      }
      rounds.push({ round: r + 1, matches, byes, isReturn: false });
      rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
    }

    if (isDouble) {
      const returnRounds = rounds.map((rd, idx) => ({
        round: numRounds + idx + 1,
        matches: rd.matches.map(m => ({ home: m.away, away: m.home })),
        byes: [...rd.byes],
        isReturn: true
      }));
      return [...rounds, ...returnRounds];
    }

    return rounds;
  }

  /**
   * Build Single Elimination Bracket structure & initial matches (supports byes & odd counts)
   */
  _buildSingleEliminationBracket(tournament, teamIds, teamNameMap, defaults, startDate, totalDays, venue, matchType, overs) {
    const n = teamIds.length;
    const p = nextPowerOf2(n);
    const totalRounds = Math.log2(p);
    const seedOrder = buildBracketSeedOrder(p);
    const padded = seedOrder.map(s => (s < n ? teamIds[s] : null));

    const prefix = sanitizeIdPart(tournament.id);
    const roundNames = (rIdx) => {
      const rem = totalRounds - rIdx;
      if (rem === 1) return 'FINAL';
      if (rem === 2) return 'SEMI_FINAL';
      if (rem === 3) return 'QUARTER_FINAL';
      if (rem === 4) return 'ROUND_OF_16';
      return `ROUND_${rIdx + 1}`;
    };

    const slotsByRound = [];
    const matchDocs = [];
    let matchSeq = 1;

    // Create all bracket slots bottom-up or top-down with IDs
    for (let r = 0; r < totalRounds; r++) {
      const numMatchesInRound = p / Math.pow(2, r + 1);
      const rSlots = [];
      for (let m = 0; m < numMatchesInRound; m++) {
        const slotId = `KO-R${r + 1}-M${m + 1}`;
        const matchId = `M-${prefix}-${slotId}`;
        rSlots.push({
          slot_id: slotId,
          match_id: matchId,
          round_number: r + 1,
          stage: roundNames(r),
          bracket_type: 'KNOCKOUT',
          team_a_id: null,
          team_b_id: null,
          winner_id: null,
          is_bye: false,
          next_match_id: null,
          next_match_slot: null
        });
      }
      slotsByRound.push(rSlots);
    }

    // Link next_match_id
    for (let r = 0; r < totalRounds - 1; r++) {
      for (let m = 0; m < slotsByRound[r].length; m++) {
        const nextSlot = slotsByRound[r + 1][Math.floor(m / 2)];
        slotsByRound[r][m].next_match_id = nextSlot.match_id;
        slotsByRound[r][m].next_match_slot = m % 2 === 0 ? 'A' : 'B';
      }
    }

    // Populate Round 1 and propagate Byes immediately
    for (let m = 0; m < slotsByRound[0].length; m++) {
      const slot = slotsByRound[0][m];
      const a = padded[m * 2];
      const b = padded[m * 2 + 1];
      slot.team_a_id = a;
      slot.team_b_id = b;

      if (a && !b) {
        slot.is_bye = true;
        slot.winner_id = a;
        if (slot.next_match_id) {
          const nextSlot = slotsByRound[1].find(s => s.match_id === slot.next_match_id);
          if (nextSlot) {
            if (slot.next_match_slot === 'A') nextSlot.team_a_id = a;
            else nextSlot.team_b_id = a;
          }
        }
      } else if (!a && b) {
        slot.is_bye = true;
        slot.winner_id = b;
        if (slot.next_match_id) {
          const nextSlot = slotsByRound[1].find(s => s.match_id === slot.next_match_id);
          if (nextSlot) {
            if (slot.next_match_slot === 'A') nextSlot.team_a_id = b;
            else nextSlot.team_b_id = b;
          }
        }
      }
    }

    // Create Match docs for any slot that has both teams resolved (Round 1 non-byes + Round 2 matches fed by two byes)
    const getMatchDate = (idx, total) => {
      const dayOffset = Math.floor((idx / Math.max(1, total)) * totalDays);
      return new Date(startDate.getTime() + dayOffset * 86400000).toISOString().split('T')[0];
    };

    const allPlayableSlots = [];
    slotsByRound.forEach(rSlots => {
      rSlots.forEach(slot => {
        if (!slot.is_bye && slot.team_a_id && slot.team_b_id) {
          allPlayableSlots.push(slot);
        }
      });
    });

    allPlayableSlots.forEach((slot, idx) => {
      matchDocs.push({
        id: slot.match_id,
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        team_a_id: slot.team_a_id,
        team_b_id: slot.team_b_id,
        team_a_name: teamNameMap[slot.team_a_id] || slot.team_a_id,
        team_b_name: teamNameMap[slot.team_b_id] || slot.team_b_id,
        venue,
        match_date: getMatchDate(idx, Math.max(1, allPlayableSlots.length)),
        match_time: idx % 2 === 0 ? '09:30 AM' : '02:30 PM',
        match_type: matchType,
        overs_per_side: overs,
        stage: slot.stage,
        round_number: slot.round_number,
        match_number: matchSeq++,
        bracket_type: 'KNOCKOUT',
        bracket_slot: slot.slot_id,
        next_match_id: slot.next_match_id,
        next_match_slot: slot.next_match_slot,
        status: 'SCHEDULED',
        assigned_scorer_id: defaults.scorerId,
        assigned_scorer_name: defaults.scorerName,
        umpire1_id: defaults.umpire1Id,
        umpire2_id: defaults.umpire2Id,
        umpire1_name: defaults.umpire1Name,
        umpire2_name: defaults.umpire2Name
      });
    });

    return {
      bracket: {
        format: 'SINGLE_ELIMINATION',
        team_count: n,
        bracket_size: p,
        rounds: slotsByRound.map((rSlots, idx) => ({
          round_number: idx + 1,
          name: roundNames(idx),
          slots: rSlots
        }))
      },
      fixtures: matchDocs
    };
  }

  /**
   * Build Complete Double Elimination Bracket (Winners, Losers, Grand Final, Grand Final Reset)
   * Supports any N >= 3 (including 3, 5, 8, 12, 16) with proper Byes & Loser drops.
   */
  _buildDoubleEliminationBracket(tournament, teamIds, teamNameMap, defaults, startDate, totalDays, venue, matchType, overs) {
    const n = teamIds.length;
    if (n < 3) {
      throw { status: 400, message: 'Double Elimination requires at least 3 participating teams.' };
    }

    const p = nextPowerOf2(n);
    const wbRoundsCount = Math.log2(p);
    const seedOrder = buildBracketSeedOrder(p);
    const padded = seedOrder.map(s => (s < n ? teamIds[s] : null));
    const prefix = sanitizeIdPart(tournament.id);

    // 1. Build Winners Bracket (WB)
    const wbRounds = [];
    for (let r = 0; r < wbRoundsCount; r++) {
      const count = p / Math.pow(2, r + 1);
      const slots = [];
      for (let m = 0; m < count; m++) {
        const slotId = `WB-R${r + 1}-M${m + 1}`;
        slots.push({
          slot_id: slotId,
          match_id: `M-${prefix}-${slotId}`,
          round_number: r + 1,
          stage: r === wbRoundsCount - 1 ? 'WB_FINAL' : `WB_ROUND_${r + 1}`,
          bracket_type: 'WINNERS',
          team_a_id: null,
          team_b_id: null,
          winner_id: null,
          loser_id: null,
          is_bye: false,
          next_match_id: null,
          next_match_slot: null,
          loser_next_match_id: null,
          loser_next_match_slot: null
        });
      }
      wbRounds.push(slots);
    }

    // Link WB -> WB
    for (let r = 0; r < wbRoundsCount - 1; r++) {
      for (let m = 0; m < wbRounds[r].length; m++) {
        const nextSlot = wbRounds[r + 1][Math.floor(m / 2)];
        wbRounds[r][m].next_match_id = nextSlot.match_id;
        wbRounds[r][m].next_match_slot = m % 2 === 0 ? 'A' : 'B';
      }
    }

    // Populate WB Round 1 and auto-advance Byes
    for (let m = 0; m < wbRounds[0].length; m++) {
      const slot = wbRounds[0][m];
      const a = padded[m * 2];
      const b = padded[m * 2 + 1];
      slot.team_a_id = a;
      slot.team_b_id = b;
      if (a && !b) {
        slot.is_bye = true;
        slot.winner_id = a;
        if (slot.next_match_id) {
          const nextSlot = wbRounds[1].find(s => s.match_id === slot.next_match_id);
          if (nextSlot) {
            if (slot.next_match_slot === 'A') nextSlot.team_a_id = a;
            else nextSlot.team_b_id = a;
          }
        }
      } else if (!a && b) {
        slot.is_bye = true;
        slot.winner_id = b;
        if (slot.next_match_id) {
          const nextSlot = wbRounds[1].find(s => s.match_id === slot.next_match_id);
          if (nextSlot) {
            if (slot.next_match_slot === 'A') nextSlot.team_a_id = b;
            else nextSlot.team_b_id = b;
          }
        }
      }
    }

    // 2. Build Losers Bracket (LB)
    // Total LB rounds = 2 * (wbRoundsCount - 1)
    // Example P=8 (wbRoundsCount=3): LB has 4 rounds:
    //   LB-R1 (2 matches): WB-R1 losers play each other
    //   LB-R2 (2 matches): LB-R1 winners vs WB-R2 losers
    //   LB-R3 (1 match): LB-R2 winners play each other
    //   LB-R4 (1 match - LB Final): LB-R3 winner vs WB-R3 (WB Final) loser
    // Example P=4 (wbRoundsCount=2): LB has 2 rounds:
    //   LB-R1 (1 match): WB-R1 losers play each other
    //   LB-R2 (1 match - LB Final): LB-R1 winner vs WB-R2 (WB Final) loser
    const lbRounds = [];
    const totalLbRounds = 2 * (wbRoundsCount - 1);
    for (let lbIdx = 0; lbIdx < totalLbRounds; lbIdx++) {
      // Matches in LB halve every 2 rounds: P/4, P/4, P/8, P/8, ..., 1, 1
      const count = Math.max(1, p / Math.pow(2, Math.floor(lbIdx / 2) + 2));
      const slots = [];
      for (let m = 0; m < count; m++) {
        const slotId = `LB-R${lbIdx + 1}-M${m + 1}`;
        slots.push({
          slot_id: slotId,
          match_id: `M-${prefix}-${slotId}`,
          round_number: lbIdx + 1,
          stage: lbIdx === totalLbRounds - 1 ? 'LB_FINAL' : `LB_ROUND_${lbIdx + 1}`,
          bracket_type: 'LOSERS',
          team_a_id: null,
          team_b_id: null,
          winner_id: null,
          loser_id: null,
          is_bye: false,
          expect_a_from_bye: false,
          expect_b_from_bye: false,
          next_match_id: null,
          next_match_slot: null
        });
      }
      lbRounds.push(slots);
    }

    // Link LB -> LB
    for (let lbIdx = 0; lbIdx < totalLbRounds - 1; lbIdx++) {
      const curr = lbRounds[lbIdx];
      const next = lbRounds[lbIdx + 1];
      if (curr.length === next.length) {
        // Minor -> Major: winner goes to slot A of same index; slot B comes from WB dropout
        for (let m = 0; m < curr.length; m++) {
          curr[m].next_match_id = next[m].match_id;
          curr[m].next_match_slot = 'A';
        }
      } else {
        // Major -> Minor: winners pair up
        for (let m = 0; m < curr.length; m++) {
          const target = next[Math.floor(m / 2)];
          curr[m].next_match_id = target.match_id;
          curr[m].next_match_slot = m % 2 === 0 ? 'A' : 'B';
        }
      }
    }

    // Link WB losers -> LB
    // WB-R1 losers -> LB-R1 (paired)
    for (let m = 0; m < wbRounds[0].length; m++) {
      const target = lbRounds[0][Math.floor(m / 2)];
      const slotPos = m % 2 === 0 ? 'A' : 'B';
      wbRounds[0][m].loser_next_match_id = target.match_id;
      wbRounds[0][m].loser_next_match_slot = slotPos;
      if (wbRounds[0][m].is_bye) {
        if (slotPos === 'A') target.expect_a_from_bye = true;
        else target.expect_b_from_bye = true;
      }
    }

    // Subsequent WB rounds (r >= 1) drop into Major LB rounds: lbIdx = 2*r - 1, slot B
    // Reverse order on alternating rounds to prevent immediate rematches
    for (let r = 1; r < wbRoundsCount; r++) {
      const lbIdx = 2 * r - 1;
      const targetRound = lbRounds[lbIdx];
      const wbCount = wbRounds[r].length;
      for (let m = 0; m < wbCount; m++) {
        const targetIdx = (r % 2 === 1) ? (wbCount - 1 - m) : m;
        const target = targetRound[targetIdx];
        wbRounds[r][m].loser_next_match_id = target.match_id;
        wbRounds[r][m].loser_next_match_slot = 'B';
      }
    }

    // Propagate LB-R1 double-byes if both feeder WB-R1 matches were byes
    lbRounds[0].forEach(slot => {
      if (slot.expect_a_from_bye && slot.expect_b_from_bye) {
        slot.is_bye = true;
        // No team enters LB from two WB byes, mark next LB slot as expecting bye from A
        if (slot.next_match_id) {
          const nextRound = lbRounds[1];
          const nextSlot = nextRound?.find(s => s.match_id === slot.next_match_id);
          if (nextSlot && slot.next_match_slot === 'A') {
            nextSlot.expect_a_from_bye = true;
          }
        }
      }
    });

    // 3. Grand Final & Grand Final Reset
    const gfSlot = {
      slot_id: 'GF-1',
      match_id: `M-${prefix}-GF-1`,
      round_number: wbRoundsCount + 1,
      stage: 'GRAND_FINAL',
      bracket_type: 'GRAND_FINAL',
      team_a_id: null, // WB Champion
      team_b_id: null, // LB Champion
      winner_id: null,
      loser_id: null,
      is_bye: false,
      next_match_id: `M-${prefix}-GF-RESET`,
      next_match_slot: null
    };

    const gfResetSlot = {
      slot_id: 'GF-RESET',
      match_id: `M-${prefix}-GF-RESET`,
      round_number: wbRoundsCount + 2,
      stage: 'GRAND_FINAL_RESET',
      bracket_type: 'GRAND_FINAL_RESET',
      team_a_id: null,
      team_b_id: null,
      winner_id: null,
      loser_id: null,
      is_bye: false,
      conditional: true,
      active: false
    };

    // Link WB Final & LB Final -> Grand Final
    const wbFinal = wbRounds[wbRoundsCount - 1][0];
    wbFinal.next_match_id = gfSlot.match_id;
    wbFinal.next_match_slot = 'A';

    const lbFinal = lbRounds[totalLbRounds - 1][0];
    lbFinal.next_match_id = gfSlot.match_id;
    lbFinal.next_match_slot = 'B';

    // 4. Collect initial playable matches (WB matches where both teams are known)
    const getMatchDate = (idx, total) => {
      const dayOffset = Math.floor((idx / Math.max(1, total)) * totalDays);
      return new Date(startDate.getTime() + dayOffset * 86400000).toISOString().split('T')[0];
    };

    const playable = [];
    wbRounds.forEach(rSlots => {
      rSlots.forEach(s => {
        if (!s.is_bye && s.team_a_id && s.team_b_id) playable.push(s);
      });
    });

    let matchSeq = 1;
    const matchDocs = playable.map((slot, idx) => ({
      id: slot.match_id,
      tournament_id: tournament.id,
      tournament_name: tournament.name,
      team_a_id: slot.team_a_id,
      team_b_id: slot.team_b_id,
      team_a_name: teamNameMap[slot.team_a_id] || slot.team_a_id,
      team_b_name: teamNameMap[slot.team_b_id] || slot.team_b_id,
      venue,
      match_date: getMatchDate(idx, Math.max(1, playable.length)),
      match_time: idx % 2 === 0 ? '09:30 AM' : '02:30 PM',
      match_type: matchType,
      overs_per_side: overs,
      stage: slot.stage,
      round_number: slot.round_number,
      match_number: matchSeq++,
      bracket_type: slot.bracket_type,
      bracket_slot: slot.slot_id,
      next_match_id: slot.next_match_id,
      next_match_slot: slot.next_match_slot,
      loser_next_match_id: slot.loser_next_match_id,
      loser_next_match_slot: slot.loser_next_match_slot,
      status: 'SCHEDULED',
      assigned_scorer_id: defaults.scorerId,
      assigned_scorer_name: defaults.scorerName,
      umpire1_id: defaults.umpire1Id,
      umpire2_id: defaults.umpire2Id,
      umpire1_name: defaults.umpire1Name,
      umpire2_name: defaults.umpire2Name
    }));

    return {
      bracket: {
        format: 'DOUBLE_ELIMINATION',
        team_count: n,
        bracket_size: p,
        allow_grand_final_reset: tournament.format_config?.allow_grand_final_reset !== false,
        winners_rounds: wbRounds.map((slots, idx) => ({
          round_number: idx + 1,
          name: idx === wbRoundsCount - 1 ? 'Winners Final' : `Winners Round ${idx + 1}`,
          slots
        })),
        losers_rounds: lbRounds.map((slots, idx) => ({
          round_number: idx + 1,
          name: idx === totalLbRounds - 1 ? 'Losers Final' : `Losers Round ${idx + 1}`,
          slots
        })),
        grand_final: gfSlot,
        grand_final_reset: gfResetSlot
      },
      fixtures: matchDocs
    };
  }

  /**
   * Detect scheduling conflicts across existing DB matches + proposed fixtures
   */
  async detectScheduleConflicts(fixtures = [], options = {}) {
    await db.initDb();
    const minRestHours = Number(options.min_rest_hours ?? 4);
    const minRestMinutes = minRestHours * 60;
    const matchDurationMinutes = 210; // ~3.5 hours per match slot

    const excludeTourId = options.excludeTournamentId || null;
    const query = { status: { $nin: ['COMPLETED', 'CANCELLED', 'ABANDONED', 'POSTPONED'] } };
    if (excludeTourId && options.replacingScheduled) {
      query.$or = [
        { tournament_id: { $ne: excludeTourId } },
        { tournament_id: excludeTourId, status: { $ne: 'SCHEDULED' } }
      ];
    }
    const existingMatches = await db.models.Match.find(query)
      .select('id tournament_id team_a_id team_b_id venue match_date match_time assigned_scorer_id umpire1_id umpire2_id')
      .lean();

    const combined = [
      ...existingMatches.map(m => ({ ...m, _isExisting: true })),
      ...fixtures.map(f => ({ ...f, _isExisting: false }))
    ];

    const conflicts = [];
    const warnings = [];

    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      const fStart = getMatchTimestampMinutes(f.match_date, f.match_time);
      if (fStart === null) continue;

      for (let j = 0; j < combined.length; j++) {
        const other = combined[j];
        if (other.id === f.id) continue;
        if (!other._isExisting && j <= existingMatches.length + i) continue; // avoid duplicate pair

        const oStart = getMatchTimestampMinutes(other.match_date, other.match_time);
        if (oStart === null) continue;

        const diff = Math.abs(fStart - oStart);

        // 1. Same venue overlap
        if (f.venue && other.venue && f.venue.trim().toLowerCase() === other.venue.trim().toLowerCase() && diff < matchDurationMinutes) {
          conflicts.push({
            type: 'VENUE_CONFLICT',
            match_id: f.id,
            conflicting_match_id: other.id,
            message: `Venue '${f.venue}' double-booked on ${f.match_date} (${f.match_time} vs ${other.match_time}).`
          });
        }

        // 2. Same team overlapping or insufficient rest
        const fTeams = [f.team_a_id, f.team_b_id].filter(Boolean);
        const oTeams = [other.team_a_id, other.team_b_id].filter(Boolean);
        const sharedTeams = fTeams.filter(t => oTeams.includes(t));
        if (sharedTeams.length > 0) {
          if (diff < matchDurationMinutes) {
            conflicts.push({
              type: 'TEAM_OVERLAP',
              team_id: sharedTeams[0],
              match_id: f.id,
              conflicting_match_id: other.id,
              message: `Team '${sharedTeams[0]}' has overlapping matches on ${f.match_date} (${f.match_time} vs ${other.match_time}).`
            });
          } else if (diff < minRestMinutes) {
            warnings.push({
              type: 'INSUFFICIENT_REST',
              team_id: sharedTeams[0],
              match_id: f.id,
              conflicting_match_id: other.id,
              message: `Team '${sharedTeams[0]}' has less than ${minRestHours}h rest between ${f.id} and ${other.id}.`
            });
          }
        }

        // 3. Scorer / Umpire overlap
        if (diff < matchDurationMinutes) {
          if (f.assigned_scorer_id && f.assigned_scorer_id === other.assigned_scorer_id) {
            warnings.push({
              type: 'SCORER_CONFLICT',
              match_id: f.id,
              conflicting_match_id: other.id,
              message: `Scorer '${f.assigned_scorer_id}' assigned to overlapping matches on ${f.match_date}.`
            });
          }
          const fUmpires = [f.umpire1_id, f.umpire2_id].filter(Boolean);
          const oUmpires = [other.umpire1_id, other.umpire2_id].filter(Boolean);
          const sharedUmpire = fUmpires.find(u => oUmpires.includes(u));
          if (sharedUmpire) {
            warnings.push({
              type: 'UMPIRE_CONFLICT',
              match_id: f.id,
              conflicting_match_id: other.id,
              message: `Umpire '${sharedUmpire}' assigned to overlapping matches on ${f.match_date}.`
            });
          }
        }
      }
    }

    return { conflicts, warnings };
  }

  /**
   * Preview or Generate fixtures for ALL formats
   */
  async buildFixtures(tournamentId, options = {}) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    const teams = tournament.teams || [];
    if (teams.length < 2) {
      throw { status: 400, message: `At least 2 participating teams are required (currently ${teams.length}).` };
    }

    const tournamentType = String(options.tournament_type || tournament.tournament_type || 'LEAGUE').toUpperCase();
    const roundRobinType = String(options.round_robin_type || tournament.format_config?.round_robin_type || 'SINGLE').toUpperCase();
    const isDoubleRR = roundRobinType === 'DOUBLE' || tournamentType === 'DOUBLE_ROUND_ROBIN';
    const venue = options.venue || tournament.venue || 'Kamarajar District Stadium';
    const matchType = options.match_format || tournament.match_format || 'T20';
    const overs = Number(options.overs_per_match || tournament.overs_per_match || 20);

    const startDate = new Date(options.start_date || tournament.start_date || new Date().toISOString().split('T')[0]);
    const endDate = new Date(options.end_date || tournament.end_date || new Date(startDate.getTime() + 14 * 86400000).toISOString().split('T')[0]);
    const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000));

    const [teamNameMap, defaults] = await Promise.all([
      this._resolveTeamNameMap(teams),
      this._getDefaultOfficials()
    ]);

    const prefix = sanitizeIdPart(tournament.id);
    let generatedFixtures = [];
    let bracketData = null;
    let byesSummary = [];

    const getMatchDate = (idx, total) => {
      const dayOffset = Math.floor((idx / Math.max(1, total)) * totalDays);
      return new Date(startDate.getTime() + dayOffset * 86400000).toISOString().split('T')[0];
    };

    if (tournamentType === 'DOUBLE_ELIMINATION') {
      const res = this._buildDoubleEliminationBracket(tournament, teams, teamNameMap, defaults, startDate, totalDays, venue, matchType, overs);
      generatedFixtures = res.fixtures;
      bracketData = res.bracket;
    } else if (tournamentType === 'KNOCKOUT' || tournamentType === 'SINGLE_ELIMINATION') {
      const res = this._buildSingleEliminationBracket(tournament, teams, teamNameMap, defaults, startDate, totalDays, venue, matchType, overs);
      generatedFixtures = res.fixtures;
      bracketData = res.bracket;
    } else if (tournamentType === 'GROUP_KNOCKOUT' || (tournamentType === 'LEAGUE_KNOCKOUT' && Array.isArray(tournament.groups) && tournament.groups.length > 0)) {
      let groups = (tournament.groups && tournament.groups.length > 0) ? tournament.groups : null;
      if (!groups) {
        const autoAlloc = allocateGroupsPure(teams, tournament.format_config || {});
        groups = autoAlloc.groups.map(g => ({ id: g.key, name: g.name, teams: g.teams }));
        await db.models.Tournament.updateOne({ id: tournament.id }, { $set: { groups } });
      }

      const allPairings = [];
      groups.forEach(g => {
        if ((g.teams || []).length < 2) return;
        const rounds = this._generateRoundRobinRounds(g.teams, isDoubleRR);
        rounds.forEach(rd => {
          rd.byes.forEach(b => byesSummary.push({ round: rd.round, group: g.name, team_id: b }));
          rd.matches.forEach(m => {
            allPairings.push({
              home: m.home,
              away: m.away,
              round: rd.round,
              group_id: g.id,
              group_name: g.name,
              stage: rd.isReturn ? 'GROUP_STAGE_RETURN' : 'GROUP_STAGE'
            });
          });
        });
      });

      generatedFixtures = allPairings.map((p, idx) => ({
        id: `M-${prefix}-G-${String(idx + 1).padStart(3, '0')}`,
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        team_a_id: p.home,
        team_b_id: p.away,
        team_a_name: teamNameMap[p.home] || p.home,
        team_b_name: teamNameMap[p.away] || p.away,
        venue,
        match_date: getMatchDate(idx, allPairings.length),
        match_time: idx % 2 === 0 ? '09:30 AM' : '02:30 PM',
        match_type: matchType,
        overs_per_side: overs,
        stage: p.stage,
        group_id: p.group_id,
        group_key: p.group_id,
        group_name: p.group_name,
        round_number: p.round,
        match_number: idx + 1,
        bracket_type: 'LEAGUE',
        status: 'SCHEDULED',
        assigned_scorer_id: defaults.scorerId,
        assigned_scorer_name: defaults.scorerName,
        umpire1_id: defaults.umpire1Id,
        umpire2_id: defaults.umpire2Id,
        umpire1_name: defaults.umpire1Name,
        umpire2_name: defaults.umpire2Name,
        schedule_confirmed_by: 'SYSTEM_QUALIFICATION'
      }));
    } else {
      // LEAGUE, LEAGUE_KNOCKOUT (no groups), LEAGUE_PLAYOFFS, CUSTOM
      const rounds = this._generateRoundRobinRounds(teams, isDoubleRR);
      const allPairings = [];
      rounds.forEach(rd => {
        rd.byes.forEach(b => byesSummary.push({ round: rd.round, team_id: b }));
        rd.matches.forEach(m => {
          allPairings.push({
            home: m.home,
            away: m.away,
            round: rd.round,
            stage: rd.isReturn ? 'LEAGUE_STAGE_RETURN' : 'LEAGUE_STAGE'
          });
        });
      });

      generatedFixtures = allPairings.map((p, idx) => ({
        id: `M-${prefix}-${String(idx + 1).padStart(3, '0')}`,
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        team_a_id: p.home,
        team_b_id: p.away,
        team_a_name: teamNameMap[p.home] || p.home,
        team_b_name: teamNameMap[p.away] || p.away,
        venue,
        match_date: getMatchDate(idx, allPairings.length),
        match_time: idx % 2 === 0 ? '09:30 AM' : '02:30 PM',
        match_type: matchType,
        overs_per_side: overs,
        stage: p.stage,
        round_number: p.round,
        match_number: idx + 1,
        bracket_type: 'LEAGUE',
        status: 'SCHEDULED',
        assigned_scorer_id: defaults.scorerId,
        assigned_scorer_name: defaults.scorerName,
        umpire1_id: defaults.umpire1Id,
        umpire2_id: defaults.umpire2Id,
        umpire1_name: defaults.umpire1Name,
        umpire2_name: defaults.umpire2Name,
        schedule_confirmed_by: 'SYSTEM_QUALIFICATION'
      }));
    }

    const { conflicts, warnings } = await this.detectScheduleConflicts(generatedFixtures, {
      excludeTournamentId: tournament.id,
      replacingScheduled: true,
      min_rest_hours: tournament.format_config?.min_rest_hours ?? 4
    });

    return {
      tournament,
      tournamentType,
      roundRobinType,
      fixtures: generatedFixtures,
      bracket: bracketData,
      byes: byesSummary,
      conflicts,
      warnings
    };
  }

  async previewSchedule(tournamentId, options = {}) {
    const built = await this.buildFixtures(tournamentId, options);
    return {
      success: true,
      preview: true,
      tournament_id: built.tournament.id,
      tournament_name: built.tournament.name,
      tournament_type: built.tournamentType,
      round_robin_type: built.roundRobinType,
      total_matches: built.fixtures.length,
      fixtures: built.fixtures,
      bracket: built.bracket,
      byes: built.byes,
      conflicts: built.conflicts,
      warnings: built.warnings
    };
  }

  async generateAndSaveMatches(tournamentId, options = {}, adminEmail = 'system-admin') {
    await db.initDb();
    const built = await this.buildFixtures(tournamentId, options);
    const { tournament } = built;

    const activeCount = await db.models.Match.countDocuments({
      tournament_id: tournament.id,
      status: { $in: ['LIVE', 'COMPLETED', 'INNINGS_BREAK'] }
    });
    if (activeCount > 0 && !options.force) {
      throw {
        status: 400,
        message: `Cannot regenerate fixtures: ${activeCount} match(es) have already begun or completed.`
      };
    }

    // Allow custom edited fixtures from preview if provided
    let fixturesToSave = built.fixtures;
    if (Array.isArray(options.fixtures) && options.fixtures.length > 0) {
      fixturesToSave = options.fixtures;
    }

    const { conflicts, warnings } = await this.detectScheduleConflicts(fixturesToSave, {
      excludeTournamentId: tournament.id,
      replacingScheduled: true,
      min_rest_hours: tournament.format_config?.min_rest_hours ?? 4
    });

    if (conflicts.length > 0 && !options.ignoreConflicts) {
      throw {
        status: 409,
        message: `Schedule conflict detected (${conflicts.length} conflict(s)). Resolve conflicts or pass ignoreConflicts=true.`,
        conflicts
      };
    }

    await db.models.Match.deleteMany({ tournament_id: tournament.id, status: 'SCHEDULED' });

    if (fixturesToSave.length > 0) {
      await db.models.Match.insertMany(fixturesToSave);
    }

    if (built.bracket) {
      await db.models.Tournament.findOneAndUpdate(
        { id: tournament.id },
        { $set: { bracket: built.bracket } }
      );
    }

    await this._logAudit(
      'GENERATE_MATCHES',
      adminEmail,
      tournament.name,
      `Generated ${fixturesToSave.length} matches for '${tournament.name}'`,
      `Format: ${built.tournamentType} (${built.roundRobinType}), Teams: ${(tournament.teams || []).length}`
    );

    return {
      success: true,
      tournament_id: tournament.id,
      tournament_name: tournament.name,
      total_matches_generated: fixturesToSave.length,
      fixtures: fixturesToSave,
      bracket: built.bracket,
      byes: built.byes,
      conflicts,
      warnings
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 6: TOURNAMENT PROGRESSION, BRACKET ADVANCEMENT & RESULT CORRECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute group-wise & overall standings with tie-breaker order and manual tie resolution
   */
  async getStandingsWithGroups(tournamentId, overrideMatches = null) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    const tournamentService = require('./tournamentService');
    const overallTable = await tournamentService.getPointsTable(tournamentId, tournament, null, overrideMatches);

    const groups = tournament.groups || [];
    const tieOrder = tournament.format_config?.tie_breaker_order || ['POINTS', 'NRR', 'HEAD_TO_HEAD', 'WINS'];
    const manualTies = tournament.manual_tie_breakers || [];

    const sortGroupRows = (rows, groupId, matchesForH2H) => {
      const manual = manualTies.find(mt => mt.group_id === groupId);
      const sorted = [...rows].sort((a, b) => {
        for (const criterion of tieOrder) {
          if (criterion === 'POINTS' && b.points !== a.points) return b.points - a.points;
          if (criterion === 'NRR' && b.nrr !== a.nrr) return b.nrr - a.nrr;
          if (criterion === 'WINS' && b.won !== a.won) return b.won - a.won;
          if (criterion === 'HEAD_TO_HEAD' && matchesForH2H) {
            const h2h = matchesForH2H.filter(m =>
              m.status === 'COMPLETED' &&
              ((m.team_a_id === a.team_id && m.team_b_id === b.team_id) ||
               (m.team_a_id === b.team_id && m.team_b_id === a.team_id))
            );
            let aWins = 0;
            let bWins = 0;
            h2h.forEach(m => {
              if (m.winner_id === a.team_id) aWins++;
              else if (m.winner_id === b.team_id) bWins++;
            });
            if (bWins !== aWins) return bWins - aWins;
          }
        }
        if (manual && Array.isArray(manual.resolved_order)) {
          const ia = manual.resolved_order.indexOf(a.team_id);
          const ib = manual.resolved_order.indexOf(b.team_id);
          if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
        }
        return b.points - a.points || b.nrr - a.nrr || b.won - a.won;
      });
      return sorted.map((r, idx) => ({ ...r, position: idx + 1 }));
    };

    const matches = overrideMatches || await db.models.Match.find({
      tournament_id: tournament.id,
      stage: { $in: ['LEAGUE_STAGE', 'LEAGUE_STAGE_RETURN', 'GROUP_STAGE', 'GROUP_STAGE_RETURN', 'LEAGUE'] }
    }).lean();

    if (groups.length === 0) {
      return {
        tournament_id: tournament.id,
        has_groups: false,
        overall: sortGroupRows(overallTable, 'ALL', matches),
        groups: []
      };
    }

    const rowByTeam = {};
    overallTable.forEach(r => { rowByTeam[r.team_id] = r; });

    const groupTables = groups.map(g => {
      const gRows = (g.teams || []).map(tid => rowByTeam[tid]).filter(Boolean);
      return {
        group_id: g.id,
        group_name: g.name,
        standings: sortGroupRows(gRows, g.id, matches)
      };
    });

    return {
      tournament_id: tournament.id,
      has_groups: true,
      overall: sortGroupRows(overallTable, 'ALL', matches),
      groups: groupTables
    };
  }

  async resolveManualTie(tournamentId, { groupId = 'ALL', resolvedOrder, reason = '' }, adminEmail = 'system-admin') {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };
    if (!Array.isArray(resolvedOrder) || resolvedOrder.length < 2) {
      throw { status: 400, message: 'resolvedOrder must include at least 2 team IDs.' };
    }

    const existing = (tournament.manual_tie_breakers || []).filter(m => m.group_id !== groupId);
    existing.push({
      group_id: groupId,
      resolved_order: resolvedOrder,
      resolved_by: adminEmail,
      resolved_at: new Date(),
      reason
    });

    await db.models.Tournament.findOneAndUpdate(
      { id: tournament.id },
      { $set: { manual_tie_breakers: existing } }
    );
    await this._logAudit('MANUAL_TIE_RESOLUTION', adminEmail, tournament.name, `Resolved tie for ${groupId}`, `Order: ${resolvedOrder.join(' > ')}`);
    return this.getStandingsWithGroups(tournamentId);
  }

  /**
   * Determine qualified teams from Group/League standings
   */
  async computeQualifiedTeams(tournamentId) {
    const standingsData = await this.getStandingsWithGroups(tournamentId);
    const tournament = await tournamentModel.findById(tournamentId);
    const cfg = tournament.format_config || {};

    if (!standingsData.has_groups) {
      const count = Number(cfg.qualifying_teams_count || (tournament.tournament_type === 'LEAGUE_PLAYOFFS' ? 4 : 4));
      return {
        qualified: standingsData.overall.slice(0, count),
        eliminated: standingsData.overall.slice(count)
      };
    }

    const topN = Number(cfg.top_n_per_group ?? cfg.qualifiers_per_group ?? 2);
    const bestThirdCount = Number(cfg.best_third_place_count || cfg.best_runners_up_count || 0);
    const qualified = [];
    const thirdPlacePool = [];
    const qualifiedIds = new Set();

    standingsData.groups.forEach(g => {
      g.standings.slice(0, topN).forEach(r => {
        qualified.push({ ...r, qualification_source: `${g.group_name} #${r.position}` });
        qualifiedIds.add(r.team_id);
      });
      if (bestThirdCount > 0 && g.standings[topN]) {
        thirdPlacePool.push({ ...g.standings[topN], group_name: g.group_name });
      }
    });

    if (bestThirdCount > 0 && thirdPlacePool.length > 0) {
      thirdPlacePool.sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won);
      thirdPlacePool.slice(0, bestThirdCount).forEach(r => {
        qualified.push({ ...r, qualification_source: `Best 3rd (${r.group_name})` });
        qualifiedIds.add(r.team_id);
      });
    }

    const eliminated = standingsData.overall.filter(r => !qualifiedIds.has(r.team_id));
    return { qualified, eliminated };
  }

  /**
   * Idempotent Tournament Progression Hook (called on Match COMPLETED)
   */
  async processMatchProgression(matchId) {
    await db.initDb();
    // Atomic claim to prevent concurrent double-processing
    const match = await db.models.Match.findOneAndUpdate(
      { id: matchId, status: 'COMPLETED', progression_processed: { $ne: true } },
      { $set: { progression_processed: true } },
      { new: true }
    );
    if (!match) return { skipped: true, reason: 'Already processed or not COMPLETED' };

    const tournament = await tournamentModel.findById(match.tournament_id);
    if (!tournament) return { skipped: true, reason: 'Tournament not found' };

    // Determine winner & loser
    let winnerId = match.winner_id || null;
    if (!winnerId && match.result_summary) {
      const res = match.result_summary.toLowerCase();
      if (match.team_a_name && res.includes(match.team_a_name.toLowerCase()) && res.includes('won')) winnerId = match.team_a_id;
      else if (match.team_b_name && res.includes(match.team_b_name.toLowerCase()) && res.includes('won')) winnerId = match.team_b_id;
    }
    const loserId = winnerId ? (winnerId === match.team_a_id ? match.team_b_id : match.team_a_id) : null;
    if (winnerId) {
      await db.models.Match.updateOne({ id: match.id }, { $set: { winner_id: winnerId, loser_id: loserId } });
    }

    // Sync Team.stats for participating teams
    await this._syncTeamStats([match.team_a_id, match.team_b_id]);

    const defaults = await this._getDefaultOfficials();
    const teamNameMap = await this._resolveTeamNameMap([match.team_a_id, match.team_b_id, ...(tournament.teams || [])]);

    // 1. Bracket Progression (Double Elim, Single Elim, IPL Playoffs)
    if (tournament.bracket && match.bracket_slot) {
      await this._advanceBracketMatch(tournament, match, winnerId, loserId, teamNameMap, defaults);
      return { processed: true, mode: 'BRACKET', winner_id: winnerId, loser_id: loserId };
    }

    // 2. Group / League Stage -> Auto-generate Knockout or IPL Playoffs when all league matches finish
    if (['GROUP_KNOCKOUT', 'LEAGUE_KNOCKOUT', 'LEAGUE_PLAYOFFS'].includes(tournament.tournament_type)) {
      const pendingLeague = await db.models.Match.countDocuments({
        tournament_id: tournament.id,
        bracket_type: 'LEAGUE',
        status: { $nin: ['COMPLETED', 'CANCELLED', 'ABANDONED'] }
      });
      const existingKO = await db.models.Match.countDocuments({
        tournament_id: tournament.id,
        bracket_type: { $ne: 'LEAGUE' }
      });

      if (pendingLeague === 0 && existingKO === 0) {
        await this.generateNextStageFromStandings(tournament.id, 'SYSTEM_PROGRESSION');
      }
    }

    // 3. Pure League Championship check
    if (['LEAGUE', 'SINGLE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN'].includes(tournament.tournament_type)) {
      const remaining = await db.models.Match.countDocuments({
        tournament_id: tournament.id,
        status: { $nin: ['COMPLETED', 'CANCELLED', 'ABANDONED'] }
      });
      if (remaining === 0) {
        const { overall } = await this.getStandingsWithGroups(tournament.id);
        if (overall.length > 0) {
          await this._crownChampion(tournament, overall[0].team_id, overall[0].team_name, overall[1]?.team_id || null, overall[1]?.team_name || '');
        }
      }
    }

    return { processed: true, mode: 'LEAGUE', winner_id: winnerId };
  }

  async _advanceBracketMatch(tournament, match, winnerId, loserId, teamNameMap, defaults) {
    const bracket = JSON.parse(JSON.stringify(tournament.bracket));
    const slotId = match.bracket_slot;

    // Locate slot in bracket
    let currentSlot = null;
    const allSlots = [];
    if (bracket.rounds) bracket.rounds.forEach(r => r.slots.forEach(s => allSlots.push(s)));
    if (bracket.winners_rounds) bracket.winners_rounds.forEach(r => r.slots.forEach(s => allSlots.push(s)));
    if (bracket.losers_rounds) bracket.losers_rounds.forEach(r => r.slots.forEach(s => allSlots.push(s)));
    if (bracket.grand_final) allSlots.push(bracket.grand_final);
    if (bracket.grand_final_reset) allSlots.push(bracket.grand_final_reset);

    currentSlot = allSlots.find(s => s.slot_id === slotId || s.match_id === match.id);
    if (currentSlot) {
      currentSlot.winner_id = winnerId;
      currentSlot.loser_id = loserId;
    }

    const placeTeamInSlot = async (targetMatchId, targetSlotPos, teamId) => {
      if (!targetMatchId || !teamId) return;
      const targetSlot = allSlots.find(s => s.match_id === targetMatchId);
      if (!targetSlot) return;

      if (targetSlotPos === 'A') targetSlot.team_a_id = teamId;
      else if (targetSlotPos === 'B') targetSlot.team_b_id = teamId;

      // If this LB slot expects a bye from the other feeder (WB-R1 bye), auto-advance!
      if ((targetSlot.expect_a_from_bye && targetSlot.team_b_id && !targetSlot.team_a_id) ||
          (targetSlot.expect_b_from_bye && targetSlot.team_a_id && !targetSlot.team_b_id)) {
        targetSlot.is_bye = true;
        targetSlot.winner_id = teamId;
        if (targetSlot.next_match_id) {
          await placeTeamInSlot(targetSlot.next_match_id, targetSlot.next_match_slot, teamId);
        }
        return;
      }

      // If both teams are now populated, create or update Match document
      if (targetSlot.team_a_id && targetSlot.team_b_id) {
        const existingMatch = await db.models.Match.findOne({ id: targetSlot.match_id });
        if (!existingMatch) {
          await db.models.Match.create({
            id: targetSlot.match_id,
            tournament_id: tournament.id,
            tournament_name: tournament.name,
            team_a_id: targetSlot.team_a_id,
            team_b_id: targetSlot.team_b_id,
            team_a_name: teamNameMap[targetSlot.team_a_id] || targetSlot.team_a_id,
            team_b_name: teamNameMap[targetSlot.team_b_id] || targetSlot.team_b_id,
            venue: tournament.venue || 'Kamarajar District Stadium',
            match_date: new Date().toISOString().split('T')[0],
            match_time: '02:30 PM',
            match_type: tournament.match_format || 'T20',
            overs_per_side: tournament.overs_per_match || 20,
            stage: targetSlot.stage,
            round_number: targetSlot.round_number,
            bracket_type: targetSlot.bracket_type,
            bracket_slot: targetSlot.slot_id,
            next_match_id: targetSlot.next_match_id || null,
            next_match_slot: targetSlot.next_match_slot || null,
            loser_next_match_id: targetSlot.loser_next_match_id || null,
            loser_next_match_slot: targetSlot.loser_next_match_slot || null,
            status: 'SCHEDULED',
            assigned_scorer_id: defaults.scorerId,
            assigned_scorer_name: defaults.scorerName,
            umpire1_id: defaults.umpire1Id,
            umpire2_id: defaults.umpire2Id,
            umpire1_name: defaults.umpire1Name,
            umpire2_name: defaults.umpire2Name
          });
        } else if (existingMatch.status === 'SCHEDULED') {
          existingMatch.team_a_id = targetSlot.team_a_id;
          existingMatch.team_b_id = targetSlot.team_b_id;
          existingMatch.team_a_name = teamNameMap[targetSlot.team_a_id] || targetSlot.team_a_id;
          existingMatch.team_b_name = teamNameMap[targetSlot.team_b_id] || targetSlot.team_b_id;
          await existingMatch.save();
        }
      }
    };

    // Special Handling: Double Elimination Grand Final (GF-1) & Grand Final Reset
    if (bracket.format === 'DOUBLE_ELIMINATION' && slotId === 'GF-1' && winnerId) {
      const wbChampion = bracket.grand_final.team_a_id;
      const lbChampion = bracket.grand_final.team_b_id;
      const allowReset = bracket.allow_grand_final_reset !== false;

      if (winnerId === lbChampion && allowReset) {
        // LB Champion beat WB Champion -> Trigger Grand Final Reset!
        const resetSlot = bracket.grand_final_reset;
        resetSlot.active = true;
        resetSlot.team_a_id = wbChampion;
        resetSlot.team_b_id = lbChampion;
        await db.models.Match.findOneAndUpdate(
          { id: resetSlot.match_id },
          {
            $setOnInsert: {
              id: resetSlot.match_id,
              tournament_id: tournament.id,
              tournament_name: tournament.name,
              team_a_id: wbChampion,
              team_b_id: lbChampion,
              team_a_name: teamNameMap[wbChampion] || wbChampion,
              team_b_name: teamNameMap[lbChampion] || lbChampion,
              venue: tournament.venue || 'Kamarajar District Stadium',
              match_date: new Date().toISOString().split('T')[0],
              match_time: '04:00 PM',
              match_type: tournament.match_format || 'T20',
              overs_per_side: tournament.overs_per_match || 20,
              stage: 'GRAND_FINAL_RESET',
              round_number: resetSlot.round_number,
              bracket_type: 'GRAND_FINAL_RESET',
              bracket_slot: 'GF-RESET',
              status: 'SCHEDULED',
              assigned_scorer_id: defaults.scorerId,
              assigned_scorer_name: defaults.scorerName,
              umpire1_id: defaults.umpire1Id,
              umpire2_id: defaults.umpire2Id,
              umpire1_name: defaults.umpire1Name,
              umpire2_name: defaults.umpire2Name
            }
          },
          { upsert: true }
        );
      } else {
        // WB Champion won GF-1 (or reset disabled) -> Crown Champion!
        await this._crownChampion(
          tournament,
          winnerId,
          teamNameMap[winnerId] || winnerId,
          loserId,
          teamNameMap[loserId] || loserId
        );
      }
    } else if (
      (bracket.format === 'DOUBLE_ELIMINATION' && slotId === 'GF-RESET' && winnerId) ||
      (bracket.format !== 'DOUBLE_ELIMINATION' && (!currentSlot?.next_match_id || currentSlot?.stage === 'FINAL') && winnerId)
    ) {
      await this._crownChampion(
        tournament,
        winnerId,
        teamNameMap[winnerId] || winnerId,
        loserId,
        teamNameMap[loserId] || loserId
      );
    } else {
      // Standard progression: advance winner & drop loser
      if (match.next_match_id && winnerId) {
        await placeTeamInSlot(match.next_match_id, match.next_match_slot, winnerId);
      }
      if (match.loser_next_match_id && loserId) {
        await placeTeamInSlot(match.loser_next_match_id, match.loser_next_match_slot, loserId);
      }
    }

    await db.models.Tournament.findOneAndUpdate(
      { id: tournament.id },
      { $set: { bracket } }
    );
  }

  /**
   * Generate Knockout / IPL Playoff stage from current Group/League Standings
   */
  async generateNextStageFromStandings(tournamentId, adminEmail = 'system-admin') {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    const { qualified } = await this.computeQualifiedTeams(tournamentId);
    if (qualified.length < 2) {
      throw { status: 400, message: 'Not enough qualified teams to generate knockout stage.' };
    }

    const qIds = qualified.map(q => q.team_id);
    const teamNameMap = await this._resolveTeamNameMap(qIds);
    const defaults = await this._getDefaultOfficials();
    const venue = tournament.venue || 'Kamarajar District Stadium';
    const matchType = tournament.match_format || 'T20';
    const overs = tournament.overs_per_match || 20;
    const prefix = sanitizeIdPart(tournament.id);
    const today = new Date().toISOString().split('T')[0];

    const isIplPlayoffs = tournament.tournament_type === 'LEAGUE_PLAYOFFS' ||
      tournament.format_config?.playoffs_format === 'IPL';

    if (isIplPlayoffs && qIds.length >= 4) {
      const [t1, t2, t3, t4] = qIds;
      const q1Id = `M-${prefix}-PO-Q1`;
      const elimId = `M-${prefix}-PO-ELIM`;
      const q2Id = `M-${prefix}-PO-Q2`;
      const finalId = `M-${prefix}-PO-FINAL`;

      const slots = [
        {
          slot_id: 'PO-Q1', match_id: q1Id, round_number: 1, stage: 'QUALIFIER_1', bracket_type: 'PLAYOFF_Q1',
          team_a_id: t1, team_b_id: t2, next_match_id: finalId, next_match_slot: 'A',
          loser_next_match_id: q2Id, loser_next_match_slot: 'A'
        },
        {
          slot_id: 'PO-ELIM', match_id: elimId, round_number: 1, stage: 'ELIMINATOR', bracket_type: 'PLAYOFF_ELIM',
          team_a_id: t3, team_b_id: t4, next_match_id: q2Id, next_match_slot: 'B',
          loser_next_match_id: null, loser_next_match_slot: null
        },
        {
          slot_id: 'PO-Q2', match_id: q2Id, round_number: 2, stage: 'QUALIFIER_2', bracket_type: 'PLAYOFF_Q2',
          team_a_id: null, team_b_id: null, next_match_id: finalId, next_match_slot: 'B'
        },
        {
          slot_id: 'PO-FINAL', match_id: finalId, round_number: 3, stage: 'FINAL', bracket_type: 'KNOCKOUT',
          team_a_id: null, team_b_id: null, next_match_id: null, next_match_slot: null
        }
      ];

      const initialMatches = slots.slice(0, 2).map((s, idx) => ({
        id: s.match_id,
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        team_a_id: s.team_a_id,
        team_b_id: s.team_b_id,
        team_a_name: teamNameMap[s.team_a_id] || s.team_a_id,
        team_b_name: teamNameMap[s.team_b_id] || s.team_b_id,
        venue,
        match_date: today,
        match_time: idx === 0 ? '02:30 PM' : '06:30 PM',
        match_type: matchType,
        overs_per_side: overs,
        stage: s.stage,
        round_number: s.round_number,
        bracket_type: s.bracket_type,
        bracket_slot: s.slot_id,
        next_match_id: s.next_match_id,
        next_match_slot: s.next_match_slot,
        loser_next_match_id: s.loser_next_match_id,
        loser_next_match_slot: s.loser_next_match_slot,
        status: 'SCHEDULED',
        assigned_scorer_id: defaults.scorerId,
        assigned_scorer_name: defaults.scorerName,
        umpire1_id: defaults.umpire1Id,
        umpire2_id: defaults.umpire2Id,
        umpire1_name: defaults.umpire1Name,
        umpire2_name: defaults.umpire2Name,
        schedule_confirmed_by: 'SYSTEM_QUALIFICATION'
      }));

      await db.models.Match.insertMany(initialMatches);
      const bracket = {
        format: 'IPL_PLAYOFFS',
        rounds: [
          { round_number: 1, name: 'Qualifier 1 & Eliminator', slots: [slots[0], slots[1]] },
          { round_number: 2, name: 'Qualifier 2', slots: [slots[2]] },
          { round_number: 3, name: 'Final', slots: [slots[3]] }
        ]
      };
      await db.models.Tournament.findOneAndUpdate({ id: tournament.id }, { $set: { bracket } });
      await this._logAudit('GENERATE_IPL_PLAYOFFS', adminEmail, tournament.name, 'Generated IPL Playoffs', `Teams: ${qIds.slice(0, 4).join(', ')}`);
      return { success: true, bracket, fixtures: initialMatches, qualified };
    }

    // Standard Single-Elimination Knockout from qualified teams
    const startDate = new Date();
    const res = this._buildSingleEliminationBracket(tournament, qIds, teamNameMap, defaults, startDate, 4, venue, matchType, overs);
    if (res.fixtures.length > 0) {
      res.fixtures.forEach(f => { f.schedule_confirmed_by = 'SYSTEM_QUALIFICATION'; });
      await db.models.Match.insertMany(res.fixtures);
    }
    await db.models.Tournament.findOneAndUpdate({ id: tournament.id }, { $set: { bracket: res.bracket } });
    await this._logAudit('GENERATE_KNOCKOUT_STAGE', adminEmail, tournament.name, `Generated Knockout for ${qIds.length} qualified teams`, '');
    return { success: true, bracket: res.bracket, fixtures: res.fixtures, qualified };
  }

  /**
   * Safe Result Correction / Reversal with downstream dependency protection
   */
  async reverseMatchProgression(matchId, adminEmail = 'system-admin', options = {}) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId });
    if (!match) throw { status: 404, message: `Match '${matchId}' not found.` };

    const tournament = await tournamentModel.findById(match.tournament_id);

    // Check downstream matches in bracket
    const downstreamIds = [match.next_match_id, match.loser_next_match_id].filter(Boolean);
    if (downstreamIds.length > 0) {
      const downstreamMatches = await db.models.Match.find({ id: { $in: downstreamIds } }).lean();
      const startedDownstream = downstreamMatches.filter(dm => ['LIVE', 'INNINGS_BREAK', 'PAUSED', 'COMPLETED'].includes(dm.status));
      if (startedDownstream.length > 0 && !options.force) {
        throw {
          status: 409,
          message: `Downstream dependency protection: Match '${startedDownstream[0].id}' (${startedDownstream[0].stage}) has already ${startedDownstream[0].status}. Reverse or reset downstream matches first.`
        };
      }

      // Clean up unstarted downstream SCHEDULED matches
      for (const dm of downstreamMatches) {
        if (dm.status === 'SCHEDULED') {
          if (dm.bracket_slot === 'GF-RESET') {
            await db.models.Match.deleteOne({ id: dm.id });
          } else {
            // Clear the slot team fed by this match
            const upd = {};
            if (match.next_match_id === dm.id) {
              if (match.next_match_slot === 'A') { upd.team_a_id = null; upd.team_a_name = ''; }
              else { upd.team_b_id = null; upd.team_b_name = ''; }
            }
            if (match.loser_next_match_id === dm.id) {
              if (match.loser_next_match_slot === 'A') { upd.team_a_id = null; upd.team_a_name = ''; }
              else { upd.team_b_id = null; upd.team_b_name = ''; }
            }
            await db.models.Match.deleteOne({ id: dm.id });
          }
        }
      }
    }

    // Clear bracket slot result if applicable
    if (tournament && tournament.bracket) {
      const bracket = JSON.parse(JSON.stringify(tournament.bracket));
      const allSlots = [];
      if (bracket.rounds) bracket.rounds.forEach(r => r.slots.forEach(s => allSlots.push(s)));
      if (bracket.winners_rounds) bracket.winners_rounds.forEach(r => r.slots.forEach(s => allSlots.push(s)));
      if (bracket.losers_rounds) bracket.losers_rounds.forEach(r => r.slots.forEach(s => allSlots.push(s)));
      if (bracket.grand_final) allSlots.push(bracket.grand_final);
      if (bracket.grand_final_reset) allSlots.push(bracket.grand_final_reset);

      const cur = allSlots.find(s => s.match_id === match.id);
      if (cur) {
        cur.winner_id = null;
        cur.loser_id = null;
      }
      if (match.next_match_id) {
        const nxt = allSlots.find(s => s.match_id === match.next_match_id);
        if (nxt) {
          if (match.next_match_slot === 'A') nxt.team_a_id = null;
          else if (match.next_match_slot === 'B') nxt.team_b_id = null;
        }
      }
      if (match.loser_next_match_id) {
        const lnxt = allSlots.find(s => s.match_id === match.loser_next_match_id);
        if (lnxt) {
          if (match.loser_next_match_slot === 'A') lnxt.team_a_id = null;
          else if (match.loser_next_match_slot === 'B') lnxt.team_b_id = null;
        }
      }
      if (match.bracket_slot === 'GF-1' && bracket.grand_final_reset) {
        bracket.grand_final_reset.active = false;
        bracket.grand_final_reset.team_a_id = null;
        bracket.grand_final_reset.team_b_id = null;
      }

      // Revert champion if this match was the final
      const tourUpdate = { bracket };
      if (tournament.status === 'COMPLETED' && (match.stage === 'FINAL' || match.bracket_slot === 'GF-1' || match.bracket_slot === 'GF-RESET')) {
        tourUpdate.status = 'ONGOING';
        tourUpdate.champion_team_id = null;
        tourUpdate.champion_team_name = '';
        tourUpdate.winner_team_id = null;
        tourUpdate.winner_team_name = '';
        tourUpdate.runner_up_team_id = null;
        tourUpdate.runner_up_team_name = '';
        tourUpdate.completed_at = null;
      }
      await db.models.Tournament.findOneAndUpdate({ id: tournament.id }, { $set: tourUpdate });
    }

    match.progression_processed = false;
    match.stats_processed = false;
    match.winner_id = null;
    match.loser_id = null;
    if (options.reopenMatch) {
      match.status = 'LIVE';
      match.result_summary = '';
    }
    await match.save();

    await this._syncTeamStats([match.team_a_id, match.team_b_id]);
    await this._logAudit('REVERSE_MATCH_PROGRESSION', adminEmail, match.id, 'Reversed match progression & stats', `Match: ${match.id}`);

    return { success: true, match_id: match.id, status: match.status };
  }

  async _crownChampion(tournament, championId, championName, runnerUpId, runnerUpName) {
    await db.models.Tournament.findOneAndUpdate(
      { id: tournament.id },
      {
        $set: {
          status: 'COMPLETED',
          champion_team_id: championId,
          champion_team_name: championName,
          winner_team_id: championId,
          winner_team_name: championName,
          runner_up_team_id: runnerUpId || null,
          runner_up_team_name: runnerUpName || '',
          completed_at: new Date()
        }
      }
    );

    if (championId) {
      await db.models.Team.updateOne(
        { $or: [{ id: championId }, { team_id: championId }], 'championships.tournament_id': { $ne: tournament.id } },
        {
          $push: {
            championships: {
              tournament_id: tournament.id,
              tournament_name: tournament.name,
              season: tournament.season || '2026',
              position: 'CHAMPION',
              awarded_at: new Date()
            }
          },
          $inc: { trophies_count: 1 }
        }
      );
    }
    if (runnerUpId) {
      await db.models.Team.updateOne(
        { $or: [{ id: runnerUpId }, { team_id: runnerUpId }], 'championships.tournament_id': { $ne: tournament.id } },
        {
          $push: {
            championships: {
              tournament_id: tournament.id,
              tournament_name: tournament.name,
              season: tournament.season || '2026',
              position: 'RUNNER_UP',
              awarded_at: new Date()
            }
          }
        }
      );
    }
  }

  async _syncTeamStats(teamIds = []) {
    const cleanIds = [...new Set(teamIds.filter(Boolean))];
    for (const tid of cleanIds) {
      const completed = await db.models.Match.find({
        status: 'COMPLETED',
        $or: [{ team_a_id: tid }, { team_b_id: tid }]
      }).lean();

      let won = 0, lost = 0, tied = 0, noResult = 0;
      completed.forEach(m => {
        const res = (m.result_summary || '').toLowerCase();
        if (res.includes('no result') || res.includes('abandoned')) noResult++;
        else if (res.includes('tied') && !m.winner_id) tied++;
        else if (m.winner_id === tid) won++;
        else if (m.winner_id && m.winner_id !== tid) lost++;
      });

      await db.models.Team.updateOne(
        { $or: [{ id: tid }, { team_id: tid }] },
        {
          $set: {
            'stats.matches': completed.length,
            'stats.won': won,
            'stats.lost': lost,
            'stats.tied': tied,
            'stats.no_result': noResult,
            'stats.points': won * 2 + tied + noResult
          }
        }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 8: WITHDRAWAL, ELIGIBILITY & WHAT-IF SIMULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * A. Tournament Withdrawal Handling
   */
  async withdrawTeam(tournamentId, teamId, { reason = 'Withdrew from tournament', rule = 'REMAINING_WALKOVER' } = {}, adminEmail = 'system-admin') {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    if (!(tournament.teams || []).includes(teamId)) {
      throw { status: 400, message: `Team '${teamId}' is not registered in tournament '${tournament.name}'.` };
    }

    const remainingMatches = await db.models.Match.find({
      tournament_id: tournament.id,
      status: 'SCHEDULED',
      $or: [{ team_a_id: teamId }, { team_b_id: teamId }]
    });

    let affectedCount = 0;
    for (const m of remainingMatches) {
      const opponentId = m.team_a_id === teamId ? m.team_b_id : m.team_a_id;
      const opponentName = m.team_a_id === teamId ? m.team_b_name : m.team_a_name;
      if (rule === 'REMAINING_WALKOVER' && opponentId) {
        m.status = 'COMPLETED';
        m.is_walkover = true;
        m.winner_id = opponentId;
        m.loser_id = teamId;
        m.result_summary = `${opponentName || opponentId} won by walkover (${teamId} withdrew)`;
        await m.save();
        await this.processMatchProgression(m.id);
      } else {
        m.status = 'CANCELLED';
        m.result_summary = `Match cancelled due to withdrawal of ${teamId}`;
        await m.save();
      }
      affectedCount++;
    }

    const teamNameMap = await this._resolveTeamNameMap([teamId]);
    await db.models.Tournament.findOneAndUpdate(
      { id: tournament.id },
      {
        $push: {
          withdrawn_teams: {
            team_id: teamId,
            team_name: teamNameMap[teamId] || teamId,
            withdrawn_at: new Date(),
            withdrawn_by: adminEmail,
            reason,
            rule_applied: rule
          }
        }
      }
    );

    await this._logAudit(
      'WITHDRAW_TOURNAMENT_TEAM',
      adminEmail,
      tournament.name,
      `Withdrew team '${teamId}' (${rule})`,
      `Affected scheduled matches: ${affectedCount}, Reason: ${reason}`
    );

    return {
      success: true,
      tournament_id: tournament.id,
      team_id: teamId,
      rule_applied: rule,
      affected_matches: affectedCount
    };
  }

  /**
   * B. Player Eligibility Validation
   */
  async validatePlayerEligibility(tournamentId, teamId, playerIds = null) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    const cfg = tournament.format_config || {};
    const minSquad = Number(cfg.min_squad_size || 11);
    const maxSquad = Number(cfg.max_squad_size || 18);
    const minAge = cfg.min_age != null ? Number(cfg.min_age) : (tournament.rules?.min_age != null ? Number(tournament.rules.min_age) : null);
    const maxAge = cfg.max_age != null ? Number(cfg.max_age) : (tournament.rules?.max_age != null ? Number(tournament.rules.max_age) : null);

    const teamPlayers = await db.models.Player.find({ team_id: teamId }).lean();
    const targetPlayers = playerIds
      ? teamPlayers.filter(p => playerIds.includes(p.id))
      : teamPlayers;

    const errors = [];
    const warnings = [];

    if (targetPlayers.length < minSquad) {
      errors.push(`Squad size (${targetPlayers.length}) is below tournament minimum (${minSquad}).`);
    }
    if (targetPlayers.length > maxSquad) {
      errors.push(`Squad size (${targetPlayers.length}) exceeds tournament maximum (${maxSquad}).`);
    }

    const calcAgeYears = (dobValue) => {
      if (!dobValue) return null;
      const dob = new Date(dobValue);
      if (Number.isNaN(dob.getTime())) return null;
      const refDate = tournament.start_date ? new Date(tournament.start_date) : new Date();
      let age = refDate.getFullYear() - dob.getFullYear();
      const mDiff = refDate.getMonth() - dob.getMonth();
      if (mDiff < 0 || (mDiff === 0 && refDate.getDate() < dob.getDate())) age--;
      return age;
    };

    // Check inactive/suspended players and age restrictions
    targetPlayers.forEach(p => {
      if (p.status && !['ACTIVE', 'APPROVED'].includes(String(p.status).toUpperCase())) {
        errors.push(`Player '${p.name}' (${p.id}) is not ACTIVE (status: ${p.status}).`);
      }
      if (minAge !== null || maxAge !== null) {
        const age = p.age != null ? Number(p.age) : calcAgeYears(p.date_of_birth);
        if (age === null || Number.isNaN(age)) {
          warnings.push(`Player '${p.name}' (${p.id}) has no date of birth/age on file to verify tournament age limit.`);
        } else {
          if (minAge !== null && age < minAge) {
            errors.push(`Player '${p.name}' (${p.id}) age ${age} is below minimum age (${minAge}).`);
          }
          if (maxAge !== null && age > maxAge) {
            errors.push(`Player '${p.name}' (${p.id}) age ${age} exceeds maximum age (${maxAge}).`);
          }
        }
      }
    });

    // Check duplicate player registration (email, aadhaar, mobile) across other teams in the same tournament
    const otherTeamIds = (tournament.teams || []).filter(tid => tid !== teamId);
    if (otherTeamIds.length > 0 && targetPlayers.length > 0) {
      const otherPlayers = await db.models.Player.find({ team_id: { $in: otherTeamIds } }).lean();
      const otherEmails = new Map();
      const otherAadhaars = new Map();
      const otherPhones = new Map();
      otherPlayers.forEach(op => {
        if (op.email) otherEmails.set(String(op.email).trim().toLowerCase(), op);
        const aadhaar = String(op.aadhaar || '').replace(/\D/g, '');
        if (aadhaar.length === 12) otherAadhaars.set(aadhaar, op);
        const phone = String(op.mobile || op.phone || '').replace(/\D/g, '').slice(-10);
        if (phone.length === 10) otherPhones.set(phone, op);
      });
      targetPlayers.forEach(p => {
        if (p.email && otherEmails.has(String(p.email).trim().toLowerCase())) {
          const dup = otherEmails.get(String(p.email).trim().toLowerCase());
          errors.push(`Player '${p.name}' (${p.email}) is already registered with another team (${dup.team_id}) in this tournament.`);
        }
        const aadhaar = String(p.aadhaar || '').replace(/\D/g, '');
        if (aadhaar.length === 12 && otherAadhaars.has(aadhaar)) {
          const dup = otherAadhaars.get(aadhaar);
          errors.push(`Player '${p.name}' Aadhaar matches another registered player in team (${dup.team_id}) in this tournament.`);
        }
        const phone = String(p.mobile || p.phone || '').replace(/\D/g, '').slice(-10);
        if (phone.length === 10 && otherPhones.has(phone)) {
          const dup = otherPhones.get(phone);
          errors.push(`Player '${p.name}' phone matches another registered player in team (${dup.team_id}) in this tournament.`);
        }
      });
    }

    // Check player transfer restriction: cannot transfer after appearing in a LIVE/COMPLETED match for another team in this tournament
    if (targetPlayers.length > 0) {
      const tourMatches = await db.models.Match.find({
        tournament_id: tournament.id,
        status: { $in: ['LIVE', 'COMPLETED'] }
      }).select('id').lean();
      const tourMatchIds = tourMatches.map(m => m.id);
      if (tourMatchIds.length > 0) {
        const targetIds = targetPlayers.map(p => p.id);
        const inningsDocs = await db.models.Innings.find({ match_id: { $in: tourMatchIds } })
          .select('batting_team_id bowling_team_id batting_stats bowling_stats')
          .lean();
        const playedForOtherTeam = new Map();
        for (const inn of inningsDocs) {
          for (const b of (inn.batting_stats || [])) {
            if (targetIds.includes(b.player_id) && inn.batting_team_id && inn.batting_team_id !== teamId) {
              playedForOtherTeam.set(b.player_id, inn.batting_team_id);
            }
          }
          for (const bw of (inn.bowling_stats || [])) {
            if (targetIds.includes(bw.player_id) && inn.bowling_team_id && inn.bowling_team_id !== teamId) {
              playedForOtherTeam.set(bw.player_id, inn.bowling_team_id);
            }
          }
        }
        targetPlayers.forEach(p => {
          if (playedForOtherTeam.has(p.id)) {
            errors.push(`Transfer restricted: Player '${p.name}' (${p.id}) has already played in this tournament for team '${playedForOtherTeam.get(p.id)}'.`);
          }
        });
      }
    }

    return {
      success: errors.length === 0,
      eligible: errors.length === 0,
      tournament_id: tournament.id,
      team_id: teamId,
      checked_players_count: targetPlayers.length,
      errors,
      warnings
    };
  }

  /**
   * C. Tournament What-If Simulator (Strictly read-only; never mutates DB)
   */
  async simulateWhatIf(tournamentId, simulatedResults = []) {
    await db.initDb();
    const tournament = await tournamentModel.findById(tournamentId);
    if (!tournament) throw { status: 404, message: `Tournament '${tournamentId}' not found.` };

    const realMatches = await db.models.Match.find({ tournament_id: tournament.id }).lean();
    const simMap = {};
    (simulatedResults || []).forEach(sr => {
      if (sr && sr.match_id) simMap[sr.match_id] = sr;
    });

    // Build cloned match list with simulated outcomes applied in-memory
    const simulatedMatches = realMatches.map(m => {
      const sim = simMap[m.id];
      if (!sim || m.status === 'COMPLETED') return m;
      const winnerName = sim.winner_id === m.team_a_id ? m.team_a_name : m.team_b_name;
      return {
        ...m,
        status: 'COMPLETED',
        winner_id: sim.winner_id || null,
        result_summary: sim.winner_id
          ? `${winnerName || sim.winner_id} won (Simulated)`
          : (sim.is_tie ? 'Match Tied (Simulated)' : 'No Result (Simulated)')
      };
    });

    const projected = await this.getStandingsWithGroups(tournamentId, simulatedMatches);

    // Compute remaining matches per team to determine mathematical qualification / elimination
    const remainingByTeam = {};
    (tournament.teams || []).forEach(tid => { remainingByTeam[tid] = 0; });
    simulatedMatches.forEach(m => {
      if (m.status === 'SCHEDULED' || m.status === 'POSTPONED') {
        if (remainingByTeam[m.team_a_id] !== undefined) remainingByTeam[m.team_a_id]++;
        if (remainingByTeam[m.team_b_id] !== undefined) remainingByTeam[m.team_b_id]++;
      }
    });

    const pointsWin = Number(tournament.points_win ?? 2);
    const qualCount = Number(tournament.format_config?.qualifying_teams_count || 4);
    const cutoffPoints = projected.overall[qualCount - 1]?.points ?? 0;

    const annotatedOverall = projected.overall.map(row => {
      const rem = remainingByTeam[row.team_id] || 0;
      const maxPossiblePoints = row.points + rem * pointsWin;
      let status = 'IN_CONTENTION';
      if (maxPossiblePoints < cutoffPoints) status = 'MATHEMATICALLY_ELIMINATED';
      else if (row.position <= qualCount && rem === 0) status = 'QUALIFIED';
      else if (row.position <= qualCount) status = 'PROJECTED_QUALIFIER';
      return {
        ...row,
        remaining_matches: rem,
        max_possible_points: maxPossiblePoints,
        qualification_status: status
      };
    });

    return {
      success: true,
      is_simulation: true,
      tournament_id: tournament.id,
      tournament_name: tournament.name,
      simulated_match_count: Object.keys(simMap).length,
      projected_standings: annotatedOverall,
      projected_groups: projected.groups
    };
  }
}

const BYE_TOKEN = '__BYE__';

/**
 * Circle Method (Berger Table) Round-Robin Scheduler.
 * Guarantees:
 *  - Every pair plays once (or twice if doubleLeg=true)
 *  - No team plays more than once in the same round
 *  - Odd team counts receive balanced 1 Bye per round (never emits fake BYE fixtures)
 */
function generateRoundRobinRounds(teams = [], { doubleLeg = false, stagePrefix = 'LEAGUE_STAGE' } = {}) {
  const cleanTeams = Array.from(new Set(teams.filter(Boolean)));
  const n = cleanTeams.length;
  if (n < 2) {
    return { rounds: [], pairings: [], byes: [], totalRounds: 0, totalMatches: 0 };
  }

  const list = [...cleanTeams];
  const hasBye = n % 2 === 1;
  if (hasBye) list.push(BYE_TOKEN);

  const m = list.length; // always even
  const numRoundsPerLeg = m - 1;
  const fixed = list[0];
  let rotating = list.slice(1); // length m - 1

  const rounds = [];
  const pairings = [];
  const byes = [];

  for (let r = 0; r < numRoundsPerLeg; r++) {
    const roundList = [fixed, ...rotating];
    const roundMatches = [];
    let roundByeTeam = null;

    for (let i = 0; i < m / 2; i++) {
      const t1 = roundList[i];
      const t2 = roundList[m - 1 - i];
      if (t1 === BYE_TOKEN) {
        roundByeTeam = t2;
      } else if (t2 === BYE_TOKEN) {
        roundByeTeam = t1;
      } else {
        // Alternate home/away for fixed team across rounds for fairness
        const home = (i === 0 && r % 2 === 1) ? t2 : t1;
        const away = (i === 0 && r % 2 === 1) ? t1 : t2;
        const matchObj = {
          home,
          away,
          round: r + 1,
          leg: 1,
          stage: stagePrefix
        };
        roundMatches.push(matchObj);
        pairings.push(matchObj);
      }
    }

    if (roundByeTeam) {
      byes.push({ round: r + 1, leg: 1, team_id: roundByeTeam, stage: stagePrefix });
    }
    rounds.push({ round: r + 1, leg: 1, stage: stagePrefix, matches: roundMatches, bye: roundByeTeam });

    // Rotate clockwise: last element moves to front of rotating array
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  if (doubleLeg) {
    const leg1Count = rounds.length;
    for (let r = 0; r < leg1Count; r++) {
      const src = rounds[r];
      const returnRoundNum = leg1Count + r + 1;
      const returnStage = stagePrefix === 'LEAGUE_STAGE' ? 'LEAGUE_STAGE_RETURN' : stagePrefix;
      const returnMatches = src.matches.map(pm => {
        const mObj = {
          home: pm.away,
          away: pm.home,
          round: returnRoundNum,
          leg: 2,
          stage: returnStage
        };
        pairings.push(mObj);
        return mObj;
      });
      if (src.bye) {
        byes.push({ round: returnRoundNum, leg: 2, team_id: src.bye, stage: returnStage });
      }
      rounds.push({ round: returnRoundNum, leg: 2, stage: returnStage, matches: returnMatches, bye: src.bye });
    }
  }

  return {
    rounds,
    pairings,
    byes,
    totalRounds: rounds.length,
    totalMatches: pairings.length
  };
}

/**
 * Determine canonical Knockout stage name from bracket size (power of 2)
 */
function getKnockoutStageName(bracketSize) {
  if (bracketSize <= 2) return 'FINAL';
  if (bracketSize <= 4) return 'SEMI_FINAL';
  if (bracketSize <= 8) return 'QUARTER_FINAL';
  if (bracketSize <= 16) return 'ROUND_OF_16';
  if (bracketSize <= 32) return 'ROUND_OF_32';
  return `ROUND_OF_${bracketSize}`;
}

/**
 * Next Knockout stage name after a given stage
 */
function getNextKnockoutStageName(currentStage) {
  const order = ['PRELIMINARY', 'ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];
  const idx = order.indexOf(currentStage);
  if (idx === -1 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

/**
 * Power-of-2 Single Elimination Round 1 Generator.
 * Example (5 teams):
 *   bracketSize = 8, byesCount = 3 (top 3 seeds advance directly to SEMI_FINAL),
 *   preliminary matches = 1 (Seed 4 vs Seed 5 in PRELIMINARY / QUARTER_FINAL R1).
 * Never emits fake BYE matches.
 */
function generateSingleEliminationRound1(teams = [], { seeding = 'AS_IS', doubleElimination = false } = {}) {
  const cleanTeams = Array.from(new Set(teams.filter(Boolean)));
  const n = cleanTeams.length;
  if (n < 2) {
    return { bracketSize: 0, byesCount: 0, byes: [], stageName: 'FINAL', pairings: [], totalExpectedMatches: 0 };
  }

  let ordered = [...cleanTeams];
  if (seeding === 'RANDOM') {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
  }

  let bracketSize = 1;
  while (bracketSize < n) bracketSize *= 2;
  const byesCount = bracketSize - n;
  const byeTeams = ordered.slice(0, byesCount);
  const playingTeams = ordered.slice(byesCount); // always even: 2 * (n - bracketSize/2)

  // Stage name for Round 1: if byes exist, Round 1 feeds into getKnockoutStageName(bracketSize / 2)
  // Wait: e.g. 5 teams -> bracketSize=8 -> Round 1 is QUARTER_FINAL (with 3 byes + 1 match), next is SEMI_FINAL (4 teams), then FINAL (2 teams).
  // Or if no byes (e.g. 8 teams), Round 1 is QUARTER_FINAL (4 matches), next is SEMI_FINAL, then FINAL.
  const baseStage = getKnockoutStageName(bracketSize);
  const stageName = doubleElimination ? 'WINNERS_BRACKET_R1' : baseStage;

  const pairings = [];
  const pLen = playingTeams.length;
  for (let i = 0; i < pLen / 2; i++) {
    pairings.push({
      home: playingTeams[i],
      away: playingTeams[pLen - 1 - i],
      round: 1,
      stage: stageName,
      bracket: doubleElimination ? 'WINNERS' : 'MAIN'
    });
  }

  const byes = byeTeams.map((teamId, idx) => ({
    round: 1,
    seed: idx + 1,
    team_id: teamId,
    stage: baseStage,
    advances_to: getNextKnockoutStageName(baseStage) || 'FINAL'
  }));

  return {
    bracketSize,
    byesCount,
    byes,
    stageName,
    pairings,
    totalExpectedMatches: n - 1
  };
}

/**
 * Group Allocation Engine.
 * Supports: BALANCED, RANDOM, SEEDED (snake draft), MANUAL.
 * Supports uneven group counts without ever dropping or duplicating teams.
 */
function allocateGroupsPure(teams = [], formatConfig = {}) {
  const cleanTeams = Array.from(new Set(teams.filter(Boolean)));
  const n = cleanTeams.length;
  if (n < 2) return { groups: [], groupCount: 0 };

  const baseGroupCount = Math.max(1, Number(formatConfig.group_count || 2));
  const teamsPerGroup = Math.max(2, Number(formatConfig.teams_per_group || 8));
  const allowExtra = formatConfig.allow_extra_group !== false;
  let effectiveGroupCount = (allowExtra && n > baseGroupCount * teamsPerGroup)
    ? baseGroupCount + 1
    : baseGroupCount;
  // Never create more groups than floor(n / 2) so every group has >= 2 teams
  effectiveGroupCount = Math.max(1, Math.min(effectiveGroupCount, Math.floor(n / 2) || 1));

  const customNames = Array.isArray(formatConfig.group_names) ? formatConfig.group_names : [];
  const distribution = String(formatConfig.group_distribution || 'BALANCED').toUpperCase();

  const makeGroup = (gIdx) => ({
    key: `GROUP_${String.fromCharCode(65 + gIdx)}`,
    label: (customNames[gIdx] && String(customNames[gIdx]).trim()) || `Group ${String.fromCharCode(65 + gIdx)}`,
    teams: []
  });

  if (distribution === 'MANUAL' && formatConfig.manual_groups && typeof formatConfig.manual_groups === 'object') {
    const manualEntries = Object.entries(formatConfig.manual_groups);
    const groups = manualEntries.map(([key, list], gIdx) => ({
      key: String(key).toUpperCase().startsWith('GROUP_') ? String(key).toUpperCase() : `GROUP_${String.fromCharCode(65 + gIdx)}`,
      label: (customNames[gIdx] && String(customNames[gIdx]).trim()) || String(key).replace(/_/g, ' '),
      teams: Array.isArray(list) ? Array.from(new Set(list.filter(id => cleanTeams.includes(id)))) : []
    }));

    // Ensure no team from cleanTeams is missing or duplicated across groups
    const placed = new Set();
    groups.forEach(g => {
      g.teams = g.teams.filter(id => {
        if (placed.has(id)) return false;
        placed.add(id);
        return true;
      });
    });
    const unplaced = cleanTeams.filter(id => !placed.has(id));
    unplaced.forEach((id, idx) => {
      if (groups.length > 0) groups[idx % groups.length].teams.push(id);
    });
    const nonEmpty = groups.filter(g => g.teams.length > 0);
    if (nonEmpty.length > 0) {
      return { groups: nonEmpty, groupCount: nonEmpty.length, distribution: 'MANUAL' };
    }
  }

  const groups = Array.from({ length: effectiveGroupCount }, (_, i) => makeGroup(i));
  const ordered = [...cleanTeams];

  if (distribution === 'RANDOM') {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
  }

  if (distribution === 'SEEDED') {
    // Snake draft: 0,1,2,...,k-1, k-1,...,2,1,0
    ordered.forEach((teamId, idx) => {
      const cycle = Math.floor(idx / effectiveGroupCount);
      const pos = idx % effectiveGroupCount;
      const gIdx = cycle % 2 === 0 ? pos : (effectiveGroupCount - 1 - pos);
      groups[gIdx].teams.push(teamId);
    });
  } else {
    // Balanced round-robin distribution (guarantees difference of at most 1 team between groups)
    ordered.forEach((teamId, idx) => {
      groups[idx % effectiveGroupCount].teams.push(teamId);
    });
  }

  return { groups, groupCount: effectiveGroupCount, distribution };
}

/**
 * Convert cricket overs (e.g. 19.3 or overs=19, balls=3) into exact mathematical decimal overs (19.5).
 * When all out, cricket NRR rules charge the full allotted overs quota.
 */
function toDecimalOvers(oversVal, ballsVal = 0, isAllOut = false, maxOvers = 20) {
  if (isAllOut && maxOvers > 0) return maxOvers;
  const o = typeof oversVal === 'number' ? oversVal : parseFloat(oversVal || 0);
  const b = typeof ballsVal === 'number' ? ballsVal : parseFloat(ballsVal || 0);
  const wholeOvers = Math.floor(o);
  const remainderBalls = Math.round((o - wholeOvers) * 10) || b;
  return wholeOvers + (remainderBalls / 6);
}

/**
 * Compute Standings & NRR for a set of teams and completed matches,
 * applying configurable tie-breaker order and detecting unresolved ties.
 */
function computeStandings(teams = [], matches = [], inningsByMatch = {}, tournament = {}, options = {}) {
  const pointsWin = Number(tournament.points_win !== undefined ? tournament.points_win : 2);
  const pointsLoss = Number(tournament.points_loss !== undefined ? tournament.points_loss : 0);
  const pointsTie = Number(tournament.points_tie !== undefined ? tournament.points_tie : 1);
  const pointsNoResult = Number(tournament.points_no_result !== undefined ? tournament.points_no_result : 1);
  const pointsBonusWin = Number(tournament.points_bonus_win !== undefined ? tournament.points_bonus_win : 0);
  const pointsBonusLoss = Number(tournament.points_bonus_loss !== undefined ? tournament.points_bonus_loss : 0);
  const pointsWalkoverWin = Number(tournament.points_walkover_win !== undefined ? tournament.points_walkover_win : pointsWin);
  const pointsWalkoverLoss = Number(tournament.points_walkover_loss !== undefined ? tournament.points_walkover_loss : pointsLoss);

  const standings = {};
  teams.forEach(t => {
    standings[t.id] = {
      team_id: t.id,
      team_name: t.name || t.id,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      no_result: 0,
      points: 0,
      runs_scored: 0,
      runs_for: 0,
      overs_faced: 0,
      runs_conceded: 0,
      runs_against: 0,
      overs_bowled: 0,
      nrr: 0.000,
      form: []
    };
  });

  const getMaxWickets = (inn, m) => {
    if (!m) return 10;
    const isTeamA = inn?.batting_team_id === m.team_a_id;
    const lineup = isTeamA ? (m.team_a_playing_xi || m.team_a_lineup) : (m.team_b_playing_xi || m.team_b_lineup);
    if (Array.isArray(lineup) && lineup.length > 1) return Math.max(1, lineup.length - 1);
    if (m.players_per_side && m.players_per_side > 1) return Math.max(1, m.players_per_side - 1);
    return 10;
  };

  // Track head-to-head results between pairs: h2h[teamA][teamB] = net wins
  const h2h = {};
  const recordH2H = (w, l) => {
    if (!h2h[w]) h2h[w] = {};
    if (!h2h[l]) h2h[l] = {};
    h2h[w][l] = (h2h[w][l] || 0) + 1;
    h2h[l][w] = (h2h[l][w] || 0) - 1;
  };

  matches.forEach(m => {
    const teamA = m.team_a_id;
    const teamB = m.team_b_id;
    if (!standings[teamA]) {
      standings[teamA] = {
        team_id: teamA, team_name: m.team_a_name || teamA,
        played: 0, won: 0, lost: 0, tied: 0, no_result: 0, points: 0,
        runs_scored: 0, runs_for: 0, overs_faced: 0,
        runs_conceded: 0, runs_against: 0, overs_bowled: 0, nrr: 0.000, form: []
      };
    }
    if (!standings[teamB]) {
      standings[teamB] = {
        team_id: teamB, team_name: m.team_b_name || teamB,
        played: 0, won: 0, lost: 0, tied: 0, no_result: 0, points: 0,
        runs_scored: 0, runs_for: 0, overs_faced: 0,
        runs_conceded: 0, runs_against: 0, overs_bowled: 0, nrr: 0.000, form: []
      };
    }

    standings[teamA].played++;
    standings[teamB].played++;

    let winner = null;
    let isTie = false;
    let isNoResult = false;

    if (m.winner_id) {
      if (m.winner_id === teamA) winner = teamA;
      else if (m.winner_id === teamB) winner = teamB;
      else if (m.winner_id === 'TIE' || m.winner_id === 'MATCH_TIED') isTie = true;
      else if (m.winner_id === 'NO_RESULT' || m.winner_id === 'ABANDONED') isNoResult = true;
    }

    if (!winner && !isTie && !isNoResult) {
      const res = (m.result_summary || '').toLowerCase();
      const teamAName = (m.team_a_name || '').toLowerCase().trim();
      const teamBName = (m.team_b_name || '').toLowerCase().trim();
      if (res.includes('tied') || res.includes('match tied')) isTie = true;
      else if (res.includes('no result') || res.includes('abandoned') || res.includes('cancelled')) isNoResult = true;
      else {
        const candidates = [
          { id: teamA, name: teamAName },
          { id: teamB, name: teamBName }
        ].sort((a, b) => b.name.length - a.name.length);
        for (const cand of candidates) {
          if (cand.name && res.includes(cand.name) && res.includes('won')) {
            winner = cand.id;
            break;
          }
        }
        if (!winner && res.includes('won by')) {
          const mInns = inningsByMatch[m.id] || [];
          const i1 = mInns.find(i => i.innings_number === 1);
          const i2 = mInns.find(i => i.innings_number === 2);
          if (i1 && i2) {
            if (i1.total_runs > i2.total_runs) winner = i1.batting_team_id;
            else if (i2.total_runs > i1.total_runs) winner = i2.batting_team_id;
            else isTie = true;
          }
        }
      }
    }

    if (isTie) {
      standings[teamA].tied++;
      standings[teamB].tied++;
      standings[teamA].points += pointsTie;
      standings[teamB].points += pointsTie;
      standings[teamA].form.push('T');
      standings[teamB].form.push('T');
    } else if (isNoResult) {
      standings[teamA].no_result++;
      standings[teamB].no_result++;
      standings[teamA].points += pointsNoResult;
      standings[teamB].points += pointsNoResult;
      standings[teamA].form.push('NR');
      standings[teamB].form.push('NR');
    } else if (winner === teamA || winner === teamB) {
      const loser = winner === teamA ? teamB : teamA;
      standings[winner].won++;
      standings[loser].lost++;
      recordH2H(winner, loser);
      if (m.is_walkover) {
        standings[winner].points += pointsWalkoverWin;
        standings[loser].points += pointsWalkoverLoss;
      } else {
        standings[winner].points += pointsWin + (m.bonus_point_winner ? pointsBonusWin : 0);
        standings[loser].points += pointsLoss + (m.bonus_point_loser_penalty ? pointsBonusLoss : 0);
      }
      standings[winner].form.push('W');
      standings[loser].form.push('L');
    } else {
      standings[teamA].no_result++;
      standings[teamB].no_result++;
      standings[teamA].points += pointsNoResult;
      standings[teamB].points += pointsNoResult;
      standings[teamA].form.push('NR');
      standings[teamB].form.push('NR');
    }

    if (isNoResult || m.status === 'ABANDONED' || m.status === 'CANCELLED') {
      return;
    }

    const matchInns = inningsByMatch[m.id] || [];
    const inn2 = matchInns.find(i => i.innings_number === 2);
    const isDlsOrRevised = Boolean(m.revised_target || m.revised_overs || inn2?.revised_overs);
    const revisedOvers = m.revised_overs || inn2?.revised_overs || null;
    const revisedTarget = m.revised_target || inn2?.target || null;

    matchInns.forEach(inn => {
      const batTeam = inn.batting_team_id;
      const bowlTeam = inn.bowling_team_id;
      const maxWickets = getMaxWickets(inn, m);
      const isAllOut = inn.wickets >= maxWickets;
      const teamQuota = batTeam === m.team_a_id ? m.team_a_overs : m.team_b_overs;
      const standardMaxOvers = inn.revised_overs || teamQuota || m.overs_per_side || tournament.overs_per_match || 20;

      let runsScored = inn.total_runs || 0;
      let decOvers = 0;

      if (isDlsOrRevised && revisedOvers && inn.innings_number === 1) {
        runsScored = revisedTarget ? Math.max(0, revisedTarget - 1) : runsScored;
        decOvers = revisedOvers;
      } else if (isDlsOrRevised && revisedOvers && inn.innings_number === 2) {
        decOvers = toDecimalOvers(inn.overs, inn.balls, isAllOut, revisedOvers);
      } else {
        decOvers = toDecimalOvers(inn.overs, inn.balls, isAllOut, standardMaxOvers);
      }

      if (standings[batTeam]) {
        standings[batTeam].runs_scored += runsScored;
        standings[batTeam].runs_for += runsScored;
        standings[batTeam].overs_faced += decOvers;
      }
      if (standings[bowlTeam]) {
        standings[bowlTeam].runs_conceded += runsScored;
        standings[bowlTeam].runs_against += runsScored;
        standings[bowlTeam].overs_bowled += decOvers;
      }
    });
  });

  const rows = Object.values(standings).map(row => {
    const runRateFor = row.overs_faced > 0 ? (row.runs_scored / row.overs_faced) : 0;
    const runRateAgainst = row.overs_bowled > 0 ? (row.runs_conceded / row.overs_bowled) : 0;
    const nrr = parseFloat((runRateFor - runRateAgainst).toFixed(3));
    return {
      ...row,
      overs_faced: parseFloat(row.overs_faced.toFixed(3)),
      overs_bowled: parseFloat(row.overs_bowled.toFixed(3)),
      nrr: isNaN(nrr) ? 0.000 : nrr,
      nrr_formatted: (nrr > 0 ? `+${nrr.toFixed(3)}` : `${nrr.toFixed(3)}`),
      recent_form: row.form.slice(-5)
    };
  });

  const tieOrder = Array.isArray(options.tieBreakerOrder || tournament.format_config?.tie_breaker_order)
    ? (options.tieBreakerOrder || tournament.format_config.tie_breaker_order)
    : ['POINTS', 'WINS', 'NRR', 'HEAD_TO_HEAD'];

  // Apply manual admin tie-resolution overrides if provided
  const manualOverrides = options.manualTieResolution || {};

  const compareRows = (a, b) => {
    for (const rule of tieOrder) {
      if (rule === 'POINTS' && b.points !== a.points) return b.points - a.points;
      if (rule === 'WINS' && b.won !== a.won) return b.won - a.won;
      if (rule === 'NRR' && b.nrr !== a.nrr) return b.nrr - a.nrr;
      if (rule === 'HEAD_TO_HEAD') {
        const diff = (h2h[b.team_id]?.[a.team_id] || 0);
        if (diff !== 0) return diff;
      }
    }
    if (manualOverrides[a.team_id] !== undefined && manualOverrides[b.team_id] !== undefined) {
      return manualOverrides[a.team_id] - manualOverrides[b.team_id];
    }
    return 0;
  };

  rows.sort(compareRows);

  return rows.map((r, index) => ({
    position: index + 1,
    ...r
  }));
}

/**
 * Check if two adjacent rows are completely tied on all tie-breakers
 */
function areStandingsTied(a, b, h2hDiff = 0) {
  return (
    a.points === b.points &&
    a.won === b.won &&
    a.nrr === b.nrr &&
    h2hDiff === 0
  );
}

/**
 * Automatic Qualification Engine for Group Stage -> Knockout.
 * Supports:
 *  - qualifiersPerGroup (e.g. Top 1 or Top 2 from each group)
 *  - bestRunnersUpCount (e.g. 6 group winners + 2 best runners-up = 8 qualifiers)
 *  - Detects unresolved ties on the qualification cutoff and flags them for Admin resolution!
 */
function computeGroupQualifiers(groupStandingsMap = {}, formatConfig = {}) {
  const qualifiersPerGroup = Math.max(1, Number(formatConfig.qualifiers_per_group || 1));
  const bestRunnersUpCount = Math.max(0, Number(formatConfig.best_runners_up_count ?? formatConfig.best_third_place_count ?? 0));
  const manualOverrides = formatConfig.manual_groups_tie_resolution || {};
  const isManuallyResolved = (a, b) =>
    manualOverrides[a.team_id] !== undefined &&
    manualOverrides[b.team_id] !== undefined &&
    manualOverrides[a.team_id] !== manualOverrides[b.team_id];

  const qualified = [];
  const qualifiedSet = new Set();
  const runnerUpPool = [];
  const unresolvedTies = [];

  const groupKeys = Object.keys(groupStandingsMap).sort();

  for (const gKey of groupKeys) {
    const rows = groupStandingsMap[gKey] || [];
    if (rows.length === 0) continue;

    // Check cutoff tie inside group
    if (rows.length > qualifiersPerGroup) {
      const lastIn = rows[qualifiersPerGroup - 1];
      const firstOut = rows[qualifiersPerGroup];
      if (areStandingsTied(lastIn, firstOut) && !isManuallyResolved(lastIn, firstOut)) {
        unresolvedTies.push({
          scope: gKey,
          reason: `Tie at qualification cutoff in ${gKey} (${lastIn.team_name} vs ${firstOut.team_name})`,
          teams: [lastIn.team_id, firstOut.team_id]
        });
      }
    }

    for (let i = 0; i < Math.min(qualifiersPerGroup, rows.length); i++) {
      const r = rows[i];
      if (!qualifiedSet.has(r.team_id)) {
        qualifiedSet.add(r.team_id);
        qualified.push({
          team_id: r.team_id,
          team_name: r.team_name,
          group_key: gKey,
          group_position: r.position,
          points: r.points,
          won: r.won,
          nrr: r.nrr,
          qualification_source: `${gKey}_POS_${r.position}`
        });
      }
    }

    // Next-best team(s) eligible for Best Runners-Up wildcard
    if (bestRunnersUpCount > 0 && rows.length > qualifiersPerGroup) {
      const candidate = rows[qualifiersPerGroup];
      if (!qualifiedSet.has(candidate.team_id)) {
        runnerUpPool.push({ ...candidate, group_key: gKey });
      }
    }
  }

  if (bestRunnersUpCount > 0 && runnerUpPool.length > 0) {
    runnerUpPool.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      return b.nrr - a.nrr;
    });

    if (runnerUpPool.length > bestRunnersUpCount) {
      const lastIn = runnerUpPool[bestRunnersUpCount - 1];
      const firstOut = runnerUpPool[bestRunnersUpCount];
      if (areStandingsTied(lastIn, firstOut) && !isManuallyResolved(lastIn, firstOut)) {
        unresolvedTies.push({
          scope: 'BEST_RUNNERS_UP',
          reason: `Tie for Best Runner-Up spot (${lastIn.team_name} vs ${firstOut.team_name})`,
          teams: [lastIn.team_id, firstOut.team_id]
        });
      }
    }

    for (let i = 0; i < Math.min(bestRunnersUpCount, runnerUpPool.length); i++) {
      const r = runnerUpPool[i];
      if (!qualifiedSet.has(r.team_id)) {
        qualifiedSet.add(r.team_id);
        qualified.push({
          team_id: r.team_id,
          team_name: r.team_name,
          group_key: r.group_key,
          group_position: r.position,
          points: r.points,
          won: r.won,
          nrr: r.nrr,
          qualification_source: `BEST_RUNNER_UP_${r.group_key}`
        });
      }
    }
  }

  // Seed qualified teams: Group Winners first (sorted by pts, wins, nrr), then Runners-Up
  qualified.sort((a, b) => {
    if (a.group_position !== b.group_position) return a.group_position - b.group_position;
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    return b.nrr - a.nrr;
  });

  const seededQualifiers = qualified.map((q, idx) => ({ ...q, seed: idx + 1 }));

  return {
    qualifiers: seededQualifiers,
    unresolvedTies
  };
}

/**
 * IPL-Style 4-Team Playoff Progression Builder.
 * Stages:
 *  - Step 1 (after LEAGUE_STAGE completes): QUALIFIER_1 (Rank 1 vs Rank 2), ELIMINATOR (Rank 3 vs Rank 4)
 *  - Step 2 (after Q1 & ELIMINATOR complete): QUALIFIER_2 (Loser Q1 vs Winner ELIMINATOR)
 *  - Step 3 (after Q1 & Q2 complete): FINAL (Winner Q1 vs Winner Q2)
 */
function getNextIplPlayoffMatches(leagueStandings = [], existingMatches = []) {
  const byStage = {};
  existingMatches.forEach(m => {
    if (!byStage[m.stage]) byStage[m.stage] = [];
    byStage[m.stage].push(m);
  });

  const hasQ1 = (byStage.QUALIFIER_1 || []).length > 0;
  const hasElim = (byStage.ELIMINATOR || []).length > 0;
  const hasQ2 = (byStage.QUALIFIER_2 || []).length > 0;
  const hasFinal = (byStage.FINAL || []).length > 0;

  if (!hasQ1 && !hasElim) {
    if (leagueStandings.length < 4) return [];
    const r1 = leagueStandings[0];
    const r2 = leagueStandings[1];
    const r3 = leagueStandings[2];
    const r4 = leagueStandings[3];
    return [
      {
        home: r1.team_id,
        away: r2.team_id,
        stage: 'QUALIFIER_1',
        round: 1,
        qualification_source: { home: 'LEAGUE_RANK_1', away: 'LEAGUE_RANK_2' }
      },
      {
        home: r3.team_id,
        away: r4.team_id,
        stage: 'ELIMINATOR',
        round: 1,
        qualification_source: { home: 'LEAGUE_RANK_3', away: 'LEAGUE_RANK_4' }
      }
    ];
  }

  const q1 = (byStage.QUALIFIER_1 || [])[0];
  const elim = (byStage.ELIMINATOR || [])[0];

  if (!hasQ2 && q1?.status === 'COMPLETED' && elim?.status === 'COMPLETED' && q1.winner_id && elim.winner_id) {
    const q1Loser = q1.winner_id === q1.team_a_id ? q1.team_b_id : q1.team_a_id;
    const elimWinner = elim.winner_id;
    return [
      {
        home: q1Loser,
        away: elimWinner,
        stage: 'QUALIFIER_2',
        round: 2,
        qualification_source: { home: `LOSER_${q1.id}`, away: `WINNER_${elim.id}` }
      }
    ];
  }

  const q2 = (byStage.QUALIFIER_2 || [])[0];
  if (!hasFinal && q1?.status === 'COMPLETED' && q2?.status === 'COMPLETED' && q1.winner_id && q2.winner_id) {
    return [
      {
        home: q1.winner_id,
        away: q2.winner_id,
        stage: 'FINAL',
        round: 3,
        qualification_source: { home: `WINNER_${q1.id}`, away: `WINNER_${q2.id}` }
      }
    ];
  }

  return [];
}

/**
 * Validate group & qualification configuration for GROUP_KNOCKOUT / GROUP_SUPER_LEAGUE.
 * Throws { status: 400, code, message } on invalid, duplicate, or unassigned configurations.
 */
function validateGroupAndQualificationConfig(teams = [], tournamentType = '', formatConfig = {}, options = {}) {
  const tType = String(tournamentType || '').toUpperCase();
  if (tType !== 'GROUP_KNOCKOUT' && tType !== 'GROUP_SUPER_LEAGUE') {
    return { valid: true };
  }

  const cleanTeams = Array.from(new Set((teams || []).filter(Boolean)));
  const n = cleanTeams.length;
  const rawGroupCount = Number(formatConfig.group_count ?? 2);
  const rawTeamsPerGroup = Number(formatConfig.teams_per_group ?? 8);

  if (!Number.isInteger(rawGroupCount) || rawGroupCount < 1) {
    throw { status: 400, code: 'INVALID_GROUP_COUNT', message: 'Number of groups must be at least 1.' };
  }
  if (!Number.isInteger(rawTeamsPerGroup) || rawTeamsPerGroup < 2) {
    throw { status: 400, code: 'INVALID_TEAMS_PER_GROUP', message: 'Teams per group must be at least 2.' };
  }
  if (n < 2) {
    return { valid: true };
  }
  if (rawGroupCount > Math.floor(n / 2)) {
    throw {
      status: 400,
      code: 'TOO_MANY_GROUPS',
      message: `Cannot split ${n} teams into ${rawGroupCount} groups (each group requires at least 2 teams).`
    };
  }

  const distribution = String(formatConfig.group_distribution || 'BALANCED').toUpperCase();
  let groupSizes = [];

  if (distribution === 'MANUAL') {
    const manualGroups = formatConfig.manual_groups;
    if (!manualGroups || typeof manualGroups !== 'object' || Object.keys(manualGroups).length === 0) {
      if (options.requireManualGroups) {
        throw { status: 400, code: 'MANUAL_GROUPS_REQUIRED', message: 'Manual group allocation requires explicit group assignments.' };
      }
    } else {
      const seen = new Set();
      const entries = Object.entries(manualGroups);
      for (const [gKey, list] of entries) {
        const arr = Array.isArray(list) ? list.filter(Boolean) : [];
        if (arr.length < 2) {
          throw {
            status: 400,
            code: 'GROUP_TOO_SMALL',
            message: `Group '${gKey}' must contain at least 2 teams (found ${arr.length}).`
          };
        }
        for (const tId of arr) {
          if (!cleanTeams.includes(tId)) {
            throw { status: 400, code: 'INVALID_TEAM_IN_GROUPS', message: `Team '${tId}' in '${gKey}' is not registered in this tournament.` };
          }
          if (seen.has(tId)) {
            throw { status: 400, code: 'DUPLICATE_TEAM_IN_GROUPS', message: `Duplicate team assignment detected for '${tId}'.` };
          }
          seen.add(tId);
        }
        groupSizes.push(arr.length);
      }
      const unassigned = cleanTeams.filter(id => !seen.has(id));
      if (unassigned.length > 0) {
        throw {
          status: 400,
          code: 'UNASSIGNED_TEAMS_IN_GROUPS',
          message: `${unassigned.length} team(s) are unassigned: ${unassigned.slice(0, 5).join(', ')}`
        };
      }
    }
  }

  if (groupSizes.length === 0) {
    const alloc = allocateGroupsPure(cleanTeams, formatConfig);
    groupSizes = alloc.groups.map(g => g.teams.length);
  }

  const effGroupCount = groupSizes.length;
  const minGroupSize = Math.min(...groupSizes);
  const qPerGroup = Number(formatConfig.qualifiers_per_group ?? 1);
  const bestExtra = Number(formatConfig.best_runners_up_count ?? formatConfig.best_third_place_count ?? 0);

  if (!Number.isInteger(qPerGroup) || qPerGroup < 1) {
    throw { status: 400, code: 'INVALID_QUALIFIERS', message: 'Qualifiers per group must be at least 1.' };
  }
  if (qPerGroup > minGroupSize) {
    throw {
      status: 400,
      code: 'QUALIFIERS_EXCEED_GROUP_SIZE',
      message: `Cannot qualify top ${qPerGroup} per group when smallest group has ${minGroupSize} teams.`
    };
  }
  if (!Number.isInteger(bestExtra) || bestExtra < 0) {
    throw { status: 400, code: 'INVALID_BEST_RUNNERS_UP', message: 'Best runners-up / third-place wildcard count cannot be negative.' };
  }

  const totalQualifiers = effGroupCount * qPerGroup + bestExtra;
  if (totalQualifiers < 2) {
    throw {
      status: 400,
      code: 'INSUFFICIENT_QUALIFIERS',
      message: `Qualification rules produce only ${totalQualifiers} qualifier(s); at least 2 qualifiers are required for a knockout bracket.`
    };
  }
  if (totalQualifiers > n) {
    throw {
      status: 400,
      code: 'QUALIFIERS_EXCEED_TEAMS',
      message: `Total qualifiers (${totalQualifiers}) cannot exceed total teams (${n}).`
    };
  }

  return {
    valid: true,
    effectiveGroupCount: effGroupCount,
    totalQualifiers,
    minGroupSize
  };
}


const engine = new TournamentEngine();
engine.BYE_TOKEN = BYE_TOKEN;
engine.generateRoundRobinRounds = generateRoundRobinRounds;
engine.getKnockoutStageName = getKnockoutStageName;
engine.getNextKnockoutStageName = getNextKnockoutStageName;
engine.generateSingleEliminationRound1 = generateSingleEliminationRound1;
engine.validateGroupAndQualificationConfig = validateGroupAndQualificationConfig;
engine.toDecimalOvers = toDecimalOvers;
engine.computeStandings = computeStandings;
engine.computeGroupQualifiers = computeGroupQualifiers;
engine.getNextIplPlayoffMatches = getNextIplPlayoffMatches;
module.exports = engine;

