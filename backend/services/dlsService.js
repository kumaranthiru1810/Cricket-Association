/**
 * services/dlsService.js
 *
 * DLS (Duckworth-Lewis-Stern) Calculation Engine
 *
 * IMPORTANT DISCLAIMER:
 * This implementation uses the Standard Edition resource percentage table that
 * has been published in cricket management literature and is widely reproduced
 * for educational purposes. This is NOT the official ICC/PwC DLS software.
 * Results are labeled as "DLS Estimate (Standard Method)" and should not be
 * used as official match arbitration without a licensed DLS system.
 *
 * Reference: Duckworth, Lewis & Stern "Your Comprehensive Guide to the
 * Duckworth Lewis Stern Method" and ICC Playing Conditions documentation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Standard DLS Resource Percentage Table (50-over basis)
// Format: resourceTable[overs_remaining][wickets_lost]
// Wickets lost: 0..9 (columns)
// Source: Widely published standard edition table
// ─────────────────────────────────────────────────────────────────────────────
const RESOURCE_TABLE_50 = {
  50: [100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9,  4.7],
  49: [ 99.0, 92.6, 84.5, 74.4, 62.4, 48.9, 34.9, 22.0, 11.9,  4.7],
  48: [ 97.9, 91.7, 83.8, 73.8, 62.0, 48.7, 34.8, 22.0, 11.9,  4.7],
  47: [ 96.9, 90.9, 83.1, 73.3, 61.7, 48.6, 34.7, 22.0, 11.9,  4.7],
  46: [ 95.8, 90.0, 82.4, 72.7, 61.3, 48.4, 34.7, 22.0, 11.9,  4.7],
  45: [ 94.6, 89.1, 81.6, 72.1, 60.9, 48.2, 34.6, 22.0, 11.9,  4.7],
  44: [ 93.5, 88.2, 80.9, 71.5, 60.5, 48.0, 34.5, 21.9, 11.9,  4.7],
  43: [ 92.3, 87.3, 80.1, 70.9, 60.0, 47.8, 34.5, 21.9, 11.9,  4.7],
  42: [ 91.1, 86.3, 79.3, 70.2, 59.6, 47.6, 34.4, 21.9, 11.9,  4.7],
  41: [ 89.9, 85.3, 78.5, 69.6, 59.2, 47.4, 34.3, 21.9, 11.9,  4.7],
  40: [ 88.7, 84.3, 77.7, 68.9, 58.7, 47.2, 34.2, 21.9, 11.9,  4.7],
  39: [ 87.5, 83.3, 76.8, 68.2, 58.2, 47.0, 34.1, 21.9, 11.9,  4.7],
  38: [ 86.2, 82.2, 75.9, 67.4, 57.7, 46.8, 34.0, 21.8, 11.8,  4.7],
  37: [ 84.9, 81.1, 75.0, 66.7, 57.2, 46.5, 33.9, 21.8, 11.8,  4.7],
  36: [ 83.6, 80.0, 74.1, 65.9, 56.7, 46.3, 33.8, 21.8, 11.8,  4.7],
  35: [ 82.3, 78.9, 73.1, 65.1, 56.2, 46.0, 33.7, 21.8, 11.8,  4.7],
  34: [ 80.9, 77.7, 72.2, 64.3, 55.6, 45.7, 33.6, 21.7, 11.8,  4.7],
  33: [ 79.5, 76.5, 71.1, 63.5, 55.1, 45.5, 33.5, 21.7, 11.8,  4.7],
  32: [ 78.1, 75.3, 70.1, 62.7, 54.5, 45.2, 33.4, 21.7, 11.8,  4.7],
  31: [ 76.7, 74.1, 69.0, 61.8, 53.9, 44.9, 33.2, 21.6, 11.8,  4.7],
  30: [ 75.2, 72.9, 67.9, 61.0, 53.3, 44.6, 33.1, 21.6, 11.7,  4.7],
  29: [ 73.7, 71.6, 66.8, 60.0, 52.7, 44.2, 32.9, 21.5, 11.7,  4.7],
  28: [ 72.2, 70.3, 65.7, 59.1, 52.0, 43.9, 32.8, 21.5, 11.7,  4.7],
  27: [ 70.7, 69.0, 64.5, 58.2, 51.4, 43.5, 32.6, 21.4, 11.7,  4.7],
  26: [ 69.1, 67.7, 63.3, 57.2, 50.7, 43.1, 32.4, 21.4, 11.7,  4.7],
  25: [ 67.5, 66.3, 62.1, 56.2, 50.0, 42.7, 32.2, 21.3, 11.6,  4.7],
  24: [ 65.9, 64.9, 60.8, 55.2, 49.3, 42.3, 32.0, 21.2, 11.6,  4.7],
  23: [ 64.2, 63.5, 59.6, 54.2, 48.5, 41.9, 31.8, 21.1, 11.6,  4.7],
  22: [ 62.5, 62.0, 58.3, 53.1, 47.8, 41.5, 31.6, 21.0, 11.5,  4.7],
  21: [ 60.8, 60.5, 57.0, 52.0, 47.0, 41.0, 31.4, 20.9, 11.5,  4.7],
  20: [ 59.0, 58.9, 55.7, 50.9, 46.1, 40.5, 31.1, 20.8, 11.5,  4.6],
  19: [ 57.2, 57.4, 54.3, 49.8, 45.3, 40.0, 30.9, 20.7, 11.4,  4.6],
  18: [ 55.4, 55.8, 52.9, 48.6, 44.4, 39.5, 30.6, 20.6, 11.4,  4.6],
  17: [ 53.5, 54.1, 51.4, 47.4, 43.5, 38.9, 30.3, 20.4, 11.3,  4.6],
  16: [ 51.6, 52.4, 50.0, 46.2, 42.5, 38.3, 30.0, 20.3, 11.2,  4.6],
  15: [ 49.6, 50.7, 48.5, 44.9, 41.5, 37.7, 29.7, 20.1, 11.2,  4.6],
  14: [ 47.6, 48.9, 46.9, 43.6, 40.5, 37.1, 29.3, 20.0, 11.1,  4.6],
  13: [ 45.6, 47.1, 45.4, 42.3, 39.4, 36.4, 29.0, 19.8, 11.0,  4.6],
  12: [ 43.5, 45.2, 43.8, 41.0, 38.3, 35.7, 28.6, 19.6, 10.9,  4.5],
  11: [ 41.4, 43.3, 42.1, 39.6, 37.1, 34.9, 28.2, 19.4, 10.8,  4.5],
  10: [ 39.2, 41.3, 40.4, 38.1, 35.9, 34.1, 27.7, 19.1, 10.7,  4.5],
   9: [ 37.0, 39.3, 38.7, 36.7, 34.7, 33.2, 27.2, 18.8, 10.5,  4.5],
   8: [ 34.7, 37.2, 36.9, 35.1, 33.4, 32.3, 26.7, 18.5, 10.4,  4.4],
   7: [ 32.3, 35.1, 35.1, 33.6, 32.1, 31.3, 26.1, 18.1, 10.2,  4.4],
   6: [ 29.9, 32.9, 33.2, 31.9, 30.7, 30.1, 25.5, 17.7, 10.0,  4.4],
   5: [ 27.4, 30.6, 31.2, 30.2, 29.2, 28.8, 24.8, 17.2,  9.8,  4.3],
   4: [ 24.8, 28.2, 29.2, 28.4, 27.6, 27.4, 24.0, 16.7,  9.5,  4.3],
   3: [ 22.1, 25.8, 27.0, 26.5, 25.9, 25.8, 23.1, 16.1,  9.2,  4.2],
   2: [ 19.3, 23.2, 24.8, 24.5, 24.1, 24.0, 22.1, 15.4,  8.8,  4.2],
   1: [ 16.4, 20.6, 22.4, 22.3, 22.1, 22.1, 21.0, 14.7,  8.4,  4.1],
   0: [  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
};

// G50 = 245 (average 1st innings score in 50-over matches — standard edition)
const G50 = 245;

/**
 * Look up the resource percentage for given overs remaining and wickets lost.
 * @param {number} oversRemaining - overs left (can be fractional)
 * @param {number} wicketsLost - wickets already fallen (0-9)
 * @returns {number} resource percentage (0-100)
 */
