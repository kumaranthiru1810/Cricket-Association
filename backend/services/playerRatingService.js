/**
 * services/playerRatingService.js
 * 
 * Holistic, Format-Aware Player Performance & Career Rating Engine.
 * Evaluates Batting, Bowling, Fielding, and Match Impact separately out of 10.0 stars.
 * 
 * Core Architectural Principles:
 * 1. Format-Specific Benchmarks (T20, One Day, Multi-Day, T10).
 * 2. Role-Adaptive Weighting (Batsman, Bowler, All-Rounder, Wicketkeeper).
 * 3. Non-Opportunity Weight Renormalization (Never penalize player for DNB / DNBowl).
 * 4. Separate Match Rating vs. Career Aggregations.
 * 5. Data Confidence Calibration:
 *    - 1-2 matches: "Provisional"
 *    - 3-4 matches: "Developing"
 *    - 5+ matches: "Established"
 * 6. Idempotent MongoDB Persistence in PlayerMatchRating model.
 */

const db = require('../config/db');
const {
  FORMAT_BENCHMARKS,
  ROLE_WEIGHTS,
  CONFIDENCE_THRESHOLDS
} = require('../config/ratingBenchmarks');

const CAREER_RATINGS_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const _careerRatingsCache = new Map();
const _pendingMatchJobs = new Set();
const _jobQueue = [];
let _workerRunning = false;

