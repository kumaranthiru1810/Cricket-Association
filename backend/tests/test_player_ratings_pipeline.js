/**
 * backend/tests/test_player_ratings_pipeline.js
 * Automated verification for dynamic player ratings & stats:
 * - Match completes -> ratings & denormalized Player.stats updated + notification emitted
 * - Editing a completed match updates ratings idempotently without duplicates
 * - 0 matches -> getCareerRatings returns nulls & matches_count 0
 * - DNB/DNBowl/no-fielding player is not penalized and receives no rating
 * - Confidence labels: 1-2 Provisional, 3-4 Developing, 5+ Established
 * - Leaderboard returns empty list when no verified ratings exist
 * - Frontend grep check: no old hardcoded rating fallbacks remain
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';

const db = require('../config/db');
const playerRatingService = require('../services/playerRatingService');

async function runTests() {
  await db.initDb();

  const prefix = `TEST-RAT-${Date.now()}`;
  const matchId = `${prefix}-M1`;
  const pBatId = `${prefix}-P1`;
  const pDnbId = `${prefix}-P2`;

  try {
    // 1. Clean 0-match player -> returns nulls and empty leaderboard
    const emptyCareer = await playerRatingService.getCareerRatings(pBatId);
    assert.strictEqual(emptyCareer.overall_rating, null);
    assert.strictEqual(emptyCareer.matches_count, 0);
    assert.strictEqual(emptyCareer.components.batting, null);
    assert.strictEqual(emptyCareer.components.bowling, null);
    assert.strictEqual(emptyCareer.components.fielding, null);
    assert.strictEqual(emptyCareer.components.impact, null);

    // 2. Leaderboard returns [] when no verified ratings exist
    const origFind = db.models.PlayerMatchRating.aggregate;
    db.models.PlayerMatchRating.aggregate = async () => [];
    const emptyLeaders = await playerRatingService.getRatingsLeaderboard();
    assert.deepStrictEqual(emptyLeaders, []);
    db.models.PlayerMatchRating.aggregate = origFind;

    // 3. Seed completed match + 1 active player + 1 DNB/DNBowl player
    await db.models.Player.create([
      { id: pBatId, team_id: `${prefix}-T1`, name: 'Test Batter', role: 'BATTER' },
      { id: pDnbId, team_id: `${prefix}-T1`, name: 'Test DNB Player', role: 'BATTER' }
    ]);

    await db.models.Match.create({
      id: matchId,
      team_a_id: `${prefix}-T1`,
      team_b_id: `${prefix}-T2`,
      match_type: 'T20',
      status: 'COMPLETED',
      winner_id: `${prefix}-T1`,
      tournament_name: 'Audit Cup',
      match_date: new Date()
    });

    await db.models.Innings.create({
      id: `${prefix}-INN1`,
      match_id: matchId,
      innings_number: 1,
      batting_team_id: `${prefix}-T1`,
      bowling_team_id: `${prefix}-T2`,
      total_runs: 150,
      wickets: 2,
      overs: 20,
      balls: 0,
      is_completed: true
    });

    await db.models.InningsBatter.create([
      {
        id: `${prefix}-IB1`,
        innings_id: `${prefix}-INN1`,
        match_id: matchId,
        player_id: pBatId,
        player_name: 'Test Batter',
        runs: 52,
        balls: 34,
        fours: 6,
        sixes: 2,
        strike_rate: 152.94,
        is_out: false
      },
      {
        id: `${prefix}-IB2`,
        innings_id: `${prefix}-INN1`,
        match_id: matchId,
        player_id: pDnbId,
        player_name: 'Test DNB Player',
        runs: 0,
        balls: 0,
        is_out: false
      }
    ]);

    // Recalculate completed match
    const res1 = await playerRatingService.recalculateMatchRatings(matchId);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.playersEvaluated, 1, 'DNB/DNBowl/no-fielding player must not receive a match rating');

    const dnbRating = await db.models.PlayerMatchRating.findOne({ match_id: matchId, player_id: pDnbId }).lean();
    assert.strictEqual(dnbRating, null);

    const batPlayer = await db.models.Player.findOne({ id: pBatId }).lean();
    assert.strictEqual(batPlayer.stats.matches, 1);
    assert.strictEqual(batPlayer.stats.runs, 52);
    assert.strictEqual(batPlayer.stats.fifties, 1);
    assert.strictEqual(batPlayer.stats.highest_score, 52);

    const notif = await db.models.Notification.findOne({ reference_id: pBatId, type: 'RATING_UPDATED' }).lean();
    assert(notif && /rating was updated/i.test(notif.title), 'Rating update notification must be emitted');

    // 4. Edit completed match & re-run -> idempotent upsert, no duplicates
    await db.models.InningsBatter.updateOne({ id: `${prefix}-IB1` }, { $set: { runs: 101, balls: 55 } });
    await playerRatingService.recalculateMatchRatings(matchId);
    const allRows = await db.models.PlayerMatchRating.find({ match_id: matchId, player_id: pBatId }).lean();
    assert.strictEqual(allRows.length, 1, 'Must not create duplicate PlayerMatchRating rows');
    const updatedPlayer = await db.models.Player.findOne({ id: pBatId }).lean();
    assert.strictEqual(updatedPlayer.stats.runs, 101);
    assert.strictEqual(updatedPlayer.stats.hundreds, 1);

    // 5. Confidence labels (1-2 Provisional, 3-4 Developing, 5+ Established)
    const c1 = await playerRatingService.getCareerRatings(pBatId);
    assert.strictEqual(c1.confidence, 'Provisional');

    for (let i = 2; i <= 5; i++) {
      await db.models.PlayerMatchRating.create({
        id: `PMR-${prefix}-M${i}-${pBatId}`,
        player_id: pBatId,
        player_name: 'Test Batter',
        match_id: `${prefix}-M${i}`,
        format: 'T20',
        overall_rating: 8.2,
        verification_status: 'VERIFIED',
        match_date: new Date()
      });
      playerRatingService.invalidateCareerRatingsCache(pBatId);
      if (i === 3) {
        const c3 = await playerRatingService.getCareerRatings(pBatId);
        assert.strictEqual(c3.confidence, 'Developing');
      }
      if (i === 5) {
        const c5 = await playerRatingService.getCareerRatings(pBatId);
        assert.strictEqual(c5.confidence, 'Established');
      }
    }

    // 6. Frontend grep check: no old hardcoded rating fallbacks remain
    const dashboardSrc = fs.readFileSync(
      path.resolve(__dirname, '../../mobile_frontend/src/screens/player/PlayerDashboardScreen.tsx'),
      'utf8'
    );
    for (const forbidden of ["'7.5'", "'7.8 ★'", "'7.2 ★'", "'8.0 ★'", "'7.5 ★'", 'TNCA standards']) {
      assert(!dashboardSrc.includes(forbidden), `Forbidden hardcoded fallback still present: ${forbidden}`);
    }

    // 7. Batsman with 5 wickets gets bowling credit (role inferred as ALL_ROUNDER/BOWLER, non-zero bowling weight)
    const batWith5Wkts = playerRatingService.calculateMatchRating({
      battingStats: { runs: 12, balls: 14, fours: 1, sixes: 0, is_out: true },
      bowlingStats: { overs: 4, balls: 24, runs_conceded: 20, wickets: 5, maidens: 1, dot_balls: 14, has_delivery_dots: true },
      role: 'BATSMAN',
      format: 'T20'
    });
    assert.strictEqual(batWith5Wkts.role, 'ALL_ROUNDER');
    assert(batWith5Wkts.bowling_rating >= 8.0, '5-wicket haul must yield high bowling rating');
    assert(batWith5Wkts.overall_rating >= 6.5, 'Batsman taking 5 wickets must receive bowling credit in overall');

    // 8. Catch never lowers overall rating
    const noCatch = playerRatingService.calculateMatchRating({
      battingStats: { runs: 45, balls: 30, fours: 5, sixes: 1, is_out: false },
      fieldingStats: null,
      role: 'BATSMAN',
      format: 'T20'
    });
    const withCatch = playerRatingService.calculateMatchRating({
      battingStats: { runs: 45, balls: 30, fours: 5, sixes: 1, is_out: false },
      fieldingStats: { catches: 1, direct_hit_run_outs: 0, assisted_run_outs: 0, stumpings: 0 },
      role: 'BATSMAN',
      format: 'T20'
    });
    assert(withCatch.overall_rating >= noCatch.overall_rating, 'Taking a catch must never lower overall rating');

    // 9. 8-over match benchmark scaling + range 0..10 check
    const eightOver = playerRatingService.calculateMatchRating({
      battingStats: { runs: 20, balls: 10, fours: 2, sixes: 1, is_out: false },
      matchContext: { overs_per_side: 8, team_won: true },
      role: 'BATSMAN',
      format: 'T20'
    });
    assert(eightOver.overall_rating >= 0 && eightOver.overall_rating <= 10);
    assert(eightOver.batting_rating >= 7.5, '20 off 10 in an 8-over match (2x scaled par) should score strongly');

    // 10. Two-innings MULTI_DAY aggregation + guest player win bonus + tie gives no win bonus
    const mdMatchId = `${prefix}-MD1`;
    const guestId = `${prefix}-GUEST`;
    await db.models.Match.create({
      id: mdMatchId,
      team_a_id: `${prefix}-TA`,
      team_b_id: `${prefix}-TB`,
      match_type: 'MULTI_DAY',
      status: 'COMPLETED',
      winner_id: `${prefix}-TA`,
      match_date: new Date()
    });
    await db.models.Innings.create([
      { id: `${prefix}-MD-I1`, match_id: mdMatchId, innings_number: 1, batting_team_id: `${prefix}-TA`, bowling_team_id: `${prefix}-TB` },
      { id: `${prefix}-MD-I3`, match_id: mdMatchId, innings_number: 3, batting_team_id: `${prefix}-TA`, bowling_team_id: `${prefix}-TB` }
    ]);
    await db.models.InningsBatter.create([
      { id: `${prefix}-MDB1`, innings_id: `${prefix}-MD-I1`, player_id: guestId, player_name: 'Guest Star', runs: 40, balls: 60, is_out: true },
      { id: `${prefix}-MDB2`, innings_id: `${prefix}-MD-I3`, player_id: guestId, player_name: 'Guest Star', runs: 35, balls: 45, is_out: false }
    ]);
    const mdRes = await playerRatingService.recalculateMatchRatings(mdMatchId);
    assert.strictEqual(mdRes.playersEvaluated, 1);
    assert.strictEqual(mdRes.ratings[0].match_stats.runs, 75);
    assert.strictEqual(mdRes.ratings[0].match_stats.is_out, false, 'Final innings was not out');
    assert(mdRes.ratings[0].impact_rating >= 6.5, 'Guest player on winning team must get win bonus');

    const tieImpact = playerRatingService.calculateMatchRating({
      battingStats: { runs: 30, balls: 25 },
      matchContext: { team_won: false },
      role: 'BATSMAN',
      format: 'T20'
    });
    assert.strictEqual(tieImpact.impact_rating, 5.0, 'Tie/no-win gives neutral 5.0 impact without win bonus');

    // 11. Bayesian shrinkage: 1-match player ranks below 6-match player with identical raw rating
    const oneMatchId = `${prefix}-ONE`;
    const sixMatchId = `${prefix}-SIX`;
    await db.models.PlayerMatchRating.create({
      id: `PMR-${prefix}-ONE-1`, player_id: oneMatchId, player_name: 'One Match', match_id: `${prefix}-OM1`,
      format: 'T20', overall_rating: 8.5, verification_status: 'VERIFIED', match_date: new Date()
    });
    for (let k = 1; k <= 6; k++) {
      await db.models.PlayerMatchRating.create({
        id: `PMR-${prefix}-SIX-${k}`, player_id: sixMatchId, player_name: 'Six Match', match_id: `${prefix}-SM${k}`,
        format: 'T20', overall_rating: 8.5, verification_status: 'VERIFIED', match_date: new Date()
      });
    }
    const oneCareer = await playerRatingService.getCareerRatings(oneMatchId);
    const sixCareer = await playerRatingService.getCareerRatings(sixMatchId);
    assert(oneCareer.overall_rating < sixCareer.overall_rating, '1-match player must rank below 6-match established player due to Bayesian shrinkage');
    assert.strictEqual(oneCareer.raw_overall_rating, 8.5, 'Career API must return raw_overall_rating');
    assert.strictEqual(oneCareer.matches_count, 1, 'Career API must return matches_count');

    // 12. Batting threshold: < 6 balls, < 10 runs, not out -> treated as DNB
    const cameoBowler = playerRatingService.calculateMatchRating({
      battingStats: { runs: 4, balls: 3, is_out: false },
      bowlingStats: { overs: 4, balls_bowled: 24, runs_conceded: 24, wickets: 2 },
      role: 'BOWLER',
      format: 'T20'
    });
    assert.strictEqual(cameoBowler.component_availability.batting, false, '4*(3) not out must be treated as DNB');
    assert.strictEqual(cameoBowler.batting_rating, null);
    assert.strictEqual(cameoBowler.role, 'BOWLER', 'Short cameo must not switch BOWLER to ALL_ROUNDER');

    // 13. Multi-innings parRuns scaling: 60 in 1 innings rates higher than 30+30 in 2 innings (MULTI_DAY)
    const oneInn60 = playerRatingService.calculateMatchRating({
      battingStats: { runs: 60, balls: 90, fours: 6, sixes: 0, is_out: true, innings_batted: 1 },
      role: 'BATSMAN',
      format: 'MULTI_DAY'
    });
    const twoInn3030 = playerRatingService.calculateMatchRating({
      battingStats: { runs: 60, balls: 90, fours: 6, sixes: 0, is_out: true, innings_batted: 2 },
      role: 'BATSMAN',
      format: 'MULTI_DAY'
    });
    assert(oneInn60.batting_rating > twoInn3030.batting_rating, '60 in 1 innings must rate higher than 30+30 across 2 innings');

    // 14. Dot ball definition: byes and leg-byes on legal deliveries count as dots for the bowler
    const dotMatchId = `${prefix}-DOT-M1`;
    const dotBowlerId = `${prefix}-DOT-BW1`;
    await db.models.Match.create({
      id: dotMatchId, team_a_id: 'TA', team_b_id: 'TB', status: 'COMPLETED', match_type: 'T20', overs_per_side: 20, match_date: new Date()
    });
    await db.models.Innings.create({
      id: `${prefix}-DOT-I1`, match_id: dotMatchId, innings_number: 1, batting_team_id: 'TA', bowling_team_id: 'TB'
    });
    await db.models.InningsBowler.create({
      id: `${prefix}-DOT-IBW1`, innings_id: `${prefix}-DOT-I1`, player_id: dotBowlerId, player_name: 'Dot Bowler',
      overs: 1, balls: 6, maidens: 0, runs_conceded: 4, wickets: 0
    });
    await db.models.Delivery.create([
      { id: `${prefix}-D1`, match_id: dotMatchId, innings_id: `${prefix}-DOT-I1`, over_number: 1, ball_number: 1, bowler_id: dotBowlerId, striker_id: 'X', runs_batter: 0, runs_extras: 1, total_runs: 1, extra_type: 'BYE', is_legal_delivery: true },
      { id: `${prefix}-D2`, match_id: dotMatchId, innings_id: `${prefix}-DOT-I1`, over_number: 1, ball_number: 2, bowler_id: dotBowlerId, striker_id: 'X', runs_batter: 0, runs_extras: 2, total_runs: 2, extra_type: 'LEG_BYE', is_legal_delivery: true },
      { id: `${prefix}-D3`, match_id: dotMatchId, innings_id: `${prefix}-DOT-I1`, over_number: 1, ball_number: 3, bowler_id: dotBowlerId, striker_id: 'X', runs_batter: 0, runs_extras: 0, total_runs: 0, extra_type: 'NONE', is_legal_delivery: true },
      { id: `${prefix}-D4`, match_id: dotMatchId, innings_id: `${prefix}-DOT-I1`, over_number: 1, ball_number: 4, bowler_id: dotBowlerId, striker_id: 'X', runs_batter: 4, runs_extras: 0, total_runs: 4, extra_type: 'NONE', is_legal_delivery: true },
      { id: `${prefix}-D5`, match_id: dotMatchId, innings_id: `${prefix}-DOT-I1`, over_number: 1, ball_number: 5, bowler_id: dotBowlerId, striker_id: 'X', runs_batter: 0, runs_extras: 0, total_runs: 0, extra_type: 'NONE', is_legal_delivery: true },
      { id: `${prefix}-D6`, match_id: dotMatchId, innings_id: `${prefix}-DOT-I1`, over_number: 1, ball_number: 6, bowler_id: dotBowlerId, striker_id: 'X', runs_batter: 0, runs_extras: 0, total_runs: 0, extra_type: 'NONE', is_legal_delivery: true }
    ]);
    // 5 dots out of 6 legal balls (bye + leg_bye + 3 pure dots) -> dotRatio = 5/6 = 0.8333
    const dotRes = await playerRatingService.recalculateMatchRatings(dotMatchId);
    assert.strictEqual(dotRes.playersEvaluated, 1);
    const expected5Dots = playerRatingService.calculateMatchRating({
      bowlingStats: { overs: 1, balls_bowled: 6, runs_conceded: 4, wickets: 0, dot_balls: 5, has_delivery_dots: true },
      role: 'BOWLER',
      format: 'T20'
    });
    assert.strictEqual(dotRes.ratings[0].bowling_rating, expected5Dots.bowling_rating, 'Byes/leg-byes must count as dots for bowler');

    // 15. Hand-calculated tests (tolerance 0.1)
    const handBat = playerRatingService.calculateMatchRating({
      battingStats: { runs: 40, balls: 25, fours: 4, sixes: 2, is_out: true },
      role: 'BATSMAN',
      format: 'T20'
    });
    assert(Math.abs(handBat.batting_rating - 7.4) <= 0.1, `Expected batting 40(25) 4x4 2x6 ~7.4, got ${handBat.batting_rating}`);

    const handBat180 = playerRatingService.calculateMatchRating({
      battingStats: { runs: 40, balls: 25, fours: 4, sixes: 2, is_out: true },
      matchContext: { team_total_runs: 180 },
      role: 'BATSMAN',
      format: 'T20'
    });
    assert(Math.abs(handBat180.batting_rating - 7.4) <= 0.1, `Expected batting 40(25) in 180 team total ~7.4, got ${handBat180.batting_rating}`);

    const handBowl = playerRatingService.calculateMatchRating({
      bowlingStats: { overs: 4, balls_bowled: 24, runs_conceded: 28, wickets: 2, maidens: 0, dot_balls: 10, has_delivery_dots: true },
      role: 'BOWLER',
      format: 'T20'
    });
    assert(Math.abs(handBowl.bowling_rating - 6.7) <= 0.1, `Expected bowling 4-0-28-2 (10 dots) ~6.7, got ${handBowl.bowling_rating}`);

    // 16. Real innings total_runs used for team share bonus (40/180 < 25% -> no +0.4 bonus, vs 40/100 = 40% -> +0.8 bonus)
    const mHighTotal = `${prefix}-TT-HIGH`;
    const mLowTotal = `${prefix}-TT-LOW`;
    const ttPlayer = `${prefix}-TT-P1`;
    await db.models.Match.create([
      { id: mHighTotal, team_a_id: 'TA', team_b_id: 'TB', status: 'COMPLETED', match_type: 'T20', overs_per_side: 20, match_date: new Date() },
      { id: mLowTotal, team_a_id: 'TA', team_b_id: 'TB', status: 'COMPLETED', match_type: 'T20', overs_per_side: 20, match_date: new Date() }
    ]);
    await db.models.Innings.create([
      { id: `${prefix}-TT-I1`, match_id: mHighTotal, innings_number: 1, batting_team_id: 'TA', bowling_team_id: 'TB', total_runs: 200 },
      { id: `${prefix}-TT-I2`, match_id: mLowTotal, innings_number: 1, batting_team_id: 'TA', bowling_team_id: 'TB', total_runs: 100 }
    ]);
    await db.models.InningsBatter.create([
      { id: `${prefix}-TT-B1`, innings_id: `${prefix}-TT-I1`, player_id: ttPlayer, player_name: 'TT Batter', runs: 40, balls: 25, fours: 4, sixes: 2, is_out: true },
      { id: `${prefix}-TT-B2`, innings_id: `${prefix}-TT-I2`, player_id: ttPlayer, player_name: 'TT Batter', runs: 40, balls: 25, fours: 4, sixes: 2, is_out: true }
    ]);
    const highTotalRes = await playerRatingService.recalculateMatchRatings(mHighTotal);
    const lowTotalRes = await playerRatingService.recalculateMatchRatings(mLowTotal);
    assert(
      lowTotalRes.ratings[0].batting_rating > highTotalRes.ratings[0].batting_rating,
      `40/100 (40% share) must rate higher than 40/200 (20% share): got ${lowTotalRes.ratings[0].batting_rating} vs ${highTotalRes.ratings[0].batting_rating}`
    );

    console.log('✅ All Dynamic Player Rating Pipeline tests passed!');
  } finally {
    await Promise.all([
      db.models.Player.deleteMany({ id: new RegExp(`^${prefix}`) }),
      db.models.Match.deleteMany({ id: new RegExp(`^${prefix}`) }),
      db.models.Innings.deleteMany({ match_id: new RegExp(`^${prefix}`) }),
      db.models.InningsBatter.deleteMany({ id: new RegExp(`^${prefix}`) }),
      db.models.InningsBowler.deleteMany({ id: new RegExp(`^${prefix}`) }),
      db.models.Delivery.deleteMany({ match_id: new RegExp(`^${prefix}`) }),
      db.models.PlayerMatchRating.deleteMany({ match_id: new RegExp(`^${prefix}`) }),
      db.models.PlayerMatchRating.deleteMany({ player_id: new RegExp(`^${prefix}`) }),
      db.models.Notification.deleteMany({ reference_id: new RegExp(`^${prefix}`) })
    ]);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Rating pipeline test failed:', err);
    process.exit(1);
  });