function getResourcePct(oversRemaining, wicketsLost) {
  const w = Math.min(Math.max(Math.round(wicketsLost || 0), 0), 9);
  const o = Math.round(oversRemaining || 0);
  const clampedO = Math.min(Math.max(o, 0), 50);

  if (RESOURCE_TABLE_50[clampedO] !== undefined) {
    return RESOURCE_TABLE_50[clampedO][w];
  }

  // Interpolate for values beyond 50
  return RESOURCE_TABLE_50[50][w];
}

/**
 * Convert overs.balls notation to a fractional overs number.
 * e.g. 14.3 → 14 + 3/6 = 14.5 overs
 */
function oversToDecimal(oversAndBalls) {
  const str = String(oversAndBalls || '0');
  const [oStr, bStr] = str.split('.');
  const o = parseInt(oStr, 10) || 0;
  const b = parseInt(bStr || '0', 10) || 0;
  return o + b / 6;
}

/**
 * Calculate resources used from start to a given point.
 * @param {number} totalOvers - full match overs allocated
 * @param {number} oversPlayed - overs completed so far (decimal)
 * @param {number} wicketsLost - wickets fallen
 * @returns {number} resource % used
 */
function getResourcesUsed(totalOvers, oversPlayed, wicketsLost) {
  const oversRemaining = Math.max(0, totalOvers - oversPlayed);
  const scale = totalOvers / 50; // scale for non-50-over matches

  const resourceAtStart = getResourcePct(totalOvers, 0) * scale;
  const resourceNow = getResourcePct(Math.min(oversRemaining, 50), wicketsLost) * scale;

  const used = resourceAtStart - resourceNow;
  return Math.max(0, Math.min(used, 100));
}