class PlayerRatingService {
  /**
   * 1. Calculate Single Match Performance Rating for a Player
   */
  calculateMatchRating({
    battingStats = null,
    bowlingStats = null,
    fieldingStats = null,
    matchContext = {},
    role = 'BATSMAN',
    format = 'T20'
  }) {
    const normRole = (role || 'BATSMAN').toUpperCase().replace(/[\s-]/g, '_');
    const priorRoleKey = ROLE_WEIGHTS[normRole] ? normRole : (normRole.includes('BOWL') ? 'BOWLER' : (normRole.includes('ALL') ? 'ALL_ROUNDER' : (normRole.includes('KEEPER') ? 'WICKETKEEPER' : 'BATSMAN')));
    const normFormat = (format || 'T20').toUpperCase().replace(/[\s-]/g, '_');
    const baseBenchmark = FORMAT_BENCHMARKS[normFormat] || FORMAT_BENCHMARKS.T20;

    // Scale parRuns and parBallsPerWicket by scheduled overs when provided (e.g. 8-over match)
    const scheduledOvers = Number(matchContext.overs_per_side || 0);
    const stdOvers = Number(baseBenchmark.standardOvers || 20);
    const overScale = scheduledOvers > 0 && stdOvers > 0 ? (scheduledOvers / stdOvers) : 1;
    const benchmark = {
      ...baseBenchmark,
      parRuns: Math.max(4, Number((baseBenchmark.parRuns * overScale).toFixed(2))),
      parBallsPerWicket: Math.max(4, Number((baseBenchmark.parBallsPerWicket * overScale).toFixed(2)))
    };

    const availability = {
      batting: false,
      bowling: false,
      fielding: false,
      impact: false
    };

    let rBat = null;
    let rBowl = null;
    let rField = null;
    let rImpact = null;

    // ─────────────────────────────────────────────────────────────
    // A. BATTING RATING (0.0 to 10.0)
    // Counts for role inference & weights only if >= 6 balls, >= 10 runs, or dismissed
    // ─────────────────────────────────────────────────────────────
    const batBalls = Math.max(0, Number(battingStats?.balls || 0));
    const batRuns = Math.max(0, Number(battingStats?.runs || 0));
    const batIsOut = Boolean(battingStats?.is_out);
    const didMeaningfullyBat = Boolean(battingStats && (batBalls >= 6 || batRuns >= 10 || batIsOut));

    if (didMeaningfullyBat) {
      availability.batting = true;
      const runs = batRuns;
      const balls = batBalls;
      const fours = Math.max(0, Number(battingStats.fours || 0));
      const sixes = Math.max(0, Number(battingStats.sixes || 0));
      const isOut = batIsOut;
      const inningsBatted = Math.max(1, Number(battingStats.innings_batted || matchContext.innings_batted || 1));
      const batParRuns = benchmark.parRuns * inningsBatted;
      const sr = balls > 0 ? (runs / balls) * 100 : (runs > 0 ? benchmark.parSR : 0);

      // 1. Run volume vs scaled format benchmark (scaled by innings batted in multi-innings matches)
      const volumeRatio = runs / batParRuns;
      let runVolumeScore = Math.min(10.0, Math.pow(Math.max(0.01, volumeRatio), 0.75) * 5.5);
      if (runs === 0 && isOut) {
        runVolumeScore = balls <= 1 ? 0.5 : 1.5;
      }

      // 2. Velocity / Strike rate parity
      let velocityScore = 5.0; // neutral default
      if (balls >= 3) {
        const srRatio = sr / benchmark.parSR;
        velocityScore = Math.max(1.0, Math.min(10.0, srRatio * 5.5));
      }

      // 3. Boundary productivity (0 to 10 scale)
      const boundaryRuns = (fours * 4) + (sixes * 6);
      const boundaryRatio = runs > 0 ? Math.min(1.0, boundaryRuns / runs) : 0;
      const boundaryScore = boundaryRatio * 10.0;

      // Base Batting Score (weights sum to 1.0)
      const baseBat = (runVolumeScore * 0.55) + (velocityScore * 0.30) + (boundaryScore * 0.15);

      // Milestone bonuses expressed as multiples of scaled parRuns (2x, 3x, 4x, 6x, 8x)
      let milestoneBonus = 0;
      if (runs >= batParRuns * 8) milestoneBonus = 1.8;
      else if (runs >= batParRuns * 6) milestoneBonus = 1.4;
      else if (runs >= batParRuns * 4) milestoneBonus = 1.0;
      else if (runs >= batParRuns * 3) milestoneBonus = 0.8;
      else if (runs >= batParRuns * 2) milestoneBonus = 0.5;

      const finishBonus = (!isOut && runs >= Math.max(10, batParRuns * 0.6)) ? 0.6 : 0;

      let teamContrib = 0;
      const teamRuns = Number(matchContext.team_total_runs || 0);
      if (teamRuns > 0 && runs > 0) {
        const share = runs / teamRuns;
        if (share >= 0.40) teamContrib = 0.8;
        else if (share >= 0.25) teamContrib = 0.4;
      }

      const rawBat = baseBat + milestoneBonus + finishBonus + teamContrib;
      rBat = Math.max(0.0, Math.min(10.0, Number(rawBat.toFixed(1))));
    }

    // ─────────────────────────────────────────────────────────────
    // B. BOWLING RATING (0.0 to 10.0)
    // ─────────────────────────────────────────────────────────────
    const oversBowled = Number(bowlingStats?.overs || 0);
    const ballsBowled = Number(bowlingStats?.balls_bowled || bowlingStats?.balls || (oversBowled * 6));
    const legalBalls = Math.max(0, ballsBowled);

    if (bowlingStats && (legalBalls > 0 || oversBowled > 0)) {
      availability.bowling = true;
      const wickets = Math.max(0, Number(bowlingStats.wickets || 0));
      const runsConceded = Math.max(0, Number(bowlingStats.runs_conceded || 0));
      const maidens = Math.max(0, Number(bowlingStats.maidens || 0));
      const dotBalls = bowlingStats.dot_balls !== undefined && bowlingStats.dot_balls !== null
        ? Math.max(0, Number(bowlingStats.dot_balls))
        : null;

      const decimalOvers = legalBalls > 0 ? (legalBalls / 6) : oversBowled;
      const economy = decimalOvers > 0 ? (runsConceded / decimalOvers) : 0;

      // 1. Wicket Penetration
      let wicketScore = 3.5;
      if (wickets === 1) wicketScore = 5.5;
      else if (wickets === 2) wicketScore = 7.5;
      else if (wickets === 3) wicketScore = 8.8;
      else if (wickets === 4) wicketScore = 9.5;
      else if (wickets >= 5) wicketScore = 10.0;
      else if (wickets === 0 && decimalOvers >= 2.0) wicketScore = 3.0;

      // 2. Economy Containment relative to par, weighted by overs bowled (min 1 over for full weight)
      const rawEconScore = Math.max(1.0, Math.min(10.0, 5.5 * (benchmark.parEconomy / Math.max(economy, 0.5))));
      const econWeight = Math.min(1.0, decimalOvers / 1.0);
      const economyScore = (rawEconScore * econWeight) + (5.5 * (1 - econWeight));

      // 3. Dot ball pressure from Delivery records (fallback 0.40 only when deliveries unavailable)
      const hasDotData = dotBalls !== null && (bowlingStats.has_delivery_dots !== false);
      const dotRatio = legalBalls > 0 && hasDotData ? Math.min(1.0, dotBalls / legalBalls) : 0.40;
      const dotScore = dotRatio * 10.0;

      // Base Bowling Score (weights sum to 1.0: 50% wickets, 35% economy, 15% dots)
      const baseBowl = (wicketScore * 0.50) + (economyScore * 0.35) + (dotScore * 0.15);

      // Bonuses
      const maidenBonus = maidens * 0.5;
      let haulBonus = 0;
      if (wickets >= 5) haulBonus = 1.2;
      else if (wickets >= 3) haulBonus = 0.6;
      else if (wickets >= 2) haulBonus = 0.3;

      const rawBowl = baseBowl + maidenBonus + haulBonus;
      rBowl = Math.max(0.0, Math.min(10.0, Number(rawBowl.toFixed(1))));
    }

    // ─────────────────────────────────────────────────────────────
    // C. FIELDING RATING & ADDITIVE BONUS (Never lowers overall)
    // ─────────────────────────────────────────────────────────────
    const catches = Math.max(0, Number(fieldingStats?.catches || 0));
    const directHits = Math.max(0, Number(fieldingStats?.direct_hit_run_outs || 0));
    const assistedRunOuts = Math.max(0, Number(fieldingStats?.assisted_run_outs || 0));
    const stumpings = Math.max(0, Number(fieldingStats?.stumpings || 0));
    const totalDismissals = catches + directHits + assistedRunOuts + stumpings;
    const fieldingAdditiveBonus = Math.min(
      1.0,
      (catches * 0.3) + (directHits * 0.6) + (assistedRunOuts * 0.3) + (stumpings * 0.4)
    );

    if (totalDismissals > 0) {
      availability.fielding = true;
      const rawField = 5.0 + (catches * 1.8) + (directHits * 3.5) + (assistedRunOuts * 2.0) + (stumpings * 2.5);
      rField = Math.max(0.0, Math.min(10.0, Number(rawField.toFixed(1))));
    } else if (priorRoleKey === 'WICKETKEEPER') {
      availability.fielding = true;
      rField = 5.0;
    }

    // ─────────────────────────────────────────────────────────────
    // D. MATCH IMPACT RATING (0.0 to 10.0)
    // ─────────────────────────────────────────────────────────────
    if (availability.batting || availability.bowling || availability.fielding) {
      availability.impact = true;
      let rawImpact = 5.0;

      if (matchContext.team_won) rawImpact += 1.5;
      if (matchContext.player_of_the_match) rawImpact += 2.5;

      if (rBat !== null && rBat >= 6.5) rawImpact += 0.8;
      if (rBowl !== null && rBowl >= 6.5) rawImpact += 0.8;
      if (rBat !== null && rBat >= 6.0 && rBowl !== null && rBowl >= 6.0) {
        rawImpact += 1.2;
      }

      rImpact = Math.max(0.0, Math.min(10.0, Number(rawImpact.toFixed(1))));
    }

    // ─────────────────────────────────────────────────────────────
    // E. INFER PER-MATCH ROLE & WEIGHT RENORMALIZATION
    // ─────────────────────────────────────────────────────────────
    let roleKey = priorRoleKey;
    const bowledMeaningfully = availability.bowling && (legalBalls >= 12 || oversBowled >= 2);
    if (availability.batting && bowledMeaningfully) {
      roleKey = 'ALL_ROUNDER';
    } else if (availability.bowling && (ROLE_WEIGHTS[roleKey]?.bowling || 0) === 0) {
      // Never give zero weight to bowling when player actually bowled
      roleKey = availability.batting ? 'ALL_ROUNDER' : 'BOWLER';
    } else if (availability.batting && (ROLE_WEIGHTS[roleKey]?.batting || 0) === 0) {
      roleKey = availability.bowling ? 'ALL_ROUNDER' : 'BATSMAN';
    }

    const baseWeights = { ...(ROLE_WEIGHTS[roleKey] || ROLE_WEIGHTS.BATSMAN) };
    let activeWeightSum = 0;
    let weightedScoreSum = 0;

    if (availability.batting && rBat !== null) {
      activeWeightSum += baseWeights.batting;
      weightedScoreSum += (baseWeights.batting * rBat);
    }
    if (availability.bowling && rBowl !== null) {
      activeWeightSum += baseWeights.bowling;
      weightedScoreSum += (baseWeights.bowling * rBowl);
    }
    if (availability.impact && rImpact !== null) {
      activeWeightSum += baseWeights.impact;
      weightedScoreSum += (baseWeights.impact * rImpact);
    }

    let overallRating = null;
    if (activeWeightSum > 0) {
      let normalizedScore = weightedScoreSum / activeWeightSum;
      if (roleKey === 'ALL_ROUNDER' && rBat !== null && rBat >= 6.0 && rBowl !== null && rBowl >= 6.0) {
        normalizedScore += 0.4;
      }
      // Apply fielding as an additive bonus after weighted overall (capped at +1.0)
      normalizedScore += fieldingAdditiveBonus;
      overallRating = Math.max(0.0, Math.min(10.0, Number(normalizedScore.toFixed(1))));
    } else if (availability.fielding && rField !== null) {
      overallRating = Math.max(0.0, Math.min(10.0, Number(rField.toFixed(1))));
    }

    return {
      batting_rating: rBat,
      bowling_rating: rBowl,
      fielding_rating: rField,
      impact_rating: rImpact,
      overall_rating: overallRating,
      component_availability: availability,
      role: roleKey,
      format: normFormat
    };
  }

