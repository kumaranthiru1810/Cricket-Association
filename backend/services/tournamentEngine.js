/**
 * backend/services/tournamentEngine.js
 * Pure Mathematical & Progression Engine for CFVD Cricket Tournaments.
 * Handles:
 *  - Circle Method / Berger Table Round-Robin (Single & Double Leg, Odd/Even Byes)
 *  - Power-of-2 Single Elimination Brackets & Byes
 *  - Group Allocation (Balanced, Random, Seeded, Manual, Uneven Groups)
 *  - Group & League Standings, NRR, Configurable Tie-Breakers & Unresolved Tie Detection
 *  - Automatic Qualification (Group Winners + Best Runners-Up)
 *  - Knockout & IPL-Style Playoff Stage Progression
 */

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
function allocateGroups(teams = [], formatConfig = {}) {
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
    const alloc = allocateGroups(cleanTeams, formatConfig);
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

module.exports = {
  BYE_TOKEN,
  generateRoundRobinRounds,
  getKnockoutStageName,
  getNextKnockoutStageName,
  generateSingleEliminationRound1,
  allocateGroups,
  validateGroupAndQualificationConfig,
  toDecimalOvers,
  computeStandings,
  computeGroupQualifiers,
  getNextIplPlayoffMatches
};