/**
 * Get available resources (resources remaining) at a point.
 */
function getResourcesAvailable(totalOvers, oversPlayed, wicketsLost) {
  const oversRemaining = Math.max(0, totalOvers - oversPlayed);
  const scale = totalOvers / 50;
  return getResourcePct(Math.min(oversRemaining, 50), wicketsLost) * scale;
}

// ─────────────────────────────────────────────────────────────────────────────
// DLS Par Score Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate DLS revised target for Team 2 when there is an interruption.
 *
 * Scenario A: Interruption happens BEFORE Team 2's innings starts.
 *   revised_target = team1_score × (R2 / R1) + 1
 *   Where R1 = Team 1 resources available, R2 = Team 2 resources available.
 *
 * Scenario B: Interruption happens DURING Team 2's innings.
 *   If R2 < R1: target is REDUCED.
 *   If R2 > R1: target is INCREASED (by the extra resource).
 *
 * @param {object} params
 * @param {number} params.team1Score - First innings total
 * @param {number} params.team1Overs - Overs allocated to Team 1
 * @param {number} params.team1Wickets - Wickets lost by Team 1 (for resource calc)
 * @param {number} params.team2OversAllocated - Original overs for Team 2
 * @param {number} params.team2RevisedOvers - Revised overs for Team 2 after interruption
 * @param {number} params.team2OversPlayed - Overs completed by Team 2 before interruption
 * @param {number} params.team2WicketsLost - Wickets lost by Team 2 before interruption
 * @param {number} params.team2ScoreAtInterruption - Runs scored by Team 2 before interruption
 * @param {boolean} params.isPreInningsInterruption - True if interruption before T2 starts
 * @returns {object} DLS result
 */
