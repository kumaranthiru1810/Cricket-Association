/**
 * scripts/restoreData.js
 * Restores all cleaned and default database records for the Cricket Association system.
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function restoreDatabase() {
  console.log('🔄 Starting Cricket Association Database Restoration...');
  await db.initDb();

  const {
    User,
    Tournament,
    Team,
    Player,
    TeamRegistration,
    TournamentRegistration,
    Match,
    Innings,
    InningsBatter,
    InningsBowler,
    Delivery,
    Notification,
    News,
    Official,
    Venue
  } = db.models;

  const defaultPasswordHash = await bcrypt.hash('1234', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // 1. Users
  console.log('👤 Restoring users...');
  const users = [
    { id: 'ADM-1001', name: 'System Administrator', email: 'admin@example.com', mobile: '9876543210', role: 'ADMIN', status: 'ACTIVE', password_hash: defaultPasswordHash },
    { id: 'ADM-1002', name: 'Chief Administrator', email: 'admin@cfvd.org', mobile: '9876543210', role: 'ADMIN', status: 'ACTIVE', password_hash: adminPasswordHash },
    { id: 'ADM-1003', name: 'Association Admin', email: 'cricketfederation21@gmail.com', mobile: '9876543211', role: 'ADMIN', status: 'ACTIVE', password_hash: adminPasswordHash },
    { id: 'ADM-1004', name: 'Athilingam (Admin & Scorer)', email: 'athilingam3336@gmail.com', mobile: '9876543212', role: 'ADMIN', status: 'ACTIVE', password_hash: adminPasswordHash },
    { id: 'ADM-1005', name: 'Ponramanan (Admin & Scorer)', email: 'ponramanan21@gmail.com', mobile: '9876543221', role: 'ADMIN', status: 'ACTIVE', password_hash: adminPasswordHash },
    { id: 'SCR-101', name: 'S. Ramesh', email: 'ramesh@gmail.com', mobile: '9876543213', role: 'SCORER', status: 'ACTIVE', password_hash: defaultPasswordHash },
    { id: 'SCR-102', name: 'S. Ramesh', email: 'scorer@cfvd.org', mobile: '9876543213', role: 'SCORER', status: 'ACTIVE', password_hash: defaultPasswordHash },
    { id: 'SCR-103', name: 'K. Murugan', email: 'murugan@cfvd.org', mobile: '9876543214', role: 'SCORER', status: 'ACTIVE', password_hash: defaultPasswordHash },
    { id: 'COACH-101', name: 'R. Kannan (Coach)', email: 'kannan.coach@strikerscc.org', mobile: '9876543215', role: 'COACH', status: 'ACTIVE', password_hash: defaultPasswordHash },
    { id: 'PLY-101', name: 'R. Saravanan (Player)', email: 'saravanan.r@strikerscc.org', mobile: '9876543216', role: 'PLAYER', status: 'ACTIVE', password_hash: defaultPasswordHash, player_details: { batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast/Medium', taluk: 'Virudhunagar', category: 'Senior Men', club_choice: 'Sivakasi Strikers' } },
    { id: 'PLY-201', name: 'Arun Pandian', email: 'player@example.com', mobile: '9876543214', password_hash: defaultPasswordHash, role: 'PLAYER', status: 'ACTIVE' },
    { id: 'USR-301', name: 'General User', email: 'user@example.com', mobile: '9876543215', password_hash: defaultPasswordHash, role: 'USER', status: 'ACTIVE' },
    { id: 'UMP-101', name: 'Thiru. K. Sundaram', email: 'sundaram.umpire@cfvd.org', mobile: '9443112345', password_hash: defaultPasswordHash, role: 'UMPIRE', status: 'ACTIVE', umpire_details: { certification_level: 'Panel A - Senior', taluk: 'Virudhunagar' } },
    { id: 'UMP-102', name: 'Thiru. M. Ramanathan', email: 'ramanathan.umpire@cfvd.org', mobile: '9842267890', password_hash: defaultPasswordHash, role: 'UMPIRE', status: 'ACTIVE', umpire_details: { certification_level: 'Senior Panel', taluk: 'Sivakasi' } }
  ];

  for (const u of users) {
    await User.findOneAndUpdate({ email: u.email }, { $setOnInsert: u }, { upsert: true });
  }

  // 2. Tournaments
  console.log('🏆 Restoring tournaments...');
  const tournaments = [
    { 
      id: 'T-2026-VPL', 
      name: 'Virudhunagar Premier League 2026', 
      short_name: 'VPL 2026',
      description: 'Official Premier League of Virudhunagar District Cricket Association with 16 elite regional clubs.',
      tournament_type: 'LEAGUE_KNOCKOUT',
      season: '2026', 
      category: 'Senior District Trophy', 
      format: 'T20', 
      match_format: 'T20',
      overs_per_match: 20,
      venue: 'Kamarajar District Stadium, Virudhunagar',
      max_teams: 16,
      min_teams: 4,
      registration_start_date: '2026-09-01',
      registration_end_date: '2026-11-30',
      status: 'REGISTRATION_OPEN', 
      start_date: '2026-10-01', 
      end_date: '2026-11-25',
      teams: ['TM-01', 'TM-02']
    },
    { 
      id: 'T-2026-U19', 
      name: 'District Under-19 Championship', 
      short_name: 'U19 District Cup',
      description: 'Annual inter-taluk talent championship for under-19 district player selections.',
      tournament_type: 'KNOCKOUT',
      season: '2026', 
      category: 'Junior Championship', 
      format: 'ODI', 
      match_format: 'ODI',
      overs_per_match: 50,
      venue: 'Municipal Cricket Complex, Sivakasi',
      max_teams: 12,
      min_teams: 4,
      registration_start_date: '2026-09-15',
      registration_end_date: '2026-12-15',
      status: 'REGISTRATION_OPEN', 
      start_date: '2026-11-01', 
      end_date: '2026-11-20',
      teams: []
    },
    { 
      id: 'T-2026-SUPER8', 
      name: 'Kamarajar Memorial Knockout Trophy 2026', 
      short_name: 'KMKT 2026',
      description: 'Prestigious high-octane knockout championship open for all district affiliated cricket teams.',
      tournament_type: 'KNOCKOUT',
      season: '2026', 
      category: 'District Open Knockout', 
      format: 'T20', 
      match_format: 'T20',
      overs_per_match: 20,
      venue: 'Kamarajar District Stadium, Virudhunagar',
      max_teams: 8,
      min_teams: 4,
      registration_start_date: '2026-10-01',
      registration_end_date: '2026-12-31',
      status: 'REGISTRATION_OPEN', 
      start_date: '2026-12-01', 
      end_date: '2026-12-15',
      teams: []
    }
  ];

  for (const t of tournaments) {
    await Tournament.findOneAndUpdate({ id: t.id }, { $setOnInsert: t }, { upsert: true });
  }

  // 3. Teams
  console.log('🛡️ Restoring teams...');
  const teams = [
    { id: 'TM-01', team_id: 'TEAM-VRD-101', name: 'Virudhunagar Spartans', team_name: 'Virudhunagar Spartans', short_name: 'VND', city: 'Virudhunagar', taluk: 'Virudhunagar', coach_name: 'K. Muthu', coach_email: 'coach@cfvd.org', captain: 'Suresh Kumar', vice_captain: 'Vijay Anand', status: 'ACTIVE', stats: { matches: 5, won: 4, lost: 1, tied: 0, points: 8, nrr: 1.25 } },
    { id: 'TM-02', team_id: 'TEAM-VRD-102', name: 'Sivakasi Strikers', team_name: 'Sivakasi Strikers', short_name: 'SVK', city: 'Sivakasi', taluk: 'Sivakasi', coach_name: 'S. Ganesan', coach_email: 'ganesan@strikers.com', captain: 'Dinesh Karthik', vice_captain: 'R. Ashwin', status: 'ACTIVE', stats: { matches: 5, won: 3, lost: 2, tied: 0, points: 6, nrr: 0.85 } },
    { id: 'TM-03', team_id: 'TEAM-VRD-103', name: 'Rajapalayam Royals', team_name: 'Rajapalayam Royals', short_name: 'RPY', city: 'Rajapalayam', taluk: 'Rajapalayam', coach_name: 'R. Subramanian', coach_email: 'coach.royals@gmail.com', captain: 'M. Vijay', vice_captain: 'K. Balaji', status: 'ACTIVE', stats: { matches: 5, won: 2, lost: 3, tied: 0, points: 4, nrr: -0.15 } },
    { id: 'TM-04', team_id: 'TEAM-VRD-104', name: 'Aruppukottai Aces', team_name: 'Aruppukottai Aces', short_name: 'APK', city: 'Aruppukottai', taluk: 'Aruppukottai', coach_name: 'V. Raman', coach_email: 'coach.aces@gmail.com', captain: 'P. Saravanan', vice_captain: 'T. Prabhu', status: 'ACTIVE', stats: { matches: 4, won: 1, lost: 3, tied: 0, points: 2, nrr: -1.10 } }
  ];

  for (const tm of teams) {
    await Team.findOneAndUpdate({ id: tm.id }, { $setOnInsert: tm }, { upsert: true });
  }

  // 4. Players (60 Players across 4 teams)
  console.log('🏏 Restoring players...');
  const rawPlayers = [
    // Team 1 (TM-01) - 15 Players
    { id: 'P301', team_id: 'TM-01', name: 'Suresh Kumar', email: 'suresh@spartans.com', role: 'BATTER', jersey_number: 7, batting_style: 'Right Hand Bat', stats: { runs: 284, balls: 195, fours: 32, sixes: 10, highest_score: 88, wickets: 0, overs: 0, runs_conceded: 0, catches: 4, stumpings: 0 } },
    { id: 'P302', team_id: 'TM-01', name: 'Muthu Raj', email: 'muthuraj@spartans.com', role: 'ALL_ROUNDER', jersey_number: 18, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium', stats: { runs: 165, balls: 110, fours: 15, sixes: 6, highest_score: 54, wickets: 8, overs: 18, runs_conceded: 124, catches: 3, stumpings: 0 } },
    { id: 'P303', team_id: 'TM-01', name: 'Vijay', email: 'vijay@spartans.com', role: 'BATTER', jersey_number: 3, batting_style: 'Left Hand Bat', stats: { runs: 142, balls: 98, fours: 14, sixes: 4, highest_score: 45, wickets: 0, overs: 0, runs_conceded: 0, catches: 2, stumpings: 0 } },
    { id: 'P304', team_id: 'TM-01', name: 'K. Balaji', email: 'balaji@spartans.com', role: 'WICKET_KEEPER', jersey_number: 1, batting_style: 'Right Hand Bat', stats: { runs: 112, balls: 85, fours: 10, sixes: 2, highest_score: 38, wickets: 0, overs: 0, runs_conceded: 0, catches: 6, stumpings: 3 } },
    { id: 'P305', team_id: 'TM-01', name: 'R. Vignesh', email: 'vignesh@spartans.com', role: 'BOWLER', jersey_number: 23, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast', stats: { runs: 24, balls: 18, fours: 2, sixes: 1, highest_score: 14, wickets: 12, overs: 20, runs_conceded: 130, catches: 1, stumpings: 0 } },
    { id: 'P306', team_id: 'TM-01', name: 'Arun Pandian', email: 'player@example.com', role: 'ALL_ROUNDER', jersey_number: 10, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium', stats: { runs: 198, balls: 135, fours: 21, sixes: 7, highest_score: 62, wickets: 6, overs: 14, runs_conceded: 98, catches: 5, stumpings: 0 } },
    { id: 'P307', team_id: 'TM-01', name: 'Saravanan', email: 'saravanan@spartans.com', role: 'BOWLER', jersey_number: 25, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast', stats: { runs: 15, balls: 10, fours: 1, sixes: 0, highest_score: 8, wickets: 10, overs: 18, runs_conceded: 120, catches: 1, stumpings: 0 } },
    { id: 'P308', team_id: 'TM-01', name: 'Vijay Anand', email: 'vijayanand@spartans.com', role: 'ALL_ROUNDER', jersey_number: 9, batting_style: 'Right Hand Bat', stats: { runs: 150, balls: 100, fours: 15, sixes: 4, highest_score: 52, wickets: 5, overs: 12, runs_conceded: 80, catches: 2, stumpings: 0 } },
    { id: 'P309', team_id: 'TM-01', name: 'S. Manoj', email: 'manoj.s@spartans.com', role: 'BATTER', jersey_number: 11, stats: { runs: 95, balls: 70, fours: 8, sixes: 2, highest_score: 34 } },
    { id: 'P310', team_id: 'TM-01', name: 'P. Rajesh', email: 'rajesh.p@spartans.com', role: 'BOWLER', jersey_number: 14, stats: { wickets: 7, overs: 15, runs_conceded: 95 } },
    { id: 'P311', team_id: 'TM-01', name: 'K. Siva', email: 'siva.k@spartans.com', role: 'ALL_ROUNDER', jersey_number: 17, stats: { runs: 85, balls: 55, wickets: 4, overs: 10 } },
    { id: 'P312', team_id: 'TM-01', name: 'T. Ashok', email: 'ashok.t@spartans.com', role: 'BOWLER', jersey_number: 24, stats: { wickets: 9, overs: 17, runs_conceded: 108 } },
    { id: 'P313', team_id: 'TM-01', name: 'M. Guru', email: 'guru.m@spartans.com', role: 'ALL_ROUNDER', jersey_number: 28, stats: { runs: 70, balls: 45, wickets: 3, overs: 8 } },
    { id: 'P314', team_id: 'TM-01', name: 'V. Prakash', email: 'prakash.v@spartans.com', role: 'BATTER', jersey_number: 33, stats: { runs: 110, balls: 80, fours: 11, sixes: 1 } },
    { id: 'P315', team_id: 'TM-01', name: 'B. Senthil', email: 'senthil.b@spartans.com', role: 'BOWLER', jersey_number: 99, stats: { wickets: 5, overs: 12, runs_conceded: 82 } },

    // Team 2 (TM-02) - 15 Players
    { id: 'P401', team_id: 'TM-02', name: 'Karthik N', email: 'karthik.n@strikers.com', role: 'BOWLER', jersey_number: 21, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast', stats: { runs: 240, balls: 160, fours: 26, sixes: 8, highest_score: 72, wickets: 14, overs: 20, runs_conceded: 110, catches: 7, stumpings: 2 } },
    { id: 'P402', team_id: 'TM-02', name: 'R. Ashwin', email: 'ashwin@strikers.com', role: 'ALL_ROUNDER', jersey_number: 99, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Off Break', stats: { runs: 120, balls: 82, fours: 12, sixes: 3, highest_score: 41, wickets: 11, overs: 20, runs_conceded: 115, catches: 2, stumpings: 0 } },
    { id: 'P403', team_id: 'TM-02', name: 'S. Balamurugan', email: 'bala@strikers.com', role: 'BOWLER', jersey_number: 11, batting_style: 'Right Hand Bat', bowling_style: 'Left Arm Fast', stats: { runs: 18, balls: 12, fours: 2, sixes: 0, highest_score: 11, wickets: 9, overs: 19, runs_conceded: 128, catches: 1, stumpings: 0 } },
    { id: 'P404', team_id: 'TM-02', name: 'Dinesh Karthik', email: 'dinesh@strikers.com', role: 'WICKET_KEEPER', jersey_number: 19, batting_style: 'Right Hand Bat', stats: { runs: 215, balls: 142, fours: 24, sixes: 6, highest_score: 72, wickets: 0, overs: 0, runs_conceded: 0, catches: 5, stumpings: 1 } },
    { id: 'P405', team_id: 'TM-02', name: 'Saravanan', email: 'saravanan.s@strikers.com', role: 'BOWLER', jersey_number: 23, batting_style: 'Right Hand Bat', stats: { runs: 30, balls: 20, fours: 3, sixes: 0, highest_score: 15, wickets: 8, overs: 16, runs_conceded: 105, catches: 2, stumpings: 0 } },
    { id: 'P406', team_id: 'TM-02', name: 'M. Karthik', email: 'karthik.m@strikers.com', role: 'BATTER', jersey_number: 5, stats: { runs: 85, balls: 65, fours: 7, sixes: 1 } },
    { id: 'P407', team_id: 'TM-02', name: 'S. Ram', email: 'ram.s@strikers.com', role: 'ALL_ROUNDER', jersey_number: 8, stats: { runs: 115, balls: 80, wickets: 6, overs: 14 } },
    { id: 'P408', team_id: 'TM-02', name: 'P. Selvam', email: 'selvam.p@strikers.com', role: 'BOWLER', jersey_number: 12, stats: { wickets: 8, overs: 16, runs_conceded: 98 } },
    { id: 'P409', team_id: 'TM-02', name: 'K. Murugan', email: 'murugan.k@strikers.com', role: 'BATTER', jersey_number: 15, stats: { runs: 75, balls: 58, fours: 6, sixes: 0 } },
    { id: 'P410', team_id: 'TM-02', name: 'T. Rajan', email: 'rajan.t@strikers.com', role: 'WICKET_KEEPER', jersey_number: 16, stats: { runs: 60, balls: 45, catches: 4, stumpings: 2 } },
    { id: 'P411', team_id: 'TM-02', name: 'A. Alex', email: 'alex.a@strikers.com', role: 'ALL_ROUNDER', jersey_number: 22, stats: { runs: 90, balls: 60, wickets: 4, overs: 10 } },
    { id: 'P412', team_id: 'TM-02', name: 'G. Gokul', email: 'gokul.g@strikers.com', role: 'BOWLER', jersey_number: 27, stats: { wickets: 6, overs: 13, runs_conceded: 86 } },
    { id: 'P413', team_id: 'TM-02', name: 'D. Deepak', email: 'deepak.d@strikers.com', role: 'BATTER', jersey_number: 30, stats: { runs: 55, balls: 40, fours: 4 } },
    { id: 'P414', team_id: 'TM-02', name: 'N. Natarajan', email: 'natarajan.n@strikers.com', role: 'BOWLER', jersey_number: 44, stats: { wickets: 10, overs: 18, runs_conceded: 112 } },
    { id: 'P415', team_id: 'TM-02', name: 'V. Vinoth', email: 'vinoth.v@strikers.com', role: 'BATTER', jersey_number: 88, stats: { runs: 70, balls: 50, fours: 6 } },

    // Team 3 (TM-03) - 15 Players
    { id: 'P501', team_id: 'TM-03', name: 'M. Vijay', email: 'vijay@royals.com', role: 'BATTER', jersey_number: 8, batting_style: 'Right Hand Bat', stats: { runs: 210, balls: 140, fours: 22, sixes: 5, highest_score: 65, wickets: 0, overs: 0, runs_conceded: 0, catches: 3, stumpings: 0 } },
    { id: 'P502', team_id: 'TM-03', name: 'K. Balaji', email: 'balaji@royals.com', role: 'ALL_ROUNDER', jersey_number: 12, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium', stats: { runs: 130, balls: 90, fours: 12, sixes: 3, highest_score: 42, wickets: 7, overs: 16, runs_conceded: 110, catches: 2, stumpings: 0 } },
    { id: 'P503', team_id: 'TM-03', name: 'S. Saravanan', email: 'saravanan@royals.com', role: 'BOWLER', jersey_number: 25, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Fast', stats: { runs: 15, balls: 10, fours: 1, sixes: 0, highest_score: 8, wickets: 10, overs: 18, runs_conceded: 120, catches: 1, stumpings: 0 } },
    { id: 'P504', team_id: 'TM-03', name: 'R. Anbarasu', email: 'anbarasu.r@royals.com', role: 'BATTER', jersey_number: 3, stats: { runs: 85, balls: 60 } },
    { id: 'P505', team_id: 'TM-03', name: 'S. Dhanush', email: 'dhanush.s@royals.com', role: 'BATTER', jersey_number: 7, stats: { runs: 95, balls: 72 } },
    { id: 'P506', team_id: 'TM-03', name: 'K. Manikandan', email: 'manikandan.k@royals.com', role: 'WICKET_KEEPER', jersey_number: 9, stats: { runs: 65, balls: 50, catches: 3 } },
    { id: 'P507', team_id: 'TM-03', name: 'P. Thirumalai', email: 'thirumalai.p@royals.com', role: 'ALL_ROUNDER', jersey_number: 10, stats: { runs: 80, balls: 55, wickets: 5, overs: 12 } },
    { id: 'P508', team_id: 'TM-03', name: 'V. Vasanth', email: 'vasanth.v@royals.com', role: 'BOWLER', jersey_number: 13, stats: { wickets: 7, overs: 15, runs_conceded: 98 } },
    { id: 'P509', team_id: 'TM-03', name: 'T. Senthil Kumar', email: 'senthilkumar.t@royals.com', role: 'BOWLER', jersey_number: 18, stats: { wickets: 8, overs: 16, runs_conceded: 105 } },
    { id: 'P510', team_id: 'TM-03', name: 'M. Siva Sankaran', email: 'sivasankaran.m@royals.com', role: 'BATTER', jersey_number: 21, stats: { runs: 60, balls: 45 } },
    { id: 'P511', team_id: 'TM-03', name: 'G. Ganeshamoorthi', email: 'ganeshamoorthi.g@royals.com', role: 'BOWLER', jersey_number: 23, stats: { wickets: 6, overs: 14, runs_conceded: 90 } },
    { id: 'P512', team_id: 'TM-03', name: 'N. Naveen Kumar', email: 'naveenkumar.n@royals.com', role: 'BATTER', jersey_number: 29, stats: { runs: 70, balls: 50 } },
    { id: 'P513', team_id: 'TM-03', name: 'C. Chellappa', email: 'chellappa.c@royals.com', role: 'ALL_ROUNDER', jersey_number: 31, stats: { runs: 65, balls: 48, wickets: 3, overs: 8 } },
    { id: 'P514', team_id: 'TM-03', name: 'B. Balasubramanian', email: 'balasubramanian.b@royals.com', role: 'BOWLER', jersey_number: 77, stats: { wickets: 5, overs: 12, runs_conceded: 80 } },
    { id: 'P515', team_id: 'TM-03', name: 'A. Ayyappan', email: 'ayyappan.a@royals.com', role: 'ALL_ROUNDER', jersey_number: 91, stats: { runs: 55, balls: 40, wickets: 4, overs: 10 } },

    // Team 4 (TM-04) - 15 Players
    { id: 'P601', team_id: 'TM-04', name: 'P. Saravanan', email: 'saravanan@aces.com', role: 'BATTER', jersey_number: 5, batting_style: 'Right Hand Bat', stats: { runs: 195, balls: 130, fours: 18, sixes: 4, highest_score: 58, wickets: 0, overs: 0, runs_conceded: 0, catches: 4, stumpings: 0 } },
    { id: 'P602', team_id: 'TM-04', name: 'T. Prabhu', email: 'prabhu@aces.com', role: 'BOWLER', jersey_number: 14, batting_style: 'Right Hand Bat', bowling_style: 'Right Arm Medium', stats: { runs: 20, balls: 15, fours: 2, sixes: 0, highest_score: 12, wickets: 8, overs: 15, runs_conceded: 105, catches: 1, stumpings: 0 } },
    { id: 'P603', team_id: 'TM-04', name: 'R. Kameswaran', email: 'kameswaran.r@aces.com', role: 'BATTER', jersey_number: 4, stats: { runs: 70, balls: 55 } },
    { id: 'P604', team_id: 'TM-04', name: 'S. Sundaram', email: 'sundaram.s@aces.com', role: 'ALL_ROUNDER', jersey_number: 6, stats: { runs: 85, balls: 60, wickets: 4, overs: 11 } },
    { id: 'P605', team_id: 'TM-04', name: 'K. Alagarsamy', email: 'alagarsamy.k@aces.com', role: 'WICKET_KEEPER', jersey_number: 1, stats: { runs: 60, balls: 48, catches: 3 } },
    { id: 'P606', team_id: 'TM-04', name: 'M. Selvakumar', email: 'selvakumar.m@aces.com', role: 'BATTER', jersey_number: 11, stats: { runs: 65, balls: 50 } },
    { id: 'P607', team_id: 'TM-04', name: 'P. Pandiarajan', email: 'pandiarajan.p@aces.com', role: 'BOWLER', jersey_number: 15, stats: { wickets: 6, overs: 14, runs_conceded: 92 } },
    { id: 'P608', team_id: 'TM-04', name: 'V. Vellaisamy', email: 'vellaisamy.v@aces.com', role: 'ALL_ROUNDER', jersey_number: 19, stats: { runs: 50, balls: 38, wickets: 3, overs: 9 } },
    { id: 'P609', team_id: 'TM-04', name: 'D. Dharmaraj', email: 'dharmaraj.d@aces.com', role: 'BOWLER', jersey_number: 22, stats: { wickets: 7, overs: 15, runs_conceded: 96 } },
    { id: 'P610', team_id: 'TM-04', name: 'T. Thangavel', email: 'thangavel.t@aces.com', role: 'BATTER', jersey_number: 26, stats: { runs: 55, balls: 42 } },
    { id: 'P611', team_id: 'TM-04', name: 'A. Muthukrishnan', email: 'muthukrishnan.a@aces.com', role: 'BOWLER', jersey_number: 32, stats: { wickets: 5, overs: 13, runs_conceded: 88 } },
    { id: 'P612', team_id: 'TM-04', name: 'S. Subramani', email: 'subramani.s@aces.com', role: 'BATTER', jersey_number: 35, stats: { runs: 60, balls: 46 } },
    { id: 'P613', team_id: 'TM-04', name: 'K. Marimuthu', email: 'marimuthu.k@aces.com', role: 'ALL_ROUNDER', jersey_number: 45, stats: { runs: 45, balls: 32, wickets: 2, overs: 6 } },
    { id: 'P614', team_id: 'TM-04', name: 'M. Ramachandran', email: 'ramachandran.m@aces.com', role: 'BOWLER', jersey_number: 55, stats: { wickets: 6, overs: 12, runs_conceded: 84 } },
    { id: 'P615', team_id: 'TM-04', name: 'R. Ravichandran', email: 'ravichandran.r@aces.com', role: 'BATTER', jersey_number: 66, stats: { runs: 40, balls: 30 } }
  ];

  for (const p of rawPlayers) {
    await Player.findOneAndUpdate(
      { id: p.id },
      { $set: p },
      { upsert: true }
    );
  }

  // 5. Tournament Registrations
  console.log('📋 Restoring tournament registrations...');
  const tourRegs = [
    {
      id: 'TREG-101',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_id: 'TM-01',
      team_name: 'Virudhunagar Spartans',
      coach_name: 'K. Muthu',
      coach_email: 'coach@cfvd.org',
      team_city: 'Virudhunagar',
      team_taluk: 'Virudhunagar',
      captain: 'Suresh Kumar',
      squad_count: 15,
      status: 'APPROVED',
      registration_date: new Date('2026-09-05'),
      approved_by: 'admin@cfvd.org',
      approved_at: new Date('2026-09-06'),
      notes: 'Official club registration'
    },
    {
      id: 'TREG-102',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_id: 'TM-02',
      team_name: 'Sivakasi Strikers',
      coach_name: 'S. Ganesan',
      coach_email: 'ganesan@strikers.com',
      team_city: 'Sivakasi',
      team_taluk: 'Sivakasi',
      captain: 'Dinesh Karthik',
      squad_count: 15,
      status: 'APPROVED',
      registration_date: new Date('2026-09-10'),
      approved_by: 'admin@cfvd.org',
      approved_at: new Date('2026-09-11'),
      notes: 'All squad players verified'
    },
    {
      id: 'TREG-103',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_id: 'TM-03',
      team_name: 'Rajapalayam Royals',
      coach_name: 'R. Subramanian',
      coach_email: 'coach.royals@gmail.com',
      team_city: 'Rajapalayam',
      team_taluk: 'Rajapalayam',
      captain: 'M. Vijay',
      squad_count: 15,
      status: 'PENDING',
      registration_date: new Date('2026-10-15'),
      notes: 'Awaiting Apex Council verification'
    }
  ];

  for (const tr of tourRegs) {
    await TournamentRegistration.findOneAndUpdate({ id: tr.id }, { $setOnInsert: tr }, { upsert: true });
  }

  // 6. Matches
  console.log('📅 Restoring matches...');
  const matches = [
    {
      id: 'M001',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_a_id: 'TM-01',
      team_b_id: 'TM-03',
      venue: 'Kamarajar District Stadium',
      match_date: '2026-10-08',
      match_time: '02:30 PM',
      match_type: 'T20',
      overs_per_side: 20,
      status: 'SCHEDULED',
      assigned_scorer_id: 'SCR-101',
      umpire1_id: 'UMP-101',
      umpire2_id: 'UMP-102',
      umpire1_name: 'Thiru. K. Sundaram',
      umpire2_name: 'Thiru. M. Ramanathan'
    },
    {
      id: 'M002',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_a_id: 'TM-01',
      team_b_id: 'TM-02',
      venue: 'Kamarajar District Stadium',
      match_date: '2026-10-06',
      match_time: '09:30 AM',
      match_type: 'T20',
      overs_per_side: 20,
      status: 'LIVE',
      toss_winner_id: 'TM-01',
      toss_decision: 'BAT',
      current_innings_number: 1,
      assigned_scorer_id: 'SCR-101',
      umpire1_id: 'UMP-101',
      umpire2_id: 'UMP-102',
      umpire1_name: 'Thiru. K. Sundaram',
      umpire2_name: 'Thiru. M. Ramanathan'
    },
    {
      id: 'M003',
      tournament_id: 'T-2026-VPL',
      tournament_name: 'Virudhunagar Premier League 2026',
      team_a_id: 'TM-01',
      team_b_id: 'TM-02',
      venue: 'Kamarajar Stadium, Virudhunagar',
      match_date: '2026-10-04',
      match_time: '09:30 AM',
      match_type: 'T20',
      overs_per_side: 20,
      status: 'COMPLETED',
      toss_winner_id: 'TM-01',
      toss_decision: 'BAT',
      result_summary: 'Virudhunagar Strikers won by 7 wickets',
      player_of_match: 'Dinesh Karthik',
      assigned_scorer_id: 'SCR-101',
      umpire1_id: 'UMP-101',
      umpire2_id: 'UMP-102',
      umpire1_name: 'Thiru. K. Sundaram',
      umpire2_name: 'Thiru. M. Ramanathan'
    }
  ];

  for (const m of matches) {
    await Match.findOneAndUpdate({ id: m.id }, { $setOnInsert: m }, { upsert: true });
  }

  // 7. Innings
  console.log('📊 Restoring innings...');
  const innings = [
    {
      id: 'INN-M002-1',
      match_id: 'M002',
      innings_number: 1,
      batting_team_id: 'TM-01',
      bowling_team_id: 'TM-02',
      total_runs: 142,
      wickets: 3,
      overs: 16,
      balls: 2,
      is_completed: false,
      is_over_complete: false,
      status: 'LIVE',
      extras: { wides: 4, no_balls: 1, byes: 2, leg_byes: 1, total: 8 }
    },
    {
      id: 'INN-M003-1',
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
    },
    {
      id: 'INN-M003-2',
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
  ];

  for (const inn of innings) {
    await Innings.findOneAndUpdate({ id: inn.id }, { $setOnInsert: inn }, { upsert: true });
  }

  // 8. Batters and Bowlers
  console.log('⚡ Restoring scorecard batters and bowlers...');
  const batters = [
    { id: 'IBAT-01', innings_id: 'INN-M002-1', player_id: 'P301', batting_position: 1, runs: 64, balls: 42, fours: 8, sixes: 2, strike_rate: 152.38, is_out: false },
    { id: 'IBAT-02', innings_id: 'INN-M002-1', player_id: 'P302', batting_position: 2, runs: 28, balls: 22, fours: 3, sixes: 1, strike_rate: 127.27, is_out: true, dismissal_type: 'CAUGHT', bowler_id: 'P402', fielder_id: 'P401' },
    { id: 'IBAT-03', innings_id: 'INN-M002-1', player_id: 'P303', batting_position: 3, runs: 35, balls: 24, fours: 4, sixes: 1, strike_rate: 145.83, is_out: false },
    { id: 'IBAT-M003-01', innings_id: 'INN-M003-1', player_id: 'P301', batting_position: 1, runs: 42, balls: 30, fours: 4, sixes: 1, strike_rate: 140.0, is_out: false },
    { id: 'IBAT-M003-02', innings_id: 'INN-M003-1', player_id: 'P302', batting_position: 2, runs: 12, balls: 10, fours: 1, sixes: 0, strike_rate: 120.0, is_out: true, dismissal_type: 'BOWLED', bowler_id: 'P401' },
    { id: 'IBAT-M003-03', innings_id: 'INN-M003-1', player_id: 'P303', batting_position: 3, runs: 18, balls: 14, fours: 2, sixes: 0, strike_rate: 128.57, is_out: false }
  ];

  for (const b of batters) {
    await InningsBatter.findOneAndUpdate({ id: b.id }, { $setOnInsert: b }, { upsert: true });
  }

  const bowlers = [
    { id: 'IBOW-01', innings_id: 'INN-M002-1', player_id: 'P401', overs: 3, balls: 2, maidens: 0, runs_conceded: 28, runs: 28, wickets: 1, no_balls: 1, wides: 2, economy: 8.40 },
    { id: 'IBOW-02', innings_id: 'INN-M002-1', player_id: 'P402', overs: 4, balls: 0, maidens: 0, runs_conceded: 32, runs: 32, wickets: 2, no_balls: 0, wides: 1, economy: 8.00 },
    { id: 'IBOW-M003-01', innings_id: 'INN-M003-1', player_id: 'P401', overs: 4, balls: 0, maidens: 0, runs_conceded: 24, runs: 24, wickets: 2, no_balls: 0, wides: 2, economy: 6.00 },
    { id: 'IBOW-M003-02', innings_id: 'INN-M003-1', player_id: 'P307', overs: 4, balls: 0, maidens: 0, runs_conceded: 26, runs: 26, wickets: 2, no_balls: 1, wides: 2, economy: 6.50 }
  ];

  for (const bo of bowlers) {
    await InningsBowler.findOneAndUpdate({ id: bo.id }, { $setOnInsert: bo }, { upsert: true });
  }

  // 9. Deliveries
  console.log('🔴 Restoring deliveries...');
  const deliveries = [
    {
      id: 'DEL-M002-1-01',
      match_id: 'M002',
      innings_id: 'INN-M002-1',
      innings_number: 1,
      over_number: 1,
      ball_number: 1,
      striker_id: 'P301',
      non_striker_id: 'P302',
      bowler_id: 'P401',
      runs_batter: 1,
      runs_extras: 0,
      total_runs: 1,
      extra_type: 'NONE',
      wicket: false,
      is_legal_delivery: true,
      commentary: '1 run pushed to cover.',
      timestamp: new Date()
    },
    {
      id: 'DEL-M002-1-02',
      match_id: 'M002',
      innings_id: 'INN-M002-1',
      innings_number: 1,
      over_number: 1,
      ball_number: 2,
      striker_id: 'P302',
      non_striker_id: 'P301',
      bowler_id: 'P401',
      runs_batter: 4,
      runs_extras: 0,
      total_runs: 4,
      extra_type: 'NONE',
      boundary_type: 'FOUR',
      wicket: false,
      is_legal_delivery: true,
      commentary: 'FOUR! Dispatched to the boundary.',
      timestamp: new Date()
    }
  ];

  for (const d of deliveries) {
    await Delivery.findOneAndUpdate({ id: d.id }, { $setOnInsert: d }, { upsert: true });
  }

  // 10. Team Registrations (Squads)
  console.log('📝 Restoring coach team registrations...');
  const teamRegs = [
    {
      id: 'TEAM-VRD-101',
      team_name: 'Virudhunagar Spartans',
      coach_name: 'K. Muthu',
      coach_email: 'coach@cfvd.org',
      passkey: 'PASS-7788',
      city: 'Virudhunagar',
      taluk: 'Virudhunagar',
      status: 'APPROVED',
      approved_by: 'ADM-1001',
      approved_at: new Date('2026-10-01'),
      players: [
        { jersey_number: 7, name: 'Suresh Kumar', email: 'suresh@spartans.com', role: 'BATTER', status: 'APPROVED' },
        { jersey_number: 18, name: 'Muthu Raj', email: 'muthuraj@spartans.com', role: 'ALL_ROUNDER', status: 'APPROVED' },
        { jersey_number: 3, name: 'Vijay', email: 'vijay@spartans.com', role: 'BATTER', status: 'APPROVED' },
        { jersey_number: 1, name: 'K. Balaji', email: 'balaji@spartans.com', role: 'WICKET_KEEPER', status: 'APPROVED' },
        { jersey_number: 23, name: 'R. Vignesh', email: 'vignesh@spartans.com', role: 'BOWLER', status: 'APPROVED' },
        { jersey_number: 10, name: 'Arun Pandian', email: 'player@example.com', role: 'ALL_ROUNDER', status: 'APPROVED' }
      ]
    },
    {
      id: 'TEAM-VRD-102',
      team_name: 'Sattur Super Kings',
      coach_name: 'R. Kannan',
      coach_email: 'coach.sattur@gmail.com',
      passkey: 'PASS-5544',
      city: 'Sattur',
      taluk: 'Sattur',
      status: 'PENDING',
      players: [
        { jersey_number: 1, name: 'M. Karthik', email: 'karthik@sattur.com', role: 'BATTER', status: 'PENDING' },
        { jersey_number: 2, name: 'S. Ram', email: 'ram@sattur.com', role: 'ALL_ROUNDER', status: 'PENDING' }
      ]
    }
  ];

  for (const reg of teamRegs) {
    await TeamRegistration.findOneAndUpdate({ id: reg.id }, { $setOnInsert: reg }, { upsert: true });
  }

  // 11. News, Notifications, Officials, Venues
  console.log('📢 Restoring news, notifications, and officials...');
  await News.findOneAndUpdate(
    { id: 'NEWS-01' },
    {
      $setOnInsert: {
        id: 'NEWS-01',
        title: 'Virudhunagar Premier League 2026 Inaugurated in Kamarajar Stadium',
        summary: 'The grand opening of VPL 2026 kicked off today with 8 affiliated clubs participating in the premier district championship.',
        content: 'The Cricket Association of Virudhunagar District officially inaugurated the Virudhunagar Premier League 2026.',
        category: 'TOURNAMENT',
        author: 'Association Press',
        image_url: '/assets_web/champions.jpg',
        status: 'PUBLISHED'
      }
    },
    { upsert: true }
  );

  await Notification.findOneAndUpdate(
    { id: 'NOTIF-01' },
    {
      $setOnInsert: {
        id: 'NOTIF-01',
        type: 'TEAM_REGISTRATION',
        title: 'New Team Registration: Sattur Super Kings',
        message: 'Coach R. Kannan submitted team Sattur Super Kings. Awaiting administrative review.',
        reference_id: 'TEAM-VRD-102',
        status: 'UNREAD'
      }
    },
    { upsert: true }
  );

  await Official.findOneAndUpdate(
    { id: 'OFF-01' },
    {
      $setOnInsert: {
        id: 'OFF-01',
        name: 'S. Ramesh',
        role: 'SCORER',
        email: 'ramesh@gmail.com',
        phone: '9876543213',
        status: 'ACTIVE'
      }
    },
    { upsert: true }
  );

  await Official.findOneAndUpdate(
    { id: 'OFF-02' },
    {
      $setOnInsert: {
        id: 'OFF-02',
        name: 'K. Murugan',
        role: 'SCORER',
        email: 'murugan@cfvd.org',
        phone: '9876543214',
        status: 'ACTIVE'
      }
    },
    { upsert: true }
  );

  await Venue.findOneAndUpdate(
    { id: 'VEN-01' },
    {
      $setOnInsert: {
        id: 'VEN-01',
        name: 'Kamarajar District Stadium',
        location: 'Virudhunagar Central',
        capacity: 8000,
        floodlights: true,
        description: 'Main association ground.'
      }
    },
    { upsert: true }
  );

  await Venue.findOneAndUpdate(
    { id: 'VEN-02' },
    {
      $setOnInsert: {
        id: 'VEN-02',
        name: 'Sivakasi Cricket Ground',
        location: 'Sivakasi Bypass',
        capacity: 4000,
        floodlights: true,
        description: 'Premium turf pitch ground.'
      }
    },
    { upsert: true }
  );

  // 12. Check if scorecard_dump.json has additional match data to restore
  const dumpPath = path.join(__dirname, '../../scorecard_dump.json');
  if (fs.existsSync(dumpPath)) {
    try {
      const dumpRaw = fs.readFileSync(dumpPath, 'utf8');
      const dump = JSON.parse(dumpRaw);
      if (dump && dump.matchId) {
        console.log(`📦 Restoring dump scorecard match: ${dump.matchId}...`);
        await Match.findOneAndUpdate(
          { id: dump.matchId },
          {
            $setOnInsert: {
              id: dump.matchId,
              tournament_name: dump.tournament || 'District Under-19 Championship',
              team_a_name: dump.teamA || 'Sattur Super Kings',
              team_b_name: dump.teamB || 'Virudhunagar Spartans',
              venue: dump.venue || 'Sivakasi Cricket Ground',
              match_date: dump.date || '2026-10-17',
              match_time: dump.match?.time || '09:30 AM',
              overs_per_side: dump.match?.overs || 20,
              status: 'LIVE',
              assigned_scorer_id: 'SCR-101'
            }
          },
          { upsert: true }
        );

        if (dump.innings && Array.isArray(dump.innings)) {
          for (const inn of dump.innings) {
            await Innings.findOneAndUpdate(
              { id: inn.id },
              {
                $setOnInsert: {
                  id: inn.id,
                  match_id: dump.matchId,
                  innings_number: inn.inningsNumber || 1,
                  batting_team_id: inn.battingTeam || 'Virudhunagar Spartans',
                  bowling_team_id: inn.bowlingTeam || 'Sattur Super Kings',
                  total_runs: inn.totalRuns || 34,
                  wickets: inn.wickets || 10,
                  overs: parseFloat(inn.overs || '4.0'),
                  status: 'LIVE',
                  extras: inn.extras || {}
                }
              },
              { upsert: true }
            );

            if (inn.batters && Array.isArray(inn.batters)) {
              for (const bat of inn.batters) {
                await InningsBatter.findOneAndUpdate(
                  { id: bat.id },
                  {
                    $setOnInsert: {
                      id: bat.id,
                      innings_id: inn.id,
                      player_id: bat.playerId,
                      runs: bat.runs || 0,
                      balls: bat.balls || 0,
                      fours: bat.fours || 0,
                      sixes: bat.sixes || 0,
                      strike_rate: bat.strikeRate || 0,
                      is_out: bat.isOut || false,
                      dismissal_text: bat.dismissal || 'not out'
                    }
                  },
                  { upsert: true }
                );
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Note importing scorecard_dump.json:', e.message);
    }
  }

  // Print final summary counts
  const counts = {
    users: await User.countDocuments(),
    tournaments: await Tournament.countDocuments(),
    teams: await Team.countDocuments(),
    players: await Player.countDocuments(),
    matches: await Match.countDocuments(),
    innings: await Innings.countDocuments(),
    batters: await InningsBatter.countDocuments(),
    bowlers: await InningsBowler.countDocuments(),
    deliveries: await Delivery.countDocuments(),
    teamRegistrations: await TeamRegistration.countDocuments(),
    tournamentRegistrations: await TournamentRegistration.countDocuments(),
    news: await News.countDocuments(),
    notifications: await Notification.countDocuments(),
    officials: await Official.countDocuments(),
    venues: await Venue.countDocuments()
  };

  console.log('\n===============================================================');
  console.log('✅ ALL CRICKET ASSOCIATION DATABASE RECORDS RESTORED SUCCESSFULLY:');
  console.log(counts);
  console.log('===============================================================\n');

  process.exit(0);
}

restoreDatabase().catch(err => {
  console.error('❌ Restore error:', err);
  process.exit(1);
});

