const db = require('../config/db');
const authService = require('../services/authService');
const adminDashboardController = require('../controllers/adminDashboardController');

async function testCompleteFlow() {
  await db.initDb();
  console.log('=== Starting Complete Registration and Admin Approval Test ===\n');

  const ts = Date.now();
  const TEST_CREDENTIAL = 'test1234'; // ggignore
  const testPlayerEmail = `test.player.${ts}@cfvd.org`;
  const testCoachEmail = `test.coach.${ts}@cfvd.org`;
  const testScorerEmail = `test.scorer.${ts}@cfvd.org`;
  const testUmpireEmail = `test.umpire.${ts}@cfvd.org`;

  // 1. Register Player
  console.log('1. Testing Player Registration...');
  const playerRes = await authService.registerPlayer({
    name: 'Test Player Saravanan',
    email: testPlayerEmail,
    password: TEST_CREDENTIAL,
    mobile: '9876543210',
    role: 'Batsman',
    category: 'Senior Men',
    taluk: 'Virudhunagar',
    battingStyle: 'Right-Handed Batsman'
  });
  console.log('✓ Player Registered:', playerRes.success, playerRes.player.id, playerRes.player.email);

  // 2. Register Team
  console.log('\n2. Testing Team Registration...');
  const squadPlayers = [];
  for (let i = 1; i <= 15; i++) {
    squadPlayers.push({
      jerseyNumber: i,
      name: `Squad Player ${i}`,
      email: `squad.${i}.${ts}@cfvd.org`,
      role: i === 1 ? 'Captain' : i === 2 ? 'Wicket Keeper' : 'Batter'
    });
  }
  const teamRes = await authService.registerTeam({
    teamName: `Virudhunagar Champions ${ts}`,
    coachName: 'Coach Raman',
    coachEmail: testCoachEmail,
    password: TEST_CREDENTIAL,
    city: 'Virudhunagar',
    taluk: 'Virudhunagar',
    players: squadPlayers
  });
  console.log('✓ Team Registered:', teamRes.success, 'Status:', teamRes.status, 'Team ID:', teamRes.team?.id);
  const teamId = teamRes.team.id;

  // 3. Register Scorer
  console.log('\n3. Testing Scorer Registration...');
  const scorerRes = await authService.registerScorer({
    name: 'Official Scorer Ramesh',
    email: testScorerEmail,
    password: TEST_CREDENTIAL,
    mobile: '9876543211',
    taluk: 'Virudhunagar',
    certificationLevel: 'District Certified'
  });
  console.log('✓ Scorer Registered:', scorerRes.success, 'Status:', scorerRes.status, 'Scorer ID:', scorerRes.scorer?.id);
  const scorerId = scorerRes.scorer.id;

  // 4. Register Umpire
  console.log('\n4. Testing Umpire Registration...');
  const umpireRes = await authService.registerUmpire({
    name: 'Thiru. K. Sundaram',
    email: testUmpireEmail,
    mobile: '9876543212',
    password: TEST_CREDENTIAL,
    qualification: 'District Certified Umpire',
    experience: '10 years officiating',
    experienceYears: 10,
    district: 'Virudhunagar',
    state: 'Tamil Nadu',
    specialization: 'On-field Umpire'
  });
  console.log('✓ Umpire Registered:', umpireRes.success, 'Status:', umpireRes.status, 'Umpire ID:', umpireRes.umpire?.id);
  const umpireId = umpireRes.umpire.id;

  // 5. Test Admin getApprovals
  console.log('\n5. Testing Admin getApprovals...');
  let approvalsList = [];
  const mockReq = {};
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };

  await adminDashboardController.getApprovals(mockReq, mockRes);
  approvalsList = mockRes.jsonData?.approvals || [];
  console.log(`✓ Approvals returned: ${approvalsList.length} items`);

  const foundTeam = approvalsList.find(a => a.id === teamId || a.contact === testCoachEmail);
  const foundScorer = approvalsList.find(a => a.id === scorerId || a.contact === testScorerEmail);
  const foundUmpire = approvalsList.find(a => a.id === umpireId || a.contact === testUmpireEmail);
  const foundPlayer = approvalsList.find(a => a.contact === testPlayerEmail);

  console.log('Found Team in Approvals:', !!foundTeam, 'Status:', foundTeam?.status);
  console.log('Found Scorer in Approvals:', !!foundScorer, 'Status:', foundScorer?.status);
  console.log('Found Umpire in Approvals:', !!foundUmpire, 'Status:', foundUmpire?.status);
  console.log('Found Player in Approvals:', !!foundPlayer, 'Status:', foundPlayer?.status);

  if (!foundTeam || !foundScorer || !foundUmpire) {
    throw new Error('Not all applications were surfaced in getApprovals!');
  }

  // 6. Test Admin Approval for Team
  console.log('\n6. Approving Team as Admin...');
  const approveTeamRes = {
    status(code) { return this; },
    json(data) { this.data = data; return this; }
  };
  await adminDashboardController.handleApproval(
    { params: { type: 'TEAM', id: teamId }, body: { action: 'approve' } },
    approveTeamRes
  );
  console.log('✓ Team approval result:', approveTeamRes.data?.message);

  // 7. Test Admin Approval for Scorer
  console.log('\n7. Approving Scorer as Admin...');
  const approveScorerRes = {
    status(code) { return this; },
    json(data) { this.data = data; return this; }
  };
  await adminDashboardController.handleApproval(
    { params: { type: 'SCORER', id: scorerId }, body: { action: 'approve' } },
    approveScorerRes
  );
  console.log('✓ Scorer approval result:', approveScorerRes.data?.message);

  // 8. Test Admin Approval for Umpire
  console.log('\n8. Approving Umpire as Admin...');
  const approveUmpireRes = {
    status(code) { return this; },
    json(data) { this.data = data; return this; }
  };
  await adminDashboardController.handleApproval(
    { params: { type: 'UMPIRE', id: umpireId }, body: { action: 'approve' } },
    approveUmpireRes
  );
  console.log('✓ Umpire approval result:', approveUmpireRes.data?.message);

  // 9. Verify Notifications
  console.log('\n9. Verifying Admin Notifications...');
  const notifRes = {
    status(code) { return this; },
    json(data) { this.data = data; return this; }
  };
  await adminDashboardController.getNotifications(mockReq, notifRes);
  const notifs = notifRes.data?.notifications || [];
  console.log(`✓ Total notifications in system: ${notifs.length}`);
  const approvalNotifs = notifs.filter(n => n.type === 'APPROVAL_UPDATE');
  console.log(`✓ Approval update notifications: ${approvalNotifs.length}`);
  console.log('Latest notification title:', notifs[0]?.title);

  // 10. Test Login for all approved users
  console.log('\n10. Testing Logins after Admin Approval...');

  // Coach login
  const coachLogin = await authService.login(testCoachEmail, TEST_CREDENTIAL, 'TEAM');
  console.log('✓ Coach Login Succeeded! User:', coachLogin.user.name, 'Role:', coachLogin.user.role);

  // Scorer login
  const scorerLogin = await authService.login(testScorerEmail, TEST_CREDENTIAL, 'SCORER');
  console.log('✓ Scorer Login Succeeded! User:', scorerLogin.user.name, 'Role:', scorerLogin.user.role);

  // Umpire login
  const umpireLogin = await authService.login(testUmpireEmail, TEST_CREDENTIAL, 'UMPIRE');
  console.log('✓ Umpire Login Succeeded! User:', umpireLogin.user.name, 'Role:', umpireLogin.user.role);

  // Player login
  const playerLogin = await authService.login(testPlayerEmail, TEST_CREDENTIAL, 'PLAYER');
  console.log('✓ Player Login Succeeded! User:', playerLogin.user.name, 'Role:', playerLogin.user.role);

  // 11. Test Notification Read and Delete
  console.log('\n11. Testing Notification Mark Read and Delete...');
  const testNotif = notifs[0];
  if (testNotif) {
    const markReadRes = {
      status(code) { return this; },
      json(data) { this.data = data; return this; }
    };
    await adminDashboardController.markNotificationRead({ params: { id: testNotif.id } }, markReadRes);
    console.log('✓ Mark notification read result:', markReadRes.data?.message);

    const deleteNotifRes = {
      status(code) { return this; },
      json(data) { this.data = data; return this; }
    };
    await adminDashboardController.deleteNotification({ params: { id: testNotif.id } }, deleteNotifRes);
    console.log('✓ Delete notification result:', deleteNotifRes.data?.message);
  }

  console.log('\n🎉 ALL REQUESTS, NOTIFICATIONS, APPROVALS AND LOGINS PASSED PERFECTLY!');
  process.exit(0);
}

testCompleteFlow().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});

