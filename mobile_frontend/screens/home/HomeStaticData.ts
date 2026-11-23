/**
 * screens/home/HomeStaticData.ts
 * Static data tables, college affiliations, officials rosters, and performance data
 * extracted from Home.tsx for bundle modularity and performance.
 */

export interface StandingsRow {
  stand: number;
  badge?: 'gold' | 'silver' | 'bronze' | '';
  name: string;
  sub?: string;
  p: number;
  w: number;
  l: number;
  nr: number;
  bonus: number;
  nrr: string;
  pts: number;
  form: Array<'w' | 'l' | 'nr'>;
  code: string;
}

export const TABLE_DATA: Record<string, StandingsRow[]> = {
  div1: [
    { stand: 1, badge: 'gold', name: 'Virudhunagar Strikers CC', sub: 'Qualified for Knockouts', p: 7, w: 5, l: 1, nr: 1, bonus: 3, nrr: '+1.428', pts: 25, form: ['w', 'w', 'nr', 'l', 'w'], code: 'VS' },
    { stand: 2, badge: 'silver', name: 'Sivakasi Super Kings', sub: 'Qualified for Knockouts', p: 7, w: 5, l: 2, nr: 0, bonus: 2, nrr: '+0.892', pts: 22, form: ['w', 'l', 'w', 'w', 'w'], code: 'SSK' },
    { stand: 3, badge: 'bronze', name: 'Rajapalayam Cricket Club', sub: 'In Contention', p: 7, w: 4, l: 2, nr: 1, bonus: 2, nrr: '+0.510', pts: 19, form: ['w', 'w', 'nr', 'l', 'w'], code: 'RCC' },
    { stand: 4, badge: '', name: 'Srivilliputhur Warriors', sub: 'In Contention', p: 7, w: 4, l: 3, nr: 0, bonus: 1, nrr: '+0.215', pts: 17, form: ['l', 'w', 'w', 'l', 'w'], code: 'SW' },
    { stand: 5, badge: '', name: 'Aruppukottai Stars CC', sub: '', p: 7, w: 3, l: 3, nr: 1, bonus: 1, nrr: '-0.118', pts: 14, form: ['l', 'l', 'nr', 'w', 'l'], code: 'AKS' },
    { stand: 6, badge: '', name: 'Sattur Cricket XI', sub: '', p: 7, w: 2, l: 4, nr: 1, bonus: 0, nrr: '-0.640', pts: 9, form: ['l', 'w', 'nr', 'l', 'l'], code: 'SXI' },
    { stand: 7, badge: '', name: 'Thiruthangal CC', sub: '', p: 7, w: 1, l: 5, nr: 1, bonus: 0, nrr: '-1.204', pts: 5, form: ['l', 'nr', 'l', 'l', 'w'], code: 'TKC' }
  ],
  college: [
    { stand: 1, badge: 'gold', name: 'VHNSN College, Virudhunagar', sub: 'Champions Bracket', p: 5, w: 4, l: 0, nr: 1, bonus: 2, nrr: '+1.940', pts: 15, form: ['w', 'w', 'w', 'nr', 'w'], code: 'VHN' },
    { stand: 2, badge: 'silver', name: 'PSR Engineering College, Sivakasi', sub: 'Qualified', p: 5, w: 3, l: 1, nr: 1, bonus: 2, nrr: '+1.180', pts: 12, form: ['w', 'nr', 'l', 'w', 'w'], code: 'PSR' },
    { stand: 3, badge: 'bronze', name: 'Ayya Nadar Janaki Ammal College (ANJAC)', sub: '3rd Place', p: 5, w: 3, l: 2, nr: 0, bonus: 1, nrr: '+0.450', pts: 10, form: ['w', 'l', 'w', 'w', 'l'], code: 'ANJ' },
    { stand: 4, badge: '', name: 'Rajapalayam Rajus College', sub: 'In Contention', p: 5, w: 2, l: 2, nr: 1, bonus: 1, nrr: '-0.120', pts: 8, form: ['l', 'w', 'nr', 'l', 'w'], code: 'RRC' },
    { stand: 5, badge: '', name: 'Kalasalingam University, Krishnankoil', sub: '', p: 5, w: 1, l: 4, nr: 0, bonus: 0, nrr: '-0.850', pts: 3, form: ['l', 'l', 'l', 'w', 'l'], code: 'KLU' }
  ],
  t20: [
    { stand: 1, badge: 'gold', name: 'Srivilliputhur Warriors T20', sub: 'Finalist', p: 6, w: 5, l: 1, nr: 0, bonus: 2, nrr: '+2.140', pts: 12, form: ['w', 'w', 'w', 'l', 'w'], code: 'SW' },
    { stand: 2, badge: 'silver', name: 'Virudhunagar Strikers', sub: 'Finalist', p: 6, w: 5, l: 1, nr: 0, bonus: 2, nrr: '+1.860', pts: 12, form: ['w', 'w', 'l', 'w', 'w'], code: 'VS' },
    { stand: 3, badge: 'bronze', name: 'Sivakasi Super Kings', sub: 'Semi-Finalist', p: 6, w: 4, l: 2, nr: 0, bonus: 1, nrr: '+0.740', pts: 9, form: ['l', 'w', 'w', 'w', 'l'], code: 'SSK' },
    { stand: 4, badge: '', name: 'Rajapalayam CC', sub: 'Semi-Finalist', p: 6, w: 3, l: 3, nr: 0, bonus: 1, nrr: '-0.110', pts: 7, form: ['w', 'l', 'w', 'l', 'l'], code: 'RCC' }
  ],
  school: [
    { stand: 1, badge: 'gold', name: 'KVS Hr Sec School, Virudhunagar', sub: 'Champions', p: 4, w: 4, l: 0, nr: 0, bonus: 2, nrr: '+2.600', pts: 10, form: ['w', 'w', 'w', 'w'], code: 'KVS' },
    { stand: 2, badge: 'silver', name: 'PACM High School, Rajapalayam', sub: 'Runners-up', p: 4, w: 3, l: 1, nr: 0, bonus: 1, nrr: '+1.200', pts: 7, form: ['w', 'w', 'l', 'w'], code: 'PAC' },
    { stand: 3, badge: 'bronze', name: 'S.H.N. Girls HSS, Sivakasi', sub: '3rd Place', p: 4, w: 2, l: 2, nr: 0, bonus: 1, nrr: '+0.150', pts: 5, form: ['l', 'w', 'w', 'l'], code: 'SHN' }
  ]
};