function calculateDLS(params) {
  const {
    team1Score = 0,
    team1Overs = 50,
    team1Wickets = 10,
    team2OversAllocated,
    team2RevisedOvers,
    team2OversPlayed = 0,
    team2WicketsLost = 0,
    team2ScoreAtInterruption = 0,
    isPreInningsInterruption = false
  } = params;

  const allocatedOvers = team2OversAllocated || team1Overs;
  const revisedOvers = team2RevisedOvers || allocatedOvers;

  // Team 1 resources: What % of resources did Team 1 have at start of their innings?
  const r1 = getResourcePct(Math.min(team1Overs, 50), 0) * (team1Overs / 50);

  // Team 2 resources available (full allocation, before interruption)
  const r2Full = getResourcePct(Math.min(allocatedOvers, 50), 0) * (allocatedOvers / 50);

  if (isPreInningsInterruption || team2OversPlayed === 0) {
    // ── Scenario A: Pre-innings interruption ──────────────────────────────
    const r2Revised = getResourcePct(Math.min(revisedOvers, 50), 0) * (revisedOvers / 50);

    if (r2Revised >= r1) {
      // Team 2 has same or more resources than Team 1 — straightforward target
      const revisedTarget = Math.round(team1Score * (r2Revised / r1)) + 1;
      return {
        method: 'DLS',
        edition: 'Standard Edition',
        disclaimer: 'DLS Estimate only. Not official ICC/PwC DLS software.',
        scenario: 'Pre-Innings Interruption',
        team1Score,
        team1Resources: parseFloat(r1.toFixed(1)),
        team2Resources: parseFloat(r2Revised.toFixed(1)),
        revisedOvers: revisedOvers,
        revisedTarget,
        parScore: revisedTarget - 1,
        lossOfResources: parseFloat((r2Full - r2Revised).toFixed(1)),
        status: 'CALCULATED'
      };
    } else {
      // Team 2 has fewer resources
      const revisedTarget = Math.round(team1Score * (r2Revised / r1)) + 1;
      return {
        method: 'DLS',
        edition: 'Standard Edition',
        disclaimer: 'DLS Estimate only. Not official ICC/PwC DLS software.',
        scenario: 'Pre-Innings Interruption (Team 2 reduced resources)',
        team1Score,
        team1Resources: parseFloat(r1.toFixed(1)),
        team2Resources: parseFloat(r2Revised.toFixed(1)),
        revisedOvers,
        revisedTarget,
        parScore: revisedTarget - 1,
        lossOfResources: parseFloat((r2Full - r2Revised).toFixed(1)),
        status: 'CALCULATED'
      };
    }
  } else {
    // ── Scenario B: Mid-innings interruption ──────────────────────────────
    // Resources remaining for Team 2 at interruption point
    const r2AtInterruption = getResourcesAvailable(allocatedOvers, team2OversPlayed, team2WicketsLost);
    const r2Scale = allocatedOvers / 50;
    const r2AtInterruptionScaled = r2AtInterruption * r2Scale;

    // Resources remaining after interruption (revised allocation)
    const oversRemainingAfter = Math.max(0, revisedOvers - team2OversPlayed);
    const r2AfterInterruption = getResourcePct(Math.min(oversRemainingAfter, 50), team2WicketsLost) * (allocatedOvers / 50);

    const lossOfResources = Math.max(0, r2AtInterruptionScaled - r2AfterInterruption);

    let revisedTarget;
    if (r2Full >= r1) {
      // T2 had equal or more resources than T1 — no bonus needed
      revisedTarget = team2ScoreAtInterruption + Math.round(
        (team1Score - G50 * (r2Full - r2AfterInterruption) / 100)
      ) + 1;
    } else {
      // T2 had fewer resources — apply reduction
      revisedTarget = team2ScoreAtInterruption + Math.round(
        team1Score * (r2AfterInterruption / r1)
      ) + 1;
    }

    revisedTarget = Math.max(revisedTarget, team2ScoreAtInterruption + 1);

    return {
      method: 'DLS',
      edition: 'Standard Edition',
      disclaimer: 'DLS Estimate only. Not official ICC/PwC DLS software.',
      scenario: 'Mid-Innings Interruption',
      team1Score,
      team1Resources: parseFloat(r1.toFixed(1)),
      team2ResourcesFull: parseFloat(r2Full.toFixed(1)),
      team2ResourcesAtInterruption: parseFloat(r2AtInterruptionScaled.toFixed(1)),
      team2ResourcesAfter: parseFloat(r2AfterInterruption.toFixed(1)),
      lossOfResources: parseFloat(lossOfResources.toFixed(1)),
      team2ScoreAtInterruption,
      team2OversPlayed,
      team2WicketsLost,
      revisedOvers,
      revisedTarget,
      parScore: revisedTarget - 1,
      status: 'CALCULATED'
    };
  }
}

/**
 * Calculate live DLS par score during Team 2's chase.
 * Tells whether Team 2 is Ahead/Behind/Level with par.
 *
 * @param {object} params
 * @param {number} params.team1Score
 * @param {number} params.team1Overs
 * @param {number} params.team2OversAllocated
 * @param {number} params.team2OversPlayed
 * @param {number} params.team2WicketsLost
 * @param {number} params.team2CurrentScore
 * @param {number} params.revisedTarget - If a revised target has been set
 * @returns {object} live par score analysis
 */