  invalidateCareerRatingsCache(playerId = null) {
    if (!playerId) {
      _careerRatingsCache.clear();
      return;
    }
    const prefix = `${String(playerId)}::`;
    for (const key of _careerRatingsCache.keys()) {
      if (key.startsWith(prefix)) _careerRatingsCache.delete(key);
    }
  }

  /**
   * 2. Calculate Career Rating across Verified Completed Matches
   * Cached for 60 seconds and invalidated on rating recalculation.
   */
  async getCareerRatings(playerId, filters = {}) {
    await db.initDb();
    const normFormat = filters?.format && String(filters.format).toUpperCase() !== 'ALL'
      ? String(filters.format).toUpperCase().replace(/[\s-]/g, '_')
      : null;
    const tournamentId = filters?.tournamentId && String(filters.tournamentId).toUpperCase() !== 'ALL'
      ? String(filters.tournamentId).trim()
      : null;

    const cacheKey = `${String(playerId)}::${normFormat || 'ALL'}::${tournamentId || 'ALL'}`;
    const cached = _careerRatingsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const query = {
      $or: [{ player_id: playerId }, { player_name: playerId }],
      overall_rating: { $ne: null },
      verification_status: 'VERIFIED'
    };
    if (normFormat) query.format = normFormat;
    if (tournamentId) query.tournament_id = tournamentId;

    const ratings = await db.models.PlayerMatchRating.find(query).sort({ match_date: -1 }).lean();
    const matchesCount = ratings.length;

    // Confidence label based on data volume (1-2 Provisional, 3-4 Developing, 5+ Established)
    let confidence = 'No Data';
    if (matchesCount >= CONFIDENCE_THRESHOLDS.ESTABLISHED_MIN_MATCHES) confidence = 'Established';
    else if (matchesCount >= CONFIDENCE_THRESHOLDS.DEVELOPING_MIN_MATCHES) confidence = 'Developing';
    else if (matchesCount >= 1) confidence = 'Provisional';

    if (matchesCount === 0) {
      const emptyResult = {
        overall_rating: null,
        raw_overall_rating: null,
        confidence,
        matches_count: 0,
        formats: {
          T20: { rating: null, matches: 0 },
          ONE_DAY: { rating: null, matches: 0 },
          MULTI_DAY: { rating: null, matches: 0 },
          T10: { rating: null, matches: 0 },
          CUSTOM: { rating: null, matches: 0 }
        },
        components: {
          batting: null,
          bowling: null,
          fielding: null,
          impact: null
        }
      };
      _careerRatingsCache.set(cacheKey, { value: emptyResult, expiresAt: Date.now() + CAREER_RATINGS_CACHE_TTL_MS });
      return emptyResult;
    }

    // Weighted Recency Aggregation:
    // Recent 5 matches receive 1.25x weight vs older matches 1.0x
    let totalOverallWeight = 0;
    let weightedOverallSum = 0;

    let batSum = 0; let batCount = 0;
    let bowlSum = 0; let bowlCount = 0;
    let fieldSum = 0; let fieldCount = 0;
    let impactSum = 0; let impactCount = 0;

    const formatBuckets = {
      T20: { sum: 0, count: 0 },
      ONE_DAY: { sum: 0, count: 0 },
      MULTI_DAY: { sum: 0, count: 0 },
      T10: { sum: 0, count: 0 },
      CUSTOM: { sum: 0, count: 0 }
    };

    ratings.forEach((r, idx) => {
      const recencyMultiplier = idx < 5 ? 1.25 : 1.0;
      if (r.overall_rating !== null) {
        weightedOverallSum += (r.overall_rating * recencyMultiplier);
        totalOverallWeight += recencyMultiplier;
      }

      if (r.batting_rating !== null) {
        batSum += r.batting_rating;
        batCount++;
      }
      if (r.bowling_rating !== null) {
        bowlSum += r.bowling_rating;
        bowlCount++;
      }
      if (r.fielding_rating !== null) {
        fieldSum += r.fielding_rating;
        fieldCount++;
      }
      if (r.impact_rating !== null) {
        impactSum += r.impact_rating;
        impactCount++;
      }

      const fKey = (r.format || 'T20').toUpperCase();
      if (formatBuckets[fKey]) {
        formatBuckets[fKey].sum += (r.overall_rating || 0);
        formatBuckets[fKey].count++;
      }
    });

    const rawOverallCareerRating = totalOverallWeight > 0 ? Number((weightedOverallSum / totalOverallWeight).toFixed(1)) : null;

    // Bayesian shrinkage toward league average (k = 3, prior from DB, default 5.5)
    let overallCareerRating = rawOverallCareerRating;
    if (rawOverallCareerRating !== null) {
      let prior = 5.5;
      try {
        const leagueAgg = await db.models.PlayerMatchRating.aggregate([
          { $match: { verification_status: 'VERIFIED', overall_rating: { $ne: null } } },
          { $group: { _id: null, avg: { $avg: '$overall_rating' } } }
        ]);
        if (leagueAgg && leagueAgg[0] && typeof leagueAgg[0].avg === 'number') {
          prior = Number(leagueAgg[0].avg.toFixed(2));
        }
      } catch (_e) {}
      const k = 3;
      overallCareerRating = Number((((matchesCount * rawOverallCareerRating) + (k * prior)) / (matchesCount + k)).toFixed(1));
    }

    const result = {
      overall_rating: overallCareerRating,
      raw_overall_rating: rawOverallCareerRating,
      confidence,
      matches_count: matchesCount,
      formats: {
        T20: {
          rating: formatBuckets.T20.count > 0 ? Number((formatBuckets.T20.sum / formatBuckets.T20.count).toFixed(1)) : null,
          matches: formatBuckets.T20.count
        },
        ONE_DAY: {
          rating: formatBuckets.ONE_DAY.count > 0 ? Number((formatBuckets.ONE_DAY.sum / formatBuckets.ONE_DAY.count).toFixed(1)) : null,
          matches: formatBuckets.ONE_DAY.count
        },
        MULTI_DAY: {
          rating: formatBuckets.MULTI_DAY.count > 0 ? Number((formatBuckets.MULTI_DAY.sum / formatBuckets.MULTI_DAY.count).toFixed(1)) : null,
          matches: formatBuckets.MULTI_DAY.count
        },
        T10: {
          rating: formatBuckets.T10.count > 0 ? Number((formatBuckets.T10.sum / formatBuckets.T10.count).toFixed(1)) : null,
          matches: formatBuckets.T10.count
        },
        CUSTOM: {
          rating: formatBuckets.CUSTOM.count > 0 ? Number((formatBuckets.CUSTOM.sum / formatBuckets.CUSTOM.count).toFixed(1)) : null,
          matches: formatBuckets.CUSTOM.count
        }
      },
      components: {
        batting: batCount > 0 ? Number((batSum / batCount).toFixed(1)) : null,
        bowling: bowlCount > 0 ? Number((bowlSum / bowlCount).toFixed(1)) : null,
        fielding: fieldCount > 0 ? Number((fieldSum / fieldCount).toFixed(1)) : null,
        impact: impactCount > 0 ? Number((impactSum / impactCount).toFixed(1)) : null
      }
    };
    _careerRatingsCache.set(cacheKey, { value: result, expiresAt: Date.now() + CAREER_RATINGS_CACHE_TTL_MS });
    return result;
  }