export const PERF_DATA = {
  batting: [
    { stand: 1, name: 'R. Saravanan', role: 'Batter', team: 'Virudhunagar Strikers', mat: 8, inns: 8, runs: 445, hs: '112*', avg: '63.57', sr: '149.3', fifties: 3, hundreds: 1 },
    { stand: 2, name: 'S. Karthik Raja', role: 'Wicketkeeper Batter', team: 'Rajapalayam CC', mat: 7, inns: 7, runs: 375, hs: '104', avg: '53.57', sr: '133.9', fifties: 2, hundreds: 1 },
    { stand: 3, name: 'M. Anandhan', role: 'Top Order Batter', team: 'Sivakasi Super Kings', mat: 7, inns: 7, runs: 344, hs: '88', avg: '49.14', sr: '128.3', fifties: 3, hundreds: 0 },
    { stand: 4, name: 'P. Muthukumar', role: 'Middle Order Batter', team: 'Srivilliputhur Warriors', mat: 7, inns: 7, runs: 287, hs: '74*', avg: '47.83', sr: '138.6', fifties: 2, hundreds: 0 },
    { stand: 5, name: 'K. Ganesan', role: 'Batting All-Rounder', team: 'Aruppukottai Stars', mat: 6, inns: 6, runs: 260, hs: '68', avg: '43.33', sr: '142.8', fifties: 2, hundreds: 0 }
  ],
  bowling: [
    { stand: 1, name: 'K. Praveen Kumar', role: 'Right-Arm Off Spin', team: 'Virudhunagar CC', mat: 8, inns: 8, overs: '30.4', runs: 168, wkts: 21, econ: '5.47', threeWkts: 3, fiveWkts: 1 },
    { stand: 2, name: 'M. Vignesh', role: 'Left-Arm Fast Medium', team: 'Sivakasi Super Kings', mat: 8, inns: 8, overs: '31.2', runs: 194, wkts: 18, econ: '6.19', threeWkts: 2, fiveWkts: 1 },
    { stand: 3, name: 'D. Aravind', role: 'Right-Arm Leg Spin', team: 'Srivilliputhur Warriors', mat: 7, inns: 7, overs: '28.0', runs: 162, wkts: 16, econ: '5.78', threeWkts: 2, fiveWkts: 0 },
    { stand: 4, name: 'T. Manikandan', role: 'Right-Arm Medium Fast', team: 'Rajapalayam CC', mat: 7, inns: 7, overs: '27.0', runs: 171, wkts: 14, econ: '6.33', threeWkts: 1, fiveWkts: 0 },
    { stand: 5, name: 'S. Balamurugan', role: 'Slow Left-Arm Orthodox', team: 'Sattur XI', mat: 7, inns: 7, overs: '26.0', runs: 153, wkts: 13, econ: '5.88', threeWkts: 1, fiveWkts: 0 }
  ],
  fielding: [
    { stand: 1, name: 'S. Balaji', role: 'Wicketkeeper Batter', team: 'Virudhunagar Strikers', mat: 8, inns: 8, catches: 11, stumpings: 4, runOuts: 2, total: 17 },
    { stand: 2, name: 'S. Karthik Raja', role: 'Wicketkeeper Batter', team: 'Rajapalayam CC', mat: 7, inns: 7, catches: 9, stumpings: 3, runOuts: 1, total: 13 },
    { stand: 3, name: 'R. Saravanan', role: 'Batter (Slip/Cover)', team: 'Virudhunagar Strikers', mat: 8, inns: 8, catches: 8, stumpings: 0, runOuts: 3, total: 11 },
    { stand: 4, name: 'M. Anandhan', role: 'Outfielder', team: 'Sivakasi Super Kings', mat: 7, inns: 7, catches: 7, stumpings: 0, runOuts: 2, total: 9 },
    { stand: 5, name: 'P. Muthukumar', role: 'Point/Cover Specialist', team: 'Srivilliputhur Warriors', mat: 7, inns: 7, catches: 6, stumpings: 0, runOuts: 2, total: 8 }
  ]
};

