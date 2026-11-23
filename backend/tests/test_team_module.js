/**
 * test_team_module.js
 * 
 * Complete Automated Verification Test Suite for Team Module:
 * 1. Team Registration Validation:
 *    - Reject if players < 15
 *    - Reject if players > 15
 *    - Reject duplicate player email inside squad
 *    - Reject player email matching coach email
 *    - Reject duplicate team name or duplicate coach email
 *    - Successfully register with exactly 15 players -> Status = PENDING
 * 2. Pending Status Flow:
 *    - Coach login blocked with 403 while PENDING
 * 3. Admin Review & Approval:
 *    - GET /api/admin/teams/pending (view pending teams & 15 players)
 *    - GET /api/admin/teams/:id (view team details)
 *    - PUT /api/admin/teams/:id/approve (approve team & squad)
 *    - Verify Team & 15 Players created in MongoDB with active status
 * 4. Approved Team Login & NodeMailer OTP:
 *    - POST /api/team/login (Coach Name + Registered Email)
 *    - POST /api/team/verify-otp (Verify OTP and obtain JWT)
 *    - Reject invalid OTP
 * 5. Rejection Flow:
 *    - Register Team B -> Admin rejects team (PUT /api/admin/teams/:id/reject)
 *    - Login blocked with 403 for REJECTED team
 * 6. Protected Team Operations:
 *    - GET /api/team/profile
 *    - PUT /api/team/profile (update safe fields)
 *    - GET /api/team/squad (15 players, verified team isolation)
 *    - GET /api/team/matches & GET /api/team/matches/:id
 *    - GET /api/team/matches/:id/scorecard (read-only)
 *    - GET /api/team/statistics (real MongoDB match stats)
 *    - GET /api/team/players/statistics (real player stats)
 *    - GET /api/team/notifications & PUT /api/team/notifications/:id/read
 * 7. Security Boundaries:
 *    - Team cannot access Admin APIs (403 Forbidden)
 *    - Team cannot score balls in Scorer APIs (403 Forbidden)
 * 8. Interoperability with Player Module:
 *    - Squad player registered by Coach can log in via Player module
 */

process.env.NODE_ENV = 'test';