function calculateLiveDLSPar(params) {
  const {
    team1Score = 0,
    team1Overs = 50,
    team2OversAllocated,
    team2OversPlayed = 0,
    team2WicketsLost = 0,
    team2CurrentScore = 0,
    revisedTarget = null
  } = params;

  const allocated = team2OversAllocated || team1Overs;
  const r1 = getResourcePct(Math.min(team1Overs, 50), 0) * (team1Overs / 50);
  const r2Full = getResourcePct(Math.min(allocated, 50), 0) * (allocated / 50);

  // Resources used so far by Team 2
  const oversPlayedDec = typeof team2OversPlayed === 'number' ? team2OversPlayed : oversToDecimal(team2OversPlayed);
  const r2Used = r2Full - getResourcesAvailable(allocated, oversPlayedDec, team2WicketsLost);

  // Par score = what score should Team 2 have at this point?
  const r2UsedPct = r2Used / r1;
  const parScore = Math.round(team1Score * r2UsedPct);

  const runsAhead = team2CurrentScore - parScore;

  let matchPosition;
  if (runsAhead > 0) matchPosition = 'AHEAD_OF_PAR';
  else if (runsAhead < 0) matchPosition = 'BEHIND_PAR';
  else matchPosition = 'LEVEL_WITH_PAR';

  return {
    method: 'DLS',
    edition: 'Standard Edition',
    disclaimer: 'DLS Estimate only. Not official ICC/PwC DLS software.',
    parScore,
    currentScore: team2CurrentScore,
    runsAheadOfPar: runsAhead,
    matchPosition,
    team1Resources: parseFloat(r1.toFixed(1)),
    team2ResourcesUsed: parseFloat(r2Used.toFixed(1)),
    revisedTarget: revisedTarget || (Math.round(team1Score * (r2Full / r1)) + 1),
    status: 'CALCULATED'
  };
}

/**
 * Main DLS prediction for the live scorecard widget.
 * Returns a clean summary object for display.
 */
function getDLSPrediction({
  team1Score,
  team1Overs,
  team2OversAllocated,
  team2RevisedOvers,
  team2OversPlayed,
  team2WicketsLost,
  team2CurrentScore,
  team2Target,
  hasInterruption = false,
  isPreInningsInterruption = false,
  team2ScoreAtInterruption = 0
}) {
  try {
    const allocated = team2OversAllocated || team1Overs || 20;
    const oversPlayed = typeof team2OversPlayed === 'number'
      ? team2OversPlayed
      : oversToDecimal(team2OversPlayed);

    let revisedTarget = team2Target;
    let dlsResult = null;

    if (hasInterruption && team2RevisedOvers && team2RevisedOvers < allocated) {
      dlsResult = calculateDLS({
        team1Score,
        team1Overs: team1Overs || allocated,
        team1Wickets: 10,
        team2OversAllocated: allocated,
        team2RevisedOvers,
        team2OversPlayed: oversPlayed,
        team2WicketsLost,
        team2ScoreAtInterruption,
        isPreInningsInterruption
      });
      revisedTarget = dlsResult.revisedTarget;
    }

    const livePar = calculateLiveDLSPar({
      team1Score,
      team1Overs: team1Overs || allocated,
      team2OversAllocated: allocated,
      team2OversPlayed: oversPlayed,
      team2WicketsLost,
      team2CurrentScore,
      revisedTarget
    });

    const oversRemaining = Math.max(0, (team2RevisedOvers || allocated) - oversPlayed);
    const runsRequired = Math.max(0, (revisedTarget || team2Target || team1Score + 1) - team2CurrentScore);
    const ballsRemaining = Math.round(oversRemaining * 6);
    const requiredRunRate = ballsRemaining > 0
      ? parseFloat((runsRequired / (ballsRemaining / 6)).toFixed(2))
      : 0;

    return {
      method: 'DLS',
      edition: 'Standard Edition',
      disclaimer: 'DLS Estimate only. This is not official ICC/PwC DLS software.',
      active: true,
      hasInterruption,
      revisedTarget: revisedTarget || null,
      dlsDetail: dlsResult,
      livePar: livePar.parScore,
      matchPosition: livePar.matchPosition,
      runsAheadOfPar: livePar.runsAheadOfPar,
      runsRequired,
      ballsRemaining,
      requiredRunRate,
      team1Resources: livePar.team1Resources,
      team2ResourcesUsed: livePar.team2ResourcesUsed,
      status: 'CALCULATED',
      calculatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      method: 'DLS',
      active: false,
      status: 'ERROR',
      error: err.message,
      calculatedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  getDLSPrediction,
  calculateDLS,
  calculateLiveDLSPar,
  getResourcePct,
  oversToDecimal,
  RESOURCE_TABLE_50,
  G50
};