  /**
   * 3. Get Last 5 and Last 10 Matches Form Guide with Visual Chips
   */
  async getPlayerForm(playerId, matchLimit = 5) {
    await db.initDb();
    const baseQuery = {
      $or: [{ player_id: playerId }, { player_name: playerId }]
    };

    const limit = Math.min(20, Math.max(1, Number(matchLimit || 5)));
    const ratings = await db.models.PlayerMatchRating.find({ ...baseQuery, verification_status: 'VERIFIED' })
      .sort({ match_date: -1 })
      .limit(limit)
      .lean();

    if (ratings.length === 0) {
      return {
        playerId,
        matches: [],
        average_rating: null,
        batting_trend: 'STEADY',
        bowling_trend: 'STEADY',
        rating_trend: 'STEADY',
        matches_evaluated: 0
      };
    }

    const formattedMatches = ratings.map(r => {
      const stats = r.match_stats || {};

      // Batting Chip Evaluation (Gold = 100+, Green = 50+, Red = <10, Neutral = others)
      let battingChip = { text: 'DNB', color: 'neutral', is_dnb: true };
      if (r.component_availability?.batting) {
        const runs = Number(stats.runs || 0);
        const isNotOut = !stats.is_out;
        const text = `${runs}${isNotOut ? '*' : ''}`;
        let color = 'neutral';
        if (runs >= 100) color = 'gold';
        else if (runs >= 50) color = 'green';
        else if (runs < 10) color = 'red';

        battingChip = {
          text,
          color,
          runs,
          balls: stats.balls || 0,
          strike_rate: stats.strike_rate || 0,
          is_dnb: false
        };
      }

      // Bowling Chip Evaluation
      let bowlingChip = { text: 'DNBowl', color: 'neutral', is_dnbowl: true };
      if (r.component_availability?.bowling) {
        const wickets = Number(stats.wickets || 0);
        const runsConceded = Number(stats.runs_conceded || 0);
        const overs = Number(stats.overs || 0);
        const text = `${wickets}/${runsConceded}`;
        let color = 'neutral';
        if (wickets >= 5) color = 'gold';
        else if (wickets >= 3) color = 'green';
        else if (wickets === 0 && stats.economy > 9.0) color = 'red';

        bowlingChip = {
          text,
          color,
          wickets,
          runs_conceded: runsConceded,
          overs,
          economy: stats.economy || 0,
          is_dnbowl: false
        };
      }

      return {
        match_id: r.match_id,
        tournament_name: r.tournament_name || 'District Match',
        match_date: r.match_date ? new Date(r.match_date).toISOString().split('T')[0] : '2026-10-20',
        format: r.format || 'T20',
        role: r.role || 'BATSMAN',
        rating: r.overall_rating !== null ? `${r.overall_rating} ★` : 'Not Rated',
        raw_rating: r.overall_rating,
        batting_rating: r.batting_rating ?? null,
        bowling_rating: r.bowling_rating ?? null,
        fielding_rating: r.fielding_rating ?? null,
        impact_rating: r.impact_rating ?? null,
        batting_chip: battingChip,
        bowling_chip: bowlingChip,
        fielding_summary: {
          catches: stats.catches || 0,
          run_outs: stats.run_outs || 0,
          stumpings: stats.stumpings || 0
        }
      };
    });

    // Calculate Average Rating in this window
    const validRatings = formattedMatches.filter(m => m.raw_rating !== null).map(m => m.raw_rating);
    const avgRating = validRatings.length > 0 ? Number((validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1)) : null;

    // Calculate Trend (Comparing recent half vs older half)
    let ratingTrend = 'STEADY';
    if (validRatings.length >= 4) {
      const half = Math.floor(validRatings.length / 2);
      const recentAvg = validRatings.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const olderAvg = validRatings.slice(half).reduce((a, b) => a + b, 0) / (validRatings.length - half);
      if (recentAvg - olderAvg >= 0.5) ratingTrend = 'IMPROVING';
      else if (olderAvg - recentAvg >= 0.5) ratingTrend = 'DECLINING';
    }

    return {
      playerId,
      matches: formattedMatches,
      average_rating: avgRating,
      rating_trend: ratingTrend,
      matches_evaluated: formattedMatches.length
    };
  }

  /**
   * Get all match ratings for a specific player
   */
  async getPlayerMatchRatings(playerId, limit = 20) {
    await db.initDb();
    const baseQuery = {
      $or: [{ player_id: playerId }, { player_name: playerId }]
    };
    const maxLimit = Math.min(50, Math.max(1, Number(limit || 20)));
    const docs = await db.models.PlayerMatchRating.find({ ...baseQuery, verification_status: 'VERIFIED' })
      .sort({ match_date: -1 })
      .limit(maxLimit)
      .lean();
    return docs;
  }

