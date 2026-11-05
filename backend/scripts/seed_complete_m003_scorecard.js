const db = require('../config/db');

async function seedCompleteM003() {
  await db.initDb();
  console.log('🍃 Connected to MongoDB, seeding complete scorecard for M003...');

  // 1. Clean existing records for M003
  await db.models.InningsBatter.deleteMany({ innings_id: { $in: ['INN-M003-1', 'INN-M003-2'] } });
  await db.models.InningsBowler.deleteMany({ innings_id: { $in: ['INN-M003-1', 'INN-M003-2'] } });
  await db.models.Delivery.deleteMany({ match_id: 'M003' });
  await db.models.Delivery.deleteMany({ innings_id: { $in: ['INN-M003-1', 'INN-M003-2'] } });

  // 2. Ensure Innings exist with exact 160/8 and 144/9 totals
  await db.models.Innings.updateOne(
    { id: 'INN-M003-1' },
    {
      $set: {
        match_id: 'M003',
        innings_number: 1,
        batting_team_id: 'TM-01',
        bowling_team_id: 'TM-02',
        total_runs: 160,
        wickets: 8,
        overs: 20,
        balls: 0,
        is_completed: true,
        status: 'COMPLETED',
        extras: { wides: 6, no_balls: 1, byes: 2, leg_byes: 2, total: 11 }
      }
    },
    { upsert: true }
  );

  await db.models.Innings.updateOne(
    { id: 'INN-M003-2' },
    {
      $set: {
        match_id: 'M003',
        innings_number: 2,
        batting_team_id: 'TM-02',
        bowling_team_id: 'TM-01',
        total_runs: 144,
        wickets: 9,
        overs: 20,
        balls: 0,
        is_completed: true,
        status: 'COMPLETED',
        target: 161,
        extras: { wides: 5, no_balls: 0, byes: 1, leg_byes: 3, total: 9 }
      }
    },
    { upsert: true }
  );

  // 3. Seed Innings 1 Batters (Virudhunagar Spartans: 149 runs + 11 extras = 160/8)
  const battersInn1 = [
    { id: 'IBAT-M003-1-01', innings_id: 'INN-M003-1', player_id: 'P301', batting_position: 1, runs: 42, balls: 30, fours: 4, sixes: 1, strike_rate: 140.0, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P403', fielder_id: 'P401', dismissal_text: 'c †Dinesh Karthik b Karthik N' },
    { id: 'IBAT-M003-1-02', innings_id: 'INN-M003-1', player_id: 'P302', batting_position: 2, runs: 12, balls: 10, fours: 1, sixes: 0, strike_rate: 120.0, is_out: true, dismissal_type: 'BOWLED', bowler_id: 'P403', dismissal_text: 'b Karthik N' },
    { id: 'IBAT-M003-1-03', innings_id: 'INN-M003-1', player_id: 'P303', batting_position: 3, runs: 18, balls: 14, fours: 2, sixes: 0, strike_rate: 128.57, is_out: true, dismissal_type: 'LBW', bowler_id: 'P404', dismissal_text: 'lbw b Saravanan P' },
    { id: 'IBAT-M003-1-04', innings_id: 'INN-M003-1', player_id: 'P304', batting_position: 4, runs: 26, balls: 18, fours: 3, sixes: 1, strike_rate: 144.44, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P408', fielder_id: 'P402', dismissal_text: 'c R. Ashwin b Murugesan A' },
    { id: 'IBAT-M003-1-05', innings_id: 'INN-M003-1', player_id: 'P306', batting_position: 5, runs: 24, balls: 16, fours: 2, sixes: 1, strike_rate: 150.0, is_out: true, dismissal_type: 'RUN_OUT', fielder_id: 'P407', dismissal_text: 'run out (Balaji R)' },
    { id: 'IBAT-M003-1-06', innings_id: 'INN-M003-1', player_id: 'P308', batting_position: 6, runs: 11, balls: 9, fours: 1, sixes: 0, strike_rate: 122.22, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P411', fielder_id: 'P405', dismissal_text: 'c Manikandan K b Selvam R' },
    { id: 'IBAT-M003-1-07', innings_id: 'INN-M003-1', player_id: 'P310', batting_position: 7, runs: 9, balls: 8, fours: 1, sixes: 0, strike_rate: 112.50, is_out: true, dismissal_type: 'CAUGHT_AND_BOWLED', bowler_id: 'P402', dismissal_text: 'c & b R. Ashwin' },
    { id: 'IBAT-M003-1-08', innings_id: 'INN-M003-1', player_id: 'P305', batting_position: 8, runs: 4, balls: 6, fours: 0, sixes: 0, strike_rate: 66.67, is_out: true, dismissal_type: 'BOWLED', bowler_id: 'P411', dismissal_text: 'b Selvam R' },
    { id: 'IBAT-M003-1-09', innings_id: 'INN-M003-1', player_id: 'P307', batting_position: 9, runs: 2, balls: 5, fours: 0, sixes: 0, strike_rate: 40.0, is_out: false, dismissal_text: 'not out' },
    { id: 'IBAT-M003-1-10', innings_id: 'INN-M003-1', player_id: 'P309', batting_position: 10, runs: 1, balls: 4, fours: 0, sixes: 0, strike_rate: 25.0, is_out: false, dismissal_text: 'not out' }
  ];
  await db.models.InningsBatter.insertMany(battersInn1);

  // 4. Seed Innings 1 Bowlers (Sivakasi Strikers: 20 overs, 149 runs + 11 extras = 160 runs, 7 bowler wkts)
  const bowlersInn1 = [
    { id: 'IBOW-M003-1-01', innings_id: 'INN-M003-1', player_id: 'P403', overs: 4, balls: 0, maidens: 0, runs_conceded: 28, runs: 28, wickets: 2, economy: 7.00, no_balls: 0, wides: 1 },
    { id: 'IBOW-M003-1-02', innings_id: 'INN-M003-1', player_id: 'P404', overs: 4, balls: 0, maidens: 0, runs_conceded: 30, runs: 30, wickets: 1, economy: 7.50, no_balls: 0, wides: 2 },
    { id: 'IBOW-M003-1-03', innings_id: 'INN-M003-1', player_id: 'P408', overs: 4, balls: 0, maidens: 0, runs_conceded: 34, runs: 34, wickets: 1, economy: 8.50, no_balls: 1, wides: 1 },
    { id: 'IBOW-M003-1-04', innings_id: 'INN-M003-1', player_id: 'P411', overs: 4, balls: 0, maidens: 0, runs_conceded: 32, runs: 32, wickets: 2, economy: 8.00, no_balls: 0, wides: 1 },
    { id: 'IBOW-M003-1-05', innings_id: 'INN-M003-1', player_id: 'P402', overs: 4, balls: 0, maidens: 0, runs_conceded: 25, runs: 25, wickets: 1, economy: 6.25, no_balls: 0, wides: 1 }
  ];
  await db.models.InningsBowler.insertMany(bowlersInn1);

  // 5. Seed Innings 2 Batters (Sivakasi Strikers: 135 runs + 9 extras = 144/9)
  const battersInn2 = [
    { id: 'IBAT-M003-2-01', innings_id: 'INN-M003-2', player_id: 'P401', batting_position: 1, runs: 38, balls: 26, fours: 4, sixes: 1, strike_rate: 146.15, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P305', fielder_id: 'P301', dismissal_text: 'c Suresh Kumar b R. Vignesh' },
    { id: 'IBAT-M003-2-02', innings_id: 'INN-M003-2', player_id: 'P405', batting_position: 2, runs: 15, balls: 14, fours: 2, sixes: 0, strike_rate: 107.14, is_out: true, dismissal_type: 'BOWLED', bowler_id: 'P307', dismissal_text: 'b Saravanan' },
    { id: 'IBAT-M003-2-03', innings_id: 'INN-M003-2', player_id: 'P407', batting_position: 3, runs: 22, balls: 18, fours: 2, sixes: 1, strike_rate: 122.22, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P309', fielder_id: 'P303', dismissal_text: 'c Vijay b S. Karthik' },
    { id: 'IBAT-M003-2-04', innings_id: 'INN-M003-2', player_id: 'P406', batting_position: 4, runs: 19, balls: 15, fours: 2, sixes: 0, strike_rate: 126.67, is_out: true, dismissal_type: 'LBW', bowler_id: 'P311', dismissal_text: 'lbw b P. Murugan' },
    { id: 'IBAT-M003-2-05', innings_id: 'INN-M003-2', player_id: 'P402', batting_position: 5, runs: 16, balls: 13, fours: 1, sixes: 1, strike_rate: 123.08, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P305', fielder_id: 'P304', dismissal_text: 'c †K. Balaji b R. Vignesh' },
    { id: 'IBAT-M003-2-06', innings_id: 'INN-M003-2', player_id: 'P409', batting_position: 6, runs: 11, balls: 10, fours: 1, sixes: 0, strike_rate: 110.0, is_out: true, dismissal_type: 'RUN_OUT', fielder_id: 'P306', dismissal_text: 'run out (Arun Pandian)' },
    { id: 'IBAT-M003-2-07', innings_id: 'INN-M003-2', player_id: 'P410', batting_position: 7, runs: 6, balls: 8, fours: 0, sixes: 0, strike_rate: 75.0, is_out: true, dismissal_type: 'BOWLED', bowler_id: 'P307', dismissal_text: 'b Saravanan' },
    { id: 'IBAT-M003-2-08', innings_id: 'INN-M003-2', player_id: 'P403', batting_position: 8, runs: 4, balls: 6, fours: 0, sixes: 0, strike_rate: 66.67, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P309', fielder_id: 'P301', dismissal_text: 'c Suresh Kumar b S. Karthik' },
    { id: 'IBAT-M003-2-09', innings_id: 'INN-M003-2', player_id: 'P408', batting_position: 9, runs: 2, balls: 5, fours: 0, sixes: 0, strike_rate: 40.0, is_out: true, dismissal_type: 'BOWLED', bowler_id: 'P311', dismissal_text: 'b P. Murugan' },
    { id: 'IBAT-M003-2-10', innings_id: 'INN-M003-2', player_id: 'P404', batting_position: 10, runs: 1, balls: 3, fours: 0, sixes: 0, strike_rate: 33.33, is_out: false, dismissal_text: 'not out' },
    { id: 'IBAT-M003-2-11', innings_id: 'INN-M003-2', player_id: 'P411', batting_position: 11, runs: 1, balls: 2, fours: 0, sixes: 0, strike_rate: 50.0, is_out: false, dismissal_text: 'not out' }
  ];
  await db.models.InningsBatter.insertMany(battersInn2);

  // 6. Seed Innings 2 Bowlers (Virudhunagar Spartans: 20 overs, 135 runs + 9 extras = 144 runs, 8 bowler wkts)
  const bowlersInn2 = [
    { id: 'IBOW-M003-2-01', innings_id: 'INN-M003-2', player_id: 'P305', overs: 4, balls: 0, maidens: 0, runs_conceded: 26, runs: 26, wickets: 2, economy: 6.50, no_balls: 0, wides: 1 },
    { id: 'IBOW-M003-2-02', innings_id: 'INN-M003-2', player_id: 'P307', overs: 4, balls: 0, maidens: 0, runs_conceded: 24, runs: 24, wickets: 2, economy: 6.00, no_balls: 0, wides: 1 },
    { id: 'IBOW-M003-2-03', innings_id: 'INN-M003-2', player_id: 'P309', overs: 4, balls: 0, maidens: 0, runs_conceded: 28, runs: 28, wickets: 2, economy: 7.00, no_balls: 0, wides: 1 },
    { id: 'IBOW-M003-2-04', innings_id: 'INN-M003-2', player_id: 'P311', overs: 4, balls: 0, maidens: 0, runs_conceded: 30, runs: 30, wickets: 2, economy: 7.50, no_balls: 0, wides: 1 },
    { id: 'IBOW-M003-2-05', innings_id: 'INN-M003-2', player_id: 'P306', overs: 4, balls: 0, maidens: 0, runs_conceded: 27, runs: 27, wickets: 0, economy: 6.75, no_balls: 0, wides: 1 }
  ];
  await db.models.InningsBowler.insertMany(bowlersInn2);

  // 7. Seed Deliveries for interactive Wagon Wheels & Trajectories for both Innings
  const deliveries = [];
  const zones = ['Cover', 'Point', 'Mid-Off', 'Mid-On', 'Midwicket', 'Square Leg', 'Fine Leg', 'Third Man'];
  const angles = [45, 80, 15, 345, 300, 260, 220, 130];

  // Innings 1 deliveries (Suresh Kumar, Muthu Raj, Vijay, Balaji, Arun)
  battersInn1.forEach((bat, bIdx) => {
    const ballsCount = bat.balls || 0;
    for (let i = 1; i <= ballsCount; i++) {
      const isBoundaryFour = i <= bat.fours;
      const isBoundarySix = i === bat.fours + 1 && bat.sixes > 0;
      const runs = isBoundarySix ? 6 : isBoundaryFour ? 4 : (i % 3 === 0 ? 1 : (i % 5 === 0 ? 2 : 0));
      const zIdx = (bIdx + i) % zones.length;
      deliveries.push({
        id: `DEL-M003-1-${bat.player_id}-${i}`,
        match_id: 'M003',
        innings_id: 'INN-M003-1',
        innings_number: 1,
        over_number: Math.floor((bIdx * 12 + i) / 6) + 1,
        ball_number: ((i - 1) % 6) + 1,
        striker_id: bat.player_id,
        non_striker_id: 'P302',
        bowler_id: bowlersInn1[bIdx % bowlersInn1.length].player_id,
        runs_batter: runs,
        runs_extras: 0,
        total_runs: runs,
        extra_type: 'NONE',
        boundary_type: runs === 6 ? 'SIX' : runs === 4 ? 'FOUR' : 'NONE',
        wicket: i === ballsCount && bat.is_out,
        dismissal_type: i === ballsCount && bat.is_out ? bat.dismissal_type : null,
        dismissed_player_id: i === ballsCount && bat.is_out ? bat.player_id : null,
        fielding_position: zones[zIdx],
        shot_zone: zones[zIdx],
        shot_angle: angles[zIdx],
        shot_distance: runs === 6 ? 92 : runs === 4 ? 75 : 45,
        is_legal_delivery: true,
        commentary: `${runs} runs scored by ${bat.player_id}`,
        timestamp: new Date()
      });
    }
  });

  // Innings 2 deliveries (Dinesh Karthik, Manikandan, Balaji R, Vigneshwaran, Ashwin)
  battersInn2.forEach((bat, bIdx) => {
    const ballsCount = bat.balls || 0;
    for (let i = 1; i <= ballsCount; i++) {
      const isBoundaryFour = i <= bat.fours;
      const isBoundarySix = i === bat.fours + 1 && bat.sixes > 0;
      const runs = isBoundarySix ? 6 : isBoundaryFour ? 4 : (i % 3 === 0 ? 1 : (i % 5 === 0 ? 2 : 0));
      const zIdx = (bIdx + i) % zones.length;
      deliveries.push({
        id: `DEL-M003-2-${bat.player_id}-${i}`,
        match_id: 'M003',
        innings_id: 'INN-M003-2',
        innings_number: 2,
        over_number: Math.floor((bIdx * 12 + i) / 6) + 1,
        ball_number: ((i - 1) % 6) + 1,
        striker_id: bat.player_id,
        non_striker_id: 'P402',
        bowler_id: bowlersInn2[bIdx % bowlersInn2.length].player_id,
        runs_batter: runs,
        runs_extras: 0,
        total_runs: runs,
        extra_type: 'NONE',
        boundary_type: runs === 6 ? 'SIX' : runs === 4 ? 'FOUR' : 'NONE',
        wicket: i === ballsCount && bat.is_out,
        dismissal_type: i === ballsCount && bat.is_out ? bat.dismissal_type : null,
        dismissed_player_id: i === ballsCount && bat.is_out ? bat.player_id : null,
        fielding_position: zones[zIdx],
        shot_zone: zones[zIdx],
        shot_angle: angles[zIdx],
        shot_distance: runs === 6 ? 88 : runs === 4 ? 72 : 40,
        is_legal_delivery: true,
        commentary: `${runs} runs scored by ${bat.player_id}`,
        timestamp: new Date()
      });
    }
  });

  await db.models.Delivery.insertMany(deliveries);

  console.log(`✅ Seeded Innings 1: ${battersInn1.length} batters, ${bowlersInn1.length} bowlers.`);
  console.log(`✅ Seeded Innings 2: ${battersInn2.length} batters, ${bowlersInn2.length} bowlers.`);
  console.log(`✅ Seeded ${deliveries.length} total deliveries with Wagon Wheel trajectories.`);
  process.exit(0);
}

seedCompleteM003().catch(err => {
  console.error('❌ Error seeding complete M003:', err);
  process.exit(1);
});