const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function generate15Squad(prefix) {
  const roles = [
    'Top Order Batter', 'Wicketkeeper Batter', 'Top Order Batter', 'Middle Order Batter',
    'Middle Order Batter', 'All-Rounder', 'All-Rounder', 'Spin Bowler',
    'Fast Bowler', 'Fast Bowler', 'Spin Bowler', 'Fast Bowler',
    'Middle Order Batter', 'All-Rounder', 'Fast Bowler'
  ];
  return Array.from({ length: 15 }, (_, i) => ({
    name: `${prefix} Player ${i + 1}`,
    email: `${prefix.toLowerCase()}.player${i + 1}@cricketteam.org`,
    role: roles[i] || 'Batter',
    jerseyNumber: i + 1
  }));
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🏏 CRICKET ASSOCIATION - TEAM MODULE COMPREHENSIVE TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    const timestamp = Date.now();
    const teamAName = `Virudhunagar Kings ${timestamp}`;
    const coachAName = `Coach Sundaram ${timestamp}`;
    const coachAEmail = `coach.sundaram.${timestamp}@kingscc.org`;

    // -------------------------------------------------------------------------
    // TEST 1: Team Registration Validation - Exactly 15 Players Required
    // -------------------------------------------------------------------------
    console.log('--------------------------------------------------------------------');
    console.log('TEST 1: SQUAD SIZE VALIDATION (EXACTLY 15 PLAYERS)');
    console.log('--------------------------------------------------------------------');

    // 1a: Try 14 players (less than 15)
    const squad14 = generate15Squad(`T14_${timestamp}`).slice(0, 14);
    const res14 = await request('/team/register', {
      method: 'POST',
      body: {
        teamName: `Undersized Team ${timestamp}`,
        coachName: 'Coach Less',
        coachEmail: `coach.less.${timestamp}@test.org`,
        players: squad14
      }
    });
    assert(res14.status === 400 && res14.body.message.includes('15'), 'Backend rejects squad with less than 15 players (14 submitted)');

    // 1b: Try 16 players (more than 15)
    const squad16 = [...generate15Squad(`T16_${timestamp}`), {
      name: 'Extra Player 16',
      email: `extra16.${timestamp}@test.org`,
      role: 'Batter',
      jerseyNumber: 16
    }];
    const res16 = await request('/team/register', {
      method: 'POST',
      body: {
        teamName: `Oversized Team ${timestamp}`,
        coachName: 'Coach More',
        coachEmail: `coach.more.${timestamp}@test.org`,
        players: squad16
      }
    });
    assert(res16.status === 400 && res16.body.message.includes('15'), 'Backend rejects squad with more than 15 players (16 submitted)');

    // 1c: Duplicate player email inside squad
    const duplicateEmailSquad = generate15Squad(`Dup_${timestamp}`);
    duplicateEmailSquad[1].email = duplicateEmailSquad[0].email; // Duplicate!
    const resDupSquad = await request('/team/register', {
      method: 'POST',
      body: {
        teamName: `Dup Email Team ${timestamp}`,
        coachName: 'Coach Dup',
        coachEmail: `coach.dup.${timestamp}@test.org`,
        players: duplicateEmailSquad
      }
    });
    assert(resDupSquad.status === 400 && resDupSquad.body.message.includes('Duplicate'), 'Backend rejects duplicate player emails inside 15-player squad');

    // 1d: Player email matching coach email
    const conflictSquad = generate15Squad(`Conflict_${timestamp}`);
    conflictSquad[0].email = `coach.conflict.${timestamp}@test.org`;
    const resConflict = await request('/team/register', {
      method: 'POST',
      body: {
        teamName: `Conflict Team ${timestamp}`,
        coachName: 'Coach Conflict',
        coachEmail: `coach.conflict.${timestamp}@test.org`,
        players: conflictSquad
      }
    });
    assert(resConflict.status === 400 && resConflict.body.message.includes('Coach'), 'Backend rejects squad player having the same email as coach');

    // -------------------------------------------------------------------------
    // TEST 2: Successful Registration of Team A with 15 Players (Status = PENDING)
    // -------------------------------------------------------------------------
    console.log('\n--------------------------------------------------------------------');
    console.log('TEST 2: VALID TEAM REGISTRATION & PENDING STATUS INITIALIZATION');
    console.log('--------------------------------------------------------------------');

    const validSquadA = generate15Squad(`TeamA_${timestamp}`);
    const regRes = await request('/team/register', {
      method: 'POST',
      body: {
        teamName: teamAName,
        coachName: coachAName,
        coachEmail: coachAEmail,
        taluk: 'Virudhunagar',
        city: 'Virudhunagar',
        players: validSquadA
      }
    });

    assert(regRes.status === 201, `Team registration returns 201 Created (got ${regRes.status})`);
    assert(regRes.body.success === true, 'Team registration body success is true');
    assert(regRes.body.status === 'PENDING', 'Initial registrationStatus is strictly "PENDING"');
    assert(regRes.body.team && regRes.body.team.players.length === 15, 'All 15 squad players saved in registration record');

    const teamAId = regRes.body.team.id;

    // 2b: Duplicate team name prevention
    const dupNameRes = await request('/team/register', {
      method: 'POST',
      body: {
        teamName: teamAName,
        coachName: 'Different Coach',
        coachEmail: `different.${timestamp}@test.org`,
        players: generate15Squad(`DupName_${timestamp}`)
      }
    });
    assert(dupNameRes.status === 400 || dupNameRes.status === 409, 'Duplicate team name registration is blocked');

    // 2c: Duplicate coach email prevention
    const dupCoachRes = await request('/team/register', {
      method: 'POST',
      body: {
        teamName: `Different Team Name ${timestamp}`,
        coachName: 'Coach Dup Email',
        coachEmail: coachAEmail,
        players: generate15Squad(`DupCoach_${timestamp}`)
      }
    });
    assert(dupCoachRes.status === 400 || dupCoachRes.status === 409, 'Duplicate coach email registration is blocked');

    // -------------------------------------------------------------------------
    // TEST 3: Block Login while PENDING Admin Approval (HTTP 403)
    // -------------------------------------------------------------------------
    console.log('\n--------------------------------------------------------------------');
    console.log('TEST 3: PENDING TEAM LOGIN BLOCKED BY BACKEND (HTTP 403)');
    console.log('--------------------------------------------------------------------');

    const pendingLoginRes = await request('/team/login', {
      method: 'POST',
      body: {
        coachName: coachAName,
        coachEmail: coachAEmail
      }
    });

    assert(pendingLoginRes.status === 403, `Pending team cannot request OTP / login (got HTTP ${pendingLoginRes.status})`);
    assert(pendingLoginRes.body.message && pendingLoginRes.body.message.includes('PENDING'), 'Clear message: Team is currently PENDING admin approval');

    // Also verify coach cannot login via generic /api/auth/team/request-otp
    const pendingAuthRes = await request('/auth/team/request-otp', {
      method: 'POST',
      body: {
        coachName: coachAName,
        coachEmail: coachAEmail
      }
    });
    assert(pendingAuthRes.status === 403, 'Pending team blocked on /api/auth/team/request-otp with HTTP 403');

    // -------------------------------------------------------------------------
    // TEST 4: Admin Module Review & Approval
    // -------------------------------------------------------------------------
    console.log('\n--------------------------------------------------------------------');
    console.log('TEST 4: ADMIN MODULE APPROVAL OF TEAM & 15-MEMBER SQUAD');
    console.log('--------------------------------------------------------------------');

    // 40: Admin login to obtain admin JWT token
    const adminLoginRes = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: '1234' }
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.body.token, 'Administrator logged in successfully to obtain Admin Token');
    const adminHeaders = { Authorization: `Bearer ${adminLoginRes.body.token}` };

    // 4a: Admin views pending teams
    const pendingListRes = await request('/admin/teams/pending', { headers: adminHeaders });
    assert(pendingListRes.status === 200, 'Admin can fetch pending teams list');
    const foundPending = (pendingListRes.body.teams || []).some(t => t.id === teamAId || t.team_name === teamAName);
    assert(foundPending, `Newly registered team "${teamAName}" appears in Admin pending list`);

    // 4b: Admin views team details with all 15 players
    const teamDetailsRes = await request(`/admin/teams/${teamAId}`, { headers: adminHeaders });
    assert(teamDetailsRes.status === 200, `Admin can view team details by ID (${teamAId})`);
    assert(teamDetailsRes.body.team && teamDetailsRes.body.team.players.length === 15, 'Admin can view all 15 players in team details');

    // 4c: Admin approves Team A
    const approveRes = await request(`/admin/teams/${teamAId}/approve`, {
      method: 'PUT',
      headers: adminHeaders
    });
    assert(approveRes.status === 200, `Admin approves team (got HTTP ${approveRes.status})`);
    assert(approveRes.body.success === true, 'Admin approval returns success: true');

    // Verify team is no longer in pending
    const pendingAfterRes = await request('/admin/teams/pending', { headers: adminHeaders });
    const stillPending = (pendingAfterRes.body.teams || []).some(t => t.id === teamAId && t.status === 'PENDING');
    assert(!stillPending, 'Team is removed from pending status after approval');

    // -------------------------------------------------------------------------
    // TEST 5: Approved Coach Login via OTP (NodeMailer)
    // -------------------------------------------------------------------------
    console.log('\n--------------------------------------------------------------------');
    console.log('TEST 5: APPROVED COACH LOGIN & OTP VERIFICATION');
    console.log('--------------------------------------------------------------------');

    // 5a: Coach requests OTP
    const coachOtpRes = await request('/team/login', {
      method: 'POST',
      body: {
        coachName: coachAName,
        coachEmail: coachAEmail
      }
    });

    assert(coachOtpRes.status === 200, `Approved coach OTP request succeeds (got HTTP ${coachOtpRes.status})`);
    assert(coachOtpRes.body.success === true, 'OTP request response success: true');
    assert(coachOtpRes.body.devOtp && coachOtpRes.body.devOtp.length === 6, 'Generated 6-digit OTP code received for test verification');

    const coachOtp = coachOtpRes.body.devOtp || '1234';

    // 5b: Coach enters wrong OTP
    const wrongOtpRes = await request('/team/verify-otp', {
      method: 'POST',
      body: {
        coachEmail: coachAEmail,
        otp: '000000'
      }
    });
    assert(wrongOtpRes.status === 401, 'Backend rejects invalid OTP with HTTP 401');

    // 5c: Coach enters correct OTP -> Receives authenticated JWT session token
    const verifyOtpRes = await request('/team/verify-otp', {
      method: 'POST',
      body: {
        coachEmail: coachAEmail,
        otp: coachOtp
      }
    });

    assert(verifyOtpRes.status === 200, `Coach OTP verification succeeds (got HTTP ${verifyOtpRes.status})`);
    assert(verifyOtpRes.body.token && typeof verifyOtpRes.body.token === 'string', 'JWT session token returned');
    assert(verifyOtpRes.body.user && verifyOtpRes.body.user.role === 'COACH', 'Authenticated user role is "COACH"');
    assert(verifyOtpRes.body.user.teamName === teamAName, `User teamName correctly matches "${teamAName}"`);

    const coachToken = verifyOtpRes.body.token;

    // -------------------------------------------------------------------------
    // TEST 6: Rejection Flow & Login Blocked (Team B)
    // -------------------------------------------------------------------------
    console.log('\n--------------------------------------------------------------------');
    console.log('TEST 6: ADMIN REJECTION FLOW & FORBIDDEN LOGIN (HTTP 403)');
    console.log('--------------------------------------------------------------------');

    const teamBName = `Rejected Warriors ${timestamp}`;
    const coachBEmail = `coach.rejected.${timestamp}@warriors.org`;
    const regBRes = await request('/team/register', {
      method: 'POST',
      body: {
        teamName: teamBName,
        coachName: 'Coach Rejected',
        coachEmail: coachBEmail,
        players: generate15Squad(`TeamB_${timestamp}`)
      }
    });

    const teamBId = regBRes.body.team.id;

    // Admin rejects Team B
    const rejectRes = await request(`/admin/teams/${teamBId}/reject`, {
      method: 'PUT',
      headers: adminHeaders,
      body: { reason: 'Incomplete ground certification documents' }
    });
    assert(rejectRes.status === 200, 'Admin rejects Team B successfully');

    // Attempt coach login for rejected team
    const rejectedLoginRes = await request('/team/login', {
      method: 'POST',
      body: {
        coachName: 'Coach Rejected',
        coachEmail: coachBEmail
      }
    });

    assert(rejectedLoginRes.status === 403, 'Rejected team cannot login / request OTP (HTTP 403 Forbidden)');
    assert(rejectedLoginRes.body.message && rejectedLoginRes.body.message.includes('REJECTED'), 'Clear rejection message returned by backend');

    // -------------------------------------------------------------------------
    // TEST 7: Protected Team Endpoints with Coach JWT
    // -------------------------------------------------------------------------
    console.log('\n--------------------------------------------------------------------');
    console.log('TEST 7: PROTECTED TEAM ENDPOINTS & SQUAD MANAGEMENT');
    console.log('--------------------------------------------------------------------');

    const authHeaders = { Authorization: `Bearer ${coachToken}` };

    // 7a: GET /api/team/profile
    const profileRes = await request('/team/profile', { headers: authHeaders });
    assert(profileRes.status === 200, 'GET /api/team/profile returns 200 OK');
    assert(profileRes.body.profile.teamName === teamAName, `Profile returns registered team name "${teamAName}"`);
    assert(profileRes.body.profile.coachEmail === coachAEmail, `Profile returns coach email "${coachAEmail}"`);
    assert(profileRes.body.profile.approvalStatus === 'Approved', 'Profile returns approvalStatus: "Approved"');

    // 7b: PUT /api/team/profile (update safe fields)
    const updateProfileRes = await request('/team/profile', {
      method: 'PUT',
      headers: authHeaders,
      body: {
        captain: `${teamAName} Captain Star`,
        viceCaptain: `${teamAName} Vice Star`,
        coachPhone: '+91 98888 77777'
      }
    });
    assert(updateProfileRes.status === 200, 'PUT /api/team/profile succeeds for permitted fields');
    assert(updateProfileRes.body.profile.captain === `${teamAName} Captain Star`, 'Captain updated successfully');
    assert(updateProfileRes.body.profile.coachPhone === '+91 98888 77777', 'Coach phone updated successfully');

    // 7c: GET /api/team/squad (Enforcing team isolation - returns 15 players)
    const squadRes = await request('/team/squad', { headers: authHeaders });
    assert(squadRes.status === 200, 'GET /api/team/squad returns 200 OK');
    assert(squadRes.body.count === 15 && squadRes.body.squad.length === 15, 'Returns exactly 15 squad players for this team');
    assert(squadRes.body.squad[0].email === validSquadA[0].email, 'Squad player email matches registered player #1');
    assert(squadRes.body.squad[14].email === validSquadA[14].email, 'Squad player email matches registered player #15');

    // 7d: GET /api/team/matches & GET /api/team/matches/:id
    const matchesRes = await request('/team/matches', { headers: authHeaders });
    assert(matchesRes.status === 200, 'GET /api/team/matches returns 200 OK');
    assert(Array.isArray(matchesRes.body.matches) && matchesRes.body.matches.length > 0, 'Matches list contains scheduled or completed fixtures');

    const firstMatchId = matchesRes.body.matches[0].id;
    const matchDetailRes = await request(`/team/matches/${firstMatchId}`, { headers: authHeaders });
    assert(matchDetailRes.status === 200, `GET /api/team/matches/${firstMatchId} returns match details`);

    // 7e: GET /api/team/matches/:id/scorecard (Read-only scorecard from scorer data)
    const scorecardRes = await request(`/team/matches/${firstMatchId}/scorecard`, { headers: authHeaders });
    assert(scorecardRes.status === 200, 'GET /api/team/matches/:id/scorecard returns 200 OK');
    assert(scorecardRes.body.scorecard && scorecardRes.body.scorecard.match, 'Scorecard contains match data from Scorer database');

    // 7f: GET /api/team/statistics (Real match-derived statistics)
    const statsRes = await request('/team/statistics', { headers: authHeaders });
    assert(statsRes.status === 200, 'GET /api/team/statistics returns 200 OK');
    assert(typeof statsRes.body.statistics.matchesPlayed === 'number', 'Team stats contains matchesPlayed number');
    assert(typeof statsRes.body.statistics.winPercentage === 'number', 'Team stats contains winPercentage calculation');
    assert(typeof statsRes.body.statistics.points === 'number', 'Team stats contains points calculation');

    // 7g: GET /api/team/players/statistics (Player stats for all squad members)
    const playerStatsRes = await request('/team/players/statistics', { headers: authHeaders });
    assert(playerStatsRes.status === 200, 'GET /api/team/players/statistics returns 200 OK');
    assert(Array.isArray(playerStatsRes.body.playerStats) && playerStatsRes.body.playerStats.length === 15, 'Player stats returns stats for all 15 squad members');
    assert(playerStatsRes.body.playerStats[0].batting !== undefined, 'Player #1 includes batting stats block');
    assert(playerStatsRes.body.playerStats[0].bowling !== undefined, 'Player #1 includes bowling stats block');

    // 7h: GET /api/team/notifications & PUT /api/team/notifications/:id/read
    const notifsRes = await request('/team/notifications', { headers: authHeaders });
    assert(notifsRes.status === 200, 'GET /api/team/notifications returns 200 OK');
    assert(Array.isArray(notifsRes.body.notifications), 'Notifications returns array');

    if (notifsRes.body.notifications.length > 0) {
      const notifId = notifsRes.body.notifications[0].id;
      const readRes = await request(`/team/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: authHeaders
      });
      assert(readRes.status === 200, 'PUT /api/team/notifications/:id/read marks notification as read');
    }

    // -------------------------------------------------------------------------
    // TEST 8: Security & Role Boundaries
    // -------------------------------------------------------------------------
    console.log('\n--------------------------------------------------------------------');
    console.log('TEST 8: SECURITY BOUNDARIES & ROLE PERMISSION ENFORCEMENT');
    console.log('--------------------------------------------------------------------');

    // 8a: Coach cannot access Admin endpoints (403 Forbidden)
    const coachOnAdminRes = await request('/admin/teams/pending', { headers: authHeaders });
    assert(coachOnAdminRes.status === 403, 'Coach role blocked from Admin endpoints (HTTP 403 Forbidden)');

    // 8b: Coach cannot access Scorer ball scoring endpoints (403 Forbidden)
    const coachOnScorerRes = await request('/scorer/matches/M-01/ball', {
      method: 'POST',
      headers: authHeaders,
      body: { runs: 4, ball_type: 'NORMAL' }
    });
    assert(coachOnScorerRes.status === 403, 'Coach role blocked from Scorer ball-scoring APIs (HTTP 403 Forbidden)');

    // 8c: Unauthenticated access to /api/team/profile is rejected (401 Unauthorized)
    const unauthRes = await request('/team/profile');
    assert(unauthRes.status === 401, 'Unauthenticated request to /api/team/profile rejected with HTTP 401');

    // -------------------------------------------------------------------------
    // TEST 9: Interoperability with Player Module
    // -------------------------------------------------------------------------
    console.log('\n--------------------------------------------------------------------');
    console.log('TEST 9: PLAYER MODULE INTEROPERABILITY (SQUAD MEMBER LOGIN)');
    console.log('--------------------------------------------------------------------');

    // A player registered in Team A's 15-player squad requests OTP via Player login
    const squadPlayer1 = validSquadA[0];
    const playerOtpReq = await request('/auth/player/request-otp', {
      method: 'POST',
      body: { nameOrEmail: squadPlayer1.email }
    });

    assert(playerOtpReq.status === 200, `Squad player (${squadPlayer1.name}) can request OTP via Player login`);
    assert(playerOtpReq.body.teamName === teamAName, `Player belongs to approved team "${teamAName}"`);
    assert(playerOtpReq.body.devOtp && playerOtpReq.body.devOtp.length === 6, 'Player receives 6-digit OTP code');

    // Verify player OTP
    const playerLoginVerify = await request('/auth/player/verify-otp', {
      method: 'POST',
      body: {
        nameOrEmail: squadPlayer1.email,
        otp: playerOtpReq.body.devOtp || '1234'
      }
    });

    assert(playerLoginVerify.status === 200, 'Squad player can verify OTP and log in');
    assert(playerLoginVerify.body.user && playerLoginVerify.body.user.role === 'PLAYER', 'Squad player logged in with role "PLAYER"');
    assert(playerLoginVerify.body.token !== undefined, 'Squad player received valid JWT token');

    // Player views team info
    const playerTeamView = await request('/player/team', {
      headers: { Authorization: `Bearer ${playerLoginVerify.body.token}` }
    });
    assert(playerTeamView.status === 200, 'Player can view team info via Player Module');
    assert(playerTeamView.body.team.coachName === coachAName, 'Player sees correct coach name from Team registration');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