  /**
   * Enqueue background match rating recalculation (outside HTTP request path).
   */
  enqueueMatchRatingRecalculation(matchId, reason = 'MATCH_UPDATED') {
    if (!matchId) return;
    const key = String(matchId);
    if (_pendingMatchJobs.has(key)) return;
    _pendingMatchJobs.add(key);
    _jobQueue.push({ matchId: key, reason, attempts: 0 });
    setImmediate(() => this._drainQueue());
  }

  async _drainQueue() {
    if (_workerRunning) return;
    _workerRunning = true;
    try {
      while (_jobQueue.length > 0) {
        const job = _jobQueue.shift();
        if (!job) continue;
        try {
          await this.recalculateMatchRatings(job.matchId);
          _pendingMatchJobs.delete(job.matchId);
        } catch (err) {
          if (job.attempts < 2) {
            job.attempts += 1;
            _jobQueue.push(job);
          } else {
            _pendingMatchJobs.delete(job.matchId);
            console.warn(`[RatingWorker] Failed match ${job.matchId} (${job.reason}):`, err.message);
          }
        }
      }
    } finally {
      _workerRunning = false;
    }
  }

  /**
   * Re-aggregate denormalized career stats on Player from VERIFIED PlayerMatchRating rows.
   */
  async _syncPlayerCareerStats(playerIds = []) {
    if (!Array.isArray(playerIds) || playerIds.length === 0) return;
    const allRatings = await db.models.PlayerMatchRating.find({
      player_id: { $in: playerIds },
      verification_status: 'VERIFIED'
    }).lean();

    const byPlayer = new Map();
    for (const r of allRatings) {
      if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
      byPlayer.get(r.player_id).push(r);
    }

    const matchIds = [...new Set(allRatings.map(r => r.match_id).filter(Boolean))];
    const potmMatches = matchIds.length > 0
      ? await db.models.Match.find({ id: { $in: matchIds }, player_of_the_match: { $ne: null } })
          .select('id player_of_the_match')
          .lean()
      : [];
    const potmCountByPlayer = new Map();
    for (const m of potmMatches) {
      const p = String(m.player_of_the_match || '');
      potmCountByPlayer.set(p, (potmCountByPlayer.get(p) || 0) + 1);
    }

    const bulkOps = [];
    for (const pId of playerIds) {
      const rows = byPlayer.get(pId) || [];
      let innings = 0;
      let notOuts = 0;
      let runs = 0;
      let balls = 0;
      let fours = 0;
      let sixes = 0;
      let fifties = 0;
      let hundreds = 0;
      let highestScore = 0;
      let wickets = 0;
      let ballsBowled = 0;
      let maidens = 0;
      let runsConceded = 0;
      let catches = 0;
      let stumpings = 0;
      let runOuts = 0;
      let bestWkts = -1;
      let bestRuns = 9999;

      for (const r of rows) {
        const s = r.match_stats || {};
        if (r.component_availability?.batting) {
          innings += 1;
          if (!s.is_out) notOuts += 1;
          const rVal = Number(s.runs || 0);
          runs += rVal;
          balls += Number(s.balls || 0);
          fours += Number(s.fours || 0);
          sixes += Number(s.sixes || 0);
          if (rVal >= 100) hundreds += 1;
          else if (rVal >= 50) fifties += 1;
          if (rVal > highestScore) highestScore = rVal;
        }
        if (r.component_availability?.bowling) {
          const w = Number(s.wickets || 0);
          const rc = Number(s.runs_conceded || 0);
          const b = Number(s.balls_bowled || 0) || Math.round(Number(s.overs || 0) * 6);
          wickets += w;
          runsConceded += rc;
          ballsBowled += b;
          maidens += Number(s.maidens || 0);
          if (w > bestWkts || (w === bestWkts && rc < bestRuns)) {
            bestWkts = w;
            bestRuns = rc;
          }
        }
        catches += Number(s.catches || 0);
        stumpings += Number(s.stumpings || 0);
        runOuts += Number(s.run_outs || 0);
      }

      const oversFloat = Number((Math.floor(ballsBowled / 6) + (ballsBowled % 6) / 10).toFixed(1));
      const economy = ballsBowled > 0 ? Number(((runsConceded / ballsBowled) * 6).toFixed(2)) : 0;
      const bestBowling = bestWkts >= 0 ? `${bestWkts}/${bestRuns}` : null;
      const pName = rows[0]?.player_name || '';
      const potmAwards = (potmCountByPlayer.get(pId) || 0) + (pName && pName !== pId ? (potmCountByPlayer.get(pName) || 0) : 0);

      bulkOps.push({
        updateOne: {
          filter: { id: pId },
          update: {
            $set: {
              'stats.matches': rows.length,
              'stats.innings': innings,
              'stats.not_outs': notOuts,
              'stats.runs': runs,
              'stats.balls': balls,
              'stats.fours': fours,
              'stats.sixes': sixes,
              'stats.fifties': fifties,
              'stats.hundreds': hundreds,
              'stats.highest_score': highestScore,
              'stats.wickets': wickets,
              'stats.overs': oversFloat,
              'stats.maidens': maidens,
              'stats.runs_conceded': runsConceded,
              'stats.economy': economy,
              'stats.best_bowling': bestBowling,
              'stats.best_bowling_wickets': bestWkts >= 0 ? bestWkts : 0,
              'stats.best_bowling_runs': bestWkts >= 0 ? bestRuns : 0,
              'stats.catches': catches,
              'stats.stumpings': stumpings,
              'stats.run_outs': runOuts,
              'stats.potm_awards': potmAwards
            }
          }
        }
      });
    }

    if (bulkOps.length > 0 && db.models.Player) {
      await db.models.Player.bulkWrite(bulkOps);
    }
  }