export interface DistrictPlayer {
  id: string;
  name: string;
  role: 'batter' | 'bowler' | 'allrounder' | 'wicketkeeper' | 'womens';
  roleLabel: string;
  playingRole: string;
  battingStyle: string;
  bowlingStyle: string;
  team: string;
  teamShort?: string;
  taluk: string;
  category: string;
  categoryLabel: string;
  verified: boolean;
  photo?: string;
  image?: string;
  image_path?: string;
  avatarColor: [string, string];
  milestoneType?: 'century' | 'fifty' | 'bowling_haul';
  milestoneBadge?: string;
  matchPerformance?: string;
  matchVs?: string;
  stats: {
    mat: number;
    inns: number;
    runs: number;
    hs: string;
    avg: string;
    sr: string;
    fifties: number;
    hundreds: number;
    wkts: number;
    best?: string;
    econ?: string;
    catches: number;
    stumpings?: number;
  };
  bio: string;
}

export interface CollegeItem {
  id: string;
  name: string;
  taluk: string;
  teams: number;
  head: string;
  ground: string;
  phone: string;
}

export const INITIAL_COLLEGES: CollegeItem[] = [
  { id: 'col-1', name: 'VHNSN College (Autonomous)', taluk: 'Virudhunagar', teams: 2, head: 'Dr. C. Chelladurai', ground: 'Turf + Nets', phone: '+91 94431 23450' },
  { id: 'col-2', name: 'Ayya Nadar Janaki Ammal College (ANJAC)', taluk: 'Sivakasi', teams: 2, head: 'Prof. R. Rajendran', ground: 'Pavilion Ground', phone: '+91 94432 34561' },
  { id: 'col-3', name: 'Rajapalayam Rajus College', taluk: 'Rajapalayam', teams: 2, head: 'Dr. M. Sridhar', ground: 'Turf Wicket', phone: '+91 94433 45672' },
  { id: 'col-4', name: 'PSR Engineering College', taluk: 'Sivakasi', teams: 2, head: 'Prof. V. Sivakumar', ground: 'Sports Enclave Turf', phone: '+91 94434 56783' },
  { id: 'col-5', name: 'Kalasalingam University', taluk: 'Srivilliputhur', teams: 2, head: 'Dr. S. Balamurugan', ground: 'Stadium Ground', phone: '+91 94435 67894' },
  { id: 'col-6', name: 'SFR College for Women', taluk: 'Sivakasi', teams: 1, head: 'Dr. K. Meenakshi', ground: 'Pavilion Field', phone: '+91 94436 78905' }
];

export const OFFICIALS_ROSTER = [
  { name: 'Thiru. K. Sundaram', role: 'Umpire', grade: 'Panel A - Senior', taluk: 'Virudhunagar', matches: 38, status: 'Active' },
  { name: 'Thiru. M. Ramanathan', role: 'Umpire', grade: 'Senior Panel', taluk: 'Sivakasi', matches: 34, status: 'Active' },
  { name: 'Thiru. A. Gurunathan', role: 'Umpire', grade: 'Panel A', taluk: 'Rajapalayam', matches: 29, status: 'Active' },
  { name: 'Thiru. S. Shanmugam', role: 'Umpire', grade: 'Level 2', taluk: 'Aruppukottai', matches: 22, status: 'Active' },
  { name: 'Thiru. S. Ramesh', role: 'Digital Scorer', grade: 'Chief Scorer', taluk: 'Virudhunagar', matches: 45, status: 'Active' },
  { name: 'Thiru. K. Vijayakumar', role: 'Digital Scorer', grade: 'Certified Live Scorer', taluk: 'Sivakasi', matches: 31, status: 'Active' },
  { name: 'Thiru. P. Chandran', role: 'Match Referee', grade: 'Chief District Referee', taluk: 'Virudhunagar', matches: 50, status: 'Active' }
];

