const db = require('../config/db');

async function run() {
  await db.initDb();

  const playersToAdd = [
    // TM-01 (add 7 to make 15 total)
    { id: 'P309', team_id: 'TM-01', name: 'S. Manoj', role: 'BATTER', jersey_number: 11 },
    { id: 'P310', team_id: 'TM-01', name: 'P. Rajesh', role: 'BOWLER', jersey_number: 14 },
    { id: 'P311', team_id: 'TM-01', name: 'K. Siva', role: 'ALL_ROUNDER', jersey_number: 17 },
    { id: 'P312', team_id: 'TM-01', name: 'T. Ashok', role: 'BOWLER', jersey_number: 24 },
    { id: 'P313', team_id: 'TM-01', name: 'M. Guru', role: 'ALL_ROUNDER', jersey_number: 28 },
    { id: 'P314', team_id: 'TM-01', name: 'V. Prakash', role: 'BATTER', jersey_number: 33 },
    { id: 'P315', team_id: 'TM-01', name: 'B. Senthil', role: 'BOWLER', jersey_number: 99 },

    // TM-02 (add 10 to make 15 total)
    { id: 'P406', team_id: 'TM-02', name: 'M. Karthik', role: 'BATTER', jersey_number: 5 },
    { id: 'P407', team_id: 'TM-02', name: 'S. Ram', role: 'ALL_ROUNDER', jersey_number: 8 },
    { id: 'P408', team_id: 'TM-02', name: 'P. Selvam', role: 'BOWLER', jersey_number: 12 },
    { id: 'P409', team_id: 'TM-02', name: 'K. Murugan', role: 'BATTER', jersey_number: 15 },
    { id: 'P410', team_id: 'TM-02', name: 'T. Rajan', role: 'WICKET_KEEPER', jersey_number: 16 },
    { id: 'P411', team_id: 'TM-02', name: 'A. Alex', role: 'ALL_ROUNDER', jersey_number: 22 },
    { id: 'P412', team_id: 'TM-02', name: 'G. Gokul', role: 'BOWLER', jersey_number: 27 },
    { id: 'P413', team_id: 'TM-02', name: 'D. Deepak', role: 'BATTER', jersey_number: 30 },
    { id: 'P414', team_id: 'TM-02', name: 'N. Natarajan', role: 'BOWLER', jersey_number: 44 },
    { id: 'P415', team_id: 'TM-02', name: 'V. Vinoth', role: 'BATTER', jersey_number: 88 },

    // TM-03 (15 players)
    { id: 'P501', team_id: 'TM-03', name: 'M. Vijay', role: 'BATTER', jersey_number: 8 },
    { id: 'P502', team_id: 'TM-03', name: 'K. Balaji', role: 'ALL_ROUNDER', jersey_number: 12 },
    { id: 'P503', team_id: 'TM-03', name: 'S. Saravanan', role: 'BOWLER', jersey_number: 25 },
    { id: 'P504', team_id: 'TM-03', name: 'R. Anbarasu', role: 'BATTER', jersey_number: 3 },
    { id: 'P505', team_id: 'TM-03', name: 'S. Dhanush', role: 'BATTER', jersey_number: 7 },
    { id: 'P506', team_id: 'TM-03', name: 'K. Manikandan', role: 'WICKET_KEEPER', jersey_number: 9 },
    { id: 'P507', team_id: 'TM-03', name: 'P. Thirumalai', role: 'ALL_ROUNDER', jersey_number: 10 },
    { id: 'P508', team_id: 'TM-03', name: 'V. Vasanth', role: 'BOWLER', jersey_number: 13 },
    { id: 'P509', team_id: 'TM-03', name: 'T. Senthil Kumar', role: 'BOWLER', jersey_number: 18 },
    { id: 'P510', team_id: 'TM-03', name: 'M. Siva Sankaran', role: 'BATTER', jersey_number: 21 },
    { id: 'P511', team_id: 'TM-03', name: 'G. Ganeshamoorthi', role: 'BOWLER', jersey_number: 23 },
    { id: 'P512', team_id: 'TM-03', name: 'N. Naveen Kumar', role: 'BATTER', jersey_number: 29 },
    { id: 'P513', team_id: 'TM-03', name: 'C. Chellappa', role: 'ALL_ROUNDER', jersey_number: 31 },
    { id: 'P514', team_id: 'TM-03', name: 'B. Balasubramanian', role: 'BOWLER', jersey_number: 77 },
    { id: 'P515', team_id: 'TM-03', name: 'A. Ayyappan', role: 'ALL_ROUNDER', jersey_number: 91 },

    // TM-04 (15 players)
    { id: 'P601', team_id: 'TM-04', name: 'P. Saravanan', role: 'BATTER', jersey_number: 5 },
    { id: 'P602', team_id: 'TM-04', name: 'T. Prabhu', role: 'BOWLER', jersey_number: 14 },
    { id: 'P603', team_id: 'TM-04', name: 'R. Kameswaran', role: 'BATTER', jersey_number: 4 },
    { id: 'P604', team_id: 'TM-04', name: 'S. Sundaram', role: 'ALL_ROUNDER', jersey_number: 6 },
    { id: 'P605', team_id: 'TM-04', name: 'K. Alagarsamy', role: 'WICKET_KEEPER', jersey_number: 1 },
    { id: 'P606', team_id: 'TM-04', name: 'M. Selvakumar', role: 'BATTER', jersey_number: 11 },
    { id: 'P607', team_id: 'TM-04', name: 'P. Pandiarajan', role: 'BOWLER', jersey_number: 15 },
    { id: 'P608', team_id: 'TM-04', name: 'V. Vellaisamy', role: 'ALL_ROUNDER', jersey_number: 19 },
    { id: 'P609', team_id: 'TM-04', name: 'D. Dharmaraj', role: 'BOWLER', jersey_number: 22 },
    { id: 'P610', team_id: 'TM-04', name: 'T. Thangavel', role: 'BATTER', jersey_number: 26 },
    { id: 'P611', team_id: 'TM-04', name: 'A. Muthukrishnan', role: 'BOWLER', jersey_number: 32 },
    { id: 'P612', team_id: 'TM-04', name: 'S. Subramani', role: 'BATTER', jersey_number: 35 },
    { id: 'P613', team_id: 'TM-04', name: 'K. Marimuthu', role: 'ALL_ROUNDER', jersey_number: 45 },
    { id: 'P614', team_id: 'TM-04', name: 'M. Ramachandran', role: 'BOWLER', jersey_number: 55 },
    { id: 'P615', team_id: 'TM-04', name: 'R. Ravichandran', role: 'BATTER', jersey_number: 66 }
  ];

  for (const p of playersToAdd) {
    await db.models.Player.updateOne(
      { id: p.id },
      { $set: p },
      { upsert: true }
    );
  }

  console.log('✅ Successfully inserted/updated all genuine players into MongoDB.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