  /**
   * 4. Idempotently Recalculate & Persist Match Ratings for an Entire Match
   * - Only COMPLETED matches (excluding ABANDONED / NO_RESULT) produce VERIFIED ratings.
   * - Players who neither batted, bowled, nor fielded receive no rating.
   * - Batch-fetches players ($in) and queries only dismissal deliveries.
   */
  async recalculateMatchRatings(matchId) {
    await db.initDb();
    const match = await db.models.Match.findOne({ id: matchId })
      .select('id status winner_id is_abandoned team_a_id team_b_id tournament_id tournament_name match_date match_type overs_per_side player_of_the_match')
      .lean();
    if (!match) return { success: false, message: `Match ${matchId} not found` };

    const isAbandonedOrNoResult =
      Boolean(match.is_abandoned) ||
      ['ABANDONED', 'NO_RESULT', 'CANCELLED'].includes(String(match.winner_id || '').toUpperCase()) ||
      ['ABANDONED', 'CANCELLED', 'POSTPONED'].includes(String(match.status || '').toUpperCase());

    if (String(match.status || '').toUpperCase() !== 'COMPLETED' || isAbandonedOrNoResult) {
      const existingRows = await db.models.PlayerMatchRating.find({ match_id: matchId }).select('player_id').lean();
      const affectedIds = existingRows.map(r => r.player_id).filter(Boolean);
      if (affectedIds.length > 0) {
        await db.models.PlayerMatchRating.deleteMany({ match_id: matchId });
        await this._syncPlayerCareerStats(affectedIds);
        affectedIds.forEach(id => this.invalidateCareerRatingsCache(id));
      }
      return { success: true, skipped: true, matchId, playersEvaluated: 0, ratings: [] };
    }

    // Fetch innings for this match first (InningsBatter/InningsBowler are keyed by innings_id)
    const inningsList = await db.models.Innings.find({ match_id: matchId })
      .select('id innings_number batting_team_id bowling_team_id total_runs')
      .sort({ innings_number: 1 })
      .lean();
    const inningsMap = new Map(inningsList.map(i => [i.id, i]));
    const teamTotalRunsMap = new Map();
    for (const inn of inningsList) {
      if (inn?.batting_team_id) {
        teamTotalRunsMap.set(
          inn.batting_team_id,
          (teamTotalRunsMap.get(inn.batting_team_id) || 0) + Number(inn.total_runs || 0)
        );
      }
    }
    const inningsIds = inningsList.map(i => i.id).filter(Boolean);
    const inningScope = inningsIds.length > 0
      ? { $or: [{ match_id: matchId }, { innings_id: { $in: inningsIds } }] }
      : { match_id: matchId };

    // Fetch batters, bowlers, dismissal deliveries, and dot-ball counts per bowler from Delivery
    const [batters, bowlers, dismissalDeliveries, dotBallAgg] = await Promise.all([
      db.models.InningsBatter.find(inningScope)
        .select('innings_id player_id player_name runs balls fours sixes strike_rate is_out dismissal_type dismissal_text fielder_id')
        .lean(),
      db.models.InningsBowler.find(inningScope)
        .select('innings_id player_id player_name overs balls maidens runs_conceded wickets economy')
        .lean(),
      db.models.Delivery.find({
        match_id: matchId,
        dismissal_type: { $in: ['CAUGHT', 'CAUGHT_AND_BOWLED', 'RUN_OUT', 'STUMPED'] }
      })
        .select('fielder_id assist_fielder_id dismissal_type')
        .lean(),
      db.models.Delivery.aggregate([
        { $match: { match_id: matchId, is_legal_delivery: true } },
        {
          $group: {
            _id: '$bowler_id',
            totalLegal: { $sum: 1 },
            // Dot ball = legal delivery where runs charged to bowler (batter runs + wides + no-balls) is 0; byes/leg-byes count as dots
            dotBalls: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $add: [
                          {
                            $cond: [
                              { $in: [{ $toUpper: { $ifNull: ['$extra_type', 'NONE'] } }, ['BYE', 'BYES', 'B', 'LEG_BYE', 'LEGBYE', 'LEG_BYES', 'LB']] },
                              { $ifNull: ['$runs_batter', 0] },
                              { $ifNull: ['$runs_batter', { $ifNull: ['$total_runs', 0] }] }
                            ]
                          },
                          {
                            $cond: [
                              { $in: [{ $toUpper: { $ifNull: ['$extra_type', 'NONE'] } }, ['WIDE', 'WIDES', 'WD', 'NO_BALL', 'NOBALL', 'NB']] },
                              { $ifNull: ['$runs_extras', { $ifNull: ['$extras', 0] }] },
                              0
                            ]
                          }
                        ]
                      },
                      0
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    const dotMap = new Map();
    for (const d of (dotBallAgg || [])) {
      if (d._id) dotMap.set(d._id, { totalLegal: d.totalLegal, dotBalls: d.dotBalls });
    }

    // Track each player's team for THIS match from Innings
    const playerTeamMap = new Map();
    const sortedBatters = [...batters].sort((a, b) => {
      const ia = inningsMap.get(a.innings_id)?.innings_number || 0;
      const ib = inningsMap.get(b.innings_id)?.innings_number || 0;
      return ia - ib;
    });

    const fieldingMap = {};
    for (const del of dismissalDeliveries) {
      const fId = del.fielder_id || del.assist_fielder_id;
      if (!fId) continue;
      if (!fieldingMap[fId]) fieldingMap[fId] = { catches: 0, direct_hit_run_outs: 0, assisted_run_outs: 0, stumpings: 0 };
      if (del.dismissal_type === 'CAUGHT' || del.dismissal_type === 'CAUGHT_AND_BOWLED') {
        fieldingMap[fId].catches++;
      } else if (del.dismissal_type === 'RUN_OUT') {
        if (del.assist_fielder_id && del.assist_fielder_id === fId) fieldingMap[fId].assisted_run_outs++;
        else fieldingMap[fId].direct_hit_run_outs++;
      } else if (del.dismissal_type === 'STUMPED') {
        fieldingMap[fId].stumpings++;
      }
    }

    for (const b of batters) {
      const fId = b.fielder_id;
      if (!fId) continue;
      if (!fieldingMap[fId]) fieldingMap[fId] = { catches: 0, direct_hit_run_outs: 0, assisted_run_outs: 0, stumpings: 0 };
      if (b.dismissal_type === 'CAUGHT') fieldingMap[fId].catches = Math.max(fieldingMap[fId].catches, 1);
      else if (b.dismissal_type === 'STUMPED') fieldingMap[fId].stumpings = Math.max(fieldingMap[fId].stumpings, 1);
      else if (b.dismissal_type === 'RUN_OUT') fieldingMap[fId].direct_hit_run_outs = Math.max(fieldingMap[fId].direct_hit_run_outs, 1);
    }

    // Aggregate per-player batting/bowling across ALL innings (including 2nd innings & super over)
    const batByPlayer = new Map();
    for (const b of sortedBatters) {
      if (!b.player_id) continue;
      const inn = inningsMap.get(b.innings_id);
      if (inn?.batting_team_id) playerTeamMap.set(b.player_id, inn.batting_team_id);
      const battedInInnings = Number(b.balls || 0) > 0 || Number(b.runs || 0) > 0 || Boolean(b.is_out);
      const prev = batByPlayer.get(b.player_id);
      if (!prev) {
        batByPlayer.set(b.player_id, { ...b, innings_batted: battedInInnings ? 1 : 0 });
      } else {
        prev.runs = Number(prev.runs || 0) + Number(b.runs || 0);
        prev.balls = Number(prev.balls || 0) + Number(b.balls || 0);
        prev.fours = Number(prev.fours || 0) + Number(b.fours || 0);
        prev.sixes = Number(prev.sixes || 0) + Number(b.sixes || 0);
        if (battedInInnings) prev.innings_batted = Number(prev.innings_batted || 0) + 1;
        // is_out reflects whether dismissed in the final innings batted
        prev.is_out = Boolean(b.is_out);
        prev.strike_rate = prev.balls > 0 ? Number(((prev.runs / prev.balls) * 100).toFixed(2)) : 0;
      }
    }

    const bowlByPlayer = new Map();
    for (const bw of bowlers) {
      if (!bw.player_id) continue;
      const inn = inningsMap.get(bw.innings_id);
      if (inn?.bowling_team_id && !playerTeamMap.has(bw.player_id)) {
        playerTeamMap.set(bw.player_id, inn.bowling_team_id);
      }
      const prev = bowlByPlayer.get(bw.player_id);
      if (!prev) {
        const bCount = Number(bw.balls || 0) || Math.round(Number(bw.overs || 0) * 6);
        bowlByPlayer.set(bw.player_id, { ...bw, balls: bCount });
      } else {
        prev.wickets = Number(prev.wickets || 0) + Number(bw.wickets || 0);
        prev.runs_conceded = Number(prev.runs_conceded || 0) + Number(bw.runs_conceded || 0);
        prev.maidens = Number(prev.maidens || 0) + Number(bw.maidens || 0);
        const totalBalls = Number(prev.balls || 0) +
          (Number(bw.balls || 0) || Math.round(Number(bw.overs || 0) * 6));
        prev.balls = totalBalls;
        prev.overs = Number((Math.floor(totalBalls / 6) + (totalBalls % 6) / 10).toFixed(1));
        prev.economy = totalBalls > 0 ? Number(((prev.runs_conceded / totalBalls) * 6).toFixed(2)) : 0;
      }
    }

    for (const [pId, bw] of bowlByPlayer.entries()) {
      const dInfo = dotMap.get(pId);
      if (dInfo && dInfo.totalLegal > 0) {
        bw.dot_balls = dInfo.dotBalls;
        bw.has_delivery_dots = true;
      } else {
        bw.has_delivery_dots = false;
      }
    }

    const playerIds = new Set([
      ...batByPlayer.keys(),
      ...bowlByPlayer.keys(),
      ...Object.keys(fieldingMap)
    ]);

    const idList = [...playerIds];
    const playerDocs = idList.length > 0 && db.models.Player
      ? await db.models.Player.find({ $or: [{ id: { $in: idList } }, { name: { $in: idList } }] })
          .select('id name role team_id')
          .lean()
      : [];
    const playerDocMap = new Map();
    for (const pd of playerDocs) {
      if (pd.id) playerDocMap.set(pd.id, pd);
      if (pd.name) playerDocMap.set(pd.name, pd);
    }

    const updatedRatings = [];
    const ratedPlayerIds = [];

    for (const pId of idList) {
      const bStat = batByPlayer.get(pId) || null;
      const bwStat = bowlByPlayer.get(pId) || null;
      const fStat = fieldingMap[pId] || null;

      const didBat = Boolean(bStat && (Number(bStat.balls || 0) >= 6 || Number(bStat.runs || 0) >= 10 || bStat.is_out));
      const didBowl = Boolean(bwStat && (Number(bwStat.overs || 0) > 0 || Number(bwStat.balls || 0) > 0));
      const didField = Boolean(fStat && ((fStat.catches || 0) + (fStat.direct_hit_run_outs || 0) + (fStat.assisted_run_outs || 0) + (fStat.stumpings || 0)) > 0);

      // Rule: a player who neither batted, bowled, nor fielded gets no rating for this match
      if (!didBat && !didBowl && !didField) {
        continue;
      }

      const pDoc = playerDocMap.get(pId) || null;
      const role = pDoc?.role || (didBowl && !didBat ? 'BOWLER' : (didBat && didBowl ? 'ALL_ROUNDER' : 'BATSMAN'));
      const playerName = pDoc?.name || bStat?.player_name || bwStat?.player_name || pId;
      const isPOTM = match.player_of_the_match === pId || match.player_of_the_match === playerName;
      const matchTeamId = playerTeamMap.get(pId) || pDoc?.team_id || null;
      const winnerUpper = String(match.winner_id || '').toUpperCase();
      const isTieOrNoResult = !match.winner_id || ['TIE', 'MATCH_TIED', 'NO_RESULT', 'ABANDONED'].includes(winnerUpper);
      const isWinner = !isTieOrNoResult && Boolean(matchTeamId && matchTeamId === match.winner_id);

      const ratingResult = this.calculateMatchRating({
        battingStats: didBat ? bStat : null,
        bowlingStats: didBowl ? bwStat : null,
        fieldingStats: didField ? fStat : null,
        matchContext: {
          team_total_runs: (matchTeamId && teamTotalRunsMap.get(matchTeamId)) || 0,
          overs_per_side: match.overs_per_side || null,
          team_won: isWinner,
          player_of_the_match: Boolean(isPOTM)
        },
        role,
        format: match.match_type || 'T20'
      });

      const ratingDocId = `PMR-${matchId}-${pId}`;
      const ratingData = {
        id: ratingDocId,
        player_id: pId,
        player_name: playerName,
        match_id: matchId,
        tournament_id: match.tournament_id || null,
        tournament_name: match.tournament_name || 'District League',
        match_date: match.match_date || new Date(),
        format: match.match_type || 'T20',
        role: ratingResult.role,
        batting_rating: ratingResult.batting_rating,
        bowling_rating: ratingResult.bowling_rating,
        fielding_rating: ratingResult.fielding_rating,
        impact_rating: ratingResult.impact_rating,
        overall_rating: ratingResult.overall_rating,
        component_availability: ratingResult.component_availability,
        match_stats: {
          runs: bStat?.runs || 0,
          balls: bStat?.balls || 0,
          fours: bStat?.fours || 0,
          sixes: bStat?.sixes || 0,
          strike_rate: bStat?.strike_rate || 0,
          is_out: bStat?.is_out || false,
          dismissal_text: bStat?.dismissal_text || '',
          overs: bwStat?.overs || 0,
          balls_bowled: bwStat?.balls || 0,
          maidens: bwStat?.maidens || 0,
          runs_conceded: bwStat?.runs_conceded || 0,
          wickets: bwStat?.wickets || 0,
          economy: bwStat?.economy || 0,
          catches: fStat?.catches || 0,
          run_outs: (fStat?.direct_hit_run_outs || 0) + (fStat?.assisted_run_outs || 0),
          stumpings: fStat?.stumpings || 0
        },
        calculation_version: 'v2.0',
        verification_status: 'VERIFIED',
        calculated_at: new Date()
      };

      await db.models.PlayerMatchRating.findOneAndUpdate(
        { player_id: pId, match_id: matchId },
        ratingData,
        { upsert: true, returnDocument: 'after' }
      );

      updatedRatings.push(ratingData);
      ratedPlayerIds.push(pId);
    }

    // Remove stale ratings for players no longer participating in this match
    if (ratedPlayerIds.length > 0) {
      await db.models.PlayerMatchRating.deleteMany({
        match_id: matchId,
        player_id: { $nin: ratedPlayerIds }
      });
      await this._syncPlayerCareerStats(ratedPlayerIds);
      ratedPlayerIds.forEach(id => this.invalidateCareerRatingsCache(id));

      // Emit notification "Your rating was updated" to each rated player
      if (db.models.Notification) {
        const notifDocs = updatedRatings.map(r => ({
          id: `NOTIF-RAT-${matchId}-${r.player_id}-${Date.now()}`,
          type: 'RATING_UPDATED',
          title: 'Your rating was updated',
          message: `Your match rating (${r.overall_rating ?? '—'} ★) was updated for ${r.tournament_name}.`,
          reference_id: r.player_id,
          status: 'UNREAD'
        }));
        await db.models.Notification.insertMany(notifDocs, { ordered: false }).catch(() => {});
      }
    }

    return {
      success: true,
      matchId,
      playersEvaluated: updatedRatings.length,
      ratings: updatedRatings
    };
  }

  /**
   * Nightly reconciliation job: find COMPLETED matches without PlayerMatchRating rows
   * or whose match updatedAt is newer than calculated_at, and recalculate them.
   */
  async reconcileCompletedMatchRatings() {
    await db.initDb();
    const completedMatches = await db.models.Match.find({
      status: 'COMPLETED',
      is_abandoned: { $ne: true },
      winner_id: { $nin: ['ABANDONED', 'NO_RESULT', 'CANCELLED'] }
    })
      .select('id updatedAt')
      .lean();

    const matchIds = completedMatches.map(m => m.id);
    const existing = matchIds.length > 0
      ? await db.models.PlayerMatchRating.aggregate([
          { $match: { match_id: { $in: matchIds } } },
          { $group: { _id: '$match_id', count: { $sum: 1 }, latestCalc: { $max: '$calculated_at' } } }
        ])
      : [];

    const existingMap = new Map(existing.map(e => [e._id, e]));
    let processedCount = 0;

    for (const m of completedMatches) {
      const info = existingMap.get(m.id);
      const isMissing = !info || info.count === 0;
      const isStale = info && m.updatedAt && info.latestCalc && new Date(m.updatedAt) > new Date(info.latestCalc);
      if (isMissing || isStale) {
        await this.recalculateMatchRatings(m.id);
        processedCount++;
      }
    }

    console.log(`[RatingReconciliation] Checked ${completedMatches.length} completed matches; recalculated ${processedCount}.`);
    return { checked: completedMatches.length, recalculated: processedCount };
  }

  /**
   * 5. Public / Portal Ratings Leaderboard (minimum 3 rated matches; Bayesian-shrunk rating)
   */
  async getRatingsLeaderboard({ category = 'overall', format = 'ALL', limit = 10 } = {}) {
    await db.initDb();
    const matchFilter = { verification_status: 'VERIFIED' };
    if (format && format !== 'ALL') {
      matchFilter.format = format.toUpperCase();
    }

    let prior = 5.5;
    try {
      const leagueAgg = await db.models.PlayerMatchRating.aggregate([
        { $match: { verification_status: 'VERIFIED', overall_rating: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$overall_rating' } } }
      ]);
      if (leagueAgg && leagueAgg[0] && typeof leagueAgg[0].avg === 'number') {
        prior = Number(leagueAgg[0].avg.toFixed(2));
      }
    } catch (_e) {}

    const k = 3;
    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$player_id',
          playerName: { $first: '$player_name' },
          role: { $first: '$role' },
          matchesCount: { $sum: 1 },
          avgOverallRating: { $avg: '$overall_rating' },
          avgBattingRating: { $avg: '$batting_rating' },
          avgBowlingRating: { $avg: '$bowling_rating' },
          avgFieldingRating: { $avg: '$fielding_rating' },
          latestMatchDate: { $max: '$match_date' }
        }
      },
      { $match: { matchesCount: { $gte: 3 } } },
      {
        $project: {
          playerId: '$_id',
          playerName: 1,
          role: 1,
          matchesCount: 1,
          overallRating: {
            $round: [
              {
                $divide: [
                  { $add: [{ $multiply: ['$matchesCount', '$avgOverallRating'] }, k * prior] },
                  { $add: ['$matchesCount', k] }
                ]
              },
              1
            ]
          },
          battingRating: { $round: ['$avgBattingRating', 1] },
          bowlingRating: { $round: ['$avgBowlingRating', 1] },
          fieldingRating: { $round: ['$avgFieldingRating', 1] },
          confidence: {
            $cond: [
              { $gte: ['$matchesCount', CONFIDENCE_THRESHOLDS.ESTABLISHED_MIN_MATCHES] }, 'Established',
              { $cond: [{ $gte: ['$matchesCount', CONFIDENCE_THRESHOLDS.DEVELOPING_MIN_MATCHES] }, 'Developing', 'Provisional'] }
            ]
          }
        }
      }
    ];

    let sortField = 'overallRating';
    if (category === 'batting') sortField = 'battingRating';
    else if (category === 'bowling') sortField = 'bowlingRating';

    pipeline.push({ $sort: { [sortField]: -1, matchesCount: -1 } });
    pipeline.push({ $limit: Math.min(50, Math.max(1, Number(limit || 10))) });

    const leaders = await db.models.PlayerMatchRating.aggregate(pipeline);
    return leaders || [];
  }
}

module.exports = new PlayerRatingService();
