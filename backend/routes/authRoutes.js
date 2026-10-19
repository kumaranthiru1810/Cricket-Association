/**
 * routes/authRoutes.js
 * Comprehensive Authentication Endpoints for all 5 roles
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, requireAdminAuth } = require('../middleware/authMiddleware');

// 1. Email OTP Verification for Registration
router.post('/send-registration-otp', (req, res) => authController.requestRegistrationOtp(req, res));
router.post('/register-otp', (req, res) => authController.requestRegistrationOtp(req, res));
router.post('/verify-registration-otp', (req, res) => authController.verifyRegistrationOtp(req, res));
router.post('/verify-register-otp', (req, res) => authController.verifyRegistrationOtp(req, res));

// 1.1. Multi-Step Forgot Password Flow (4-Digit OTP & Bcrypt Password Reset)
router.post('/forgot-password/request-otp', (req, res) => authController.requestForgotPasswordOtp(req, res));
router.post('/forgot-password/verify-otp', (req, res) => authController.verifyForgotPasswordOtp(req, res));
router.post('/forgot-password/reset-password', (req, res) => authController.resetPasswordWithOtp(req, res));
router.post('/request-reset-otp', (req, res) => authController.requestForgotPasswordOtp(req, res));
router.post('/verify-reset-otp', (req, res) => authController.verifyForgotPasswordOtp(req, res));
router.post('/reset-password', (req, res) => authController.resetPasswordWithOtp(req, res));

// 2. Password-Based Login for All Roles & Cookie Session Management
router.post('/login', (req, res) => authController.login(req, res));
router.post('/admin/login', (req, res) => authController.adminLogin(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/logout', (req, res) => authController.logout(req, res));
router.get('/me', verifyToken, (req, res) => authController.getMe(req, res));

// 3. Legacy / OTP Login Compatibility
router.post('/request-otp', (req, res) => authController.requestOtp(req, res));
router.post('/verify-otp', (req, res) => authController.verifyOtp(req, res));
router.post('/team/request-otp', (req, res) => authController.requestTeamOtp(req, res));
router.post('/team/verify-otp', (req, res) => authController.verifyTeamOtp(req, res));
router.post('/player/request-otp', (req, res) => authController.requestPlayerOtp(req, res));
router.post('/player/verify-otp', (req, res) => authController.verifyPlayerOtp(req, res));

// 4. Registration Endpoints by Role (With Password)
router.post('/register', (req, res) => authController.registerScorer(req, res));
router.post('/register-player', (req, res) => authController.registerPlayer(req, res));
router.post('/register-team', (req, res) => authController.registerTeam(req, res));
router.post('/register-scorer', (req, res) => authController.registerScorer(req, res));
router.post('/register-umpire', (req, res) => authController.registerUmpire(req, res));
router.post('/register-content', (req, res) => authController.registerContentStaff(req, res));

// 5. Admin & Management (Strictly Protected with requireAdminAuth)
router.get('/teams', (req, res) => authController.getTeams(req, res));
router.get('/admin/all-registrations', requireAdminAuth, (req, res) => authController.getAllRegistrations(req, res));
router.post('/admin/teams/:id/approve', requireAdminAuth, (req, res) => authController.approveTeam(req, res));
router.post('/admin/teams/:id/reject', requireAdminAuth, (req, res) => authController.rejectTeam(req, res));
router.post('/admin/approve-registration', requireAdminAuth, (req, res) => {
  const { id, type } = req.body;
  if (type === 'SCORER') {
    return authController.updateScorerStatus({ params: { id }, body: { id, status: 'APPROVED' } }, res);
  }
  if (type === 'UMPIRE') {
    return authController.updateUmpireStatus({ params: { id }, body: { id, status: 'APPROVED' } }, res);
  }
  if (type === 'PLAYER' || type === 'CONTENT' || type === 'CONTENT_CREATOR') {
    return authController.approveRegistration(req, res);
  }
  return authController.approveTeam({ params: { id }, body: { id } }, res);
});
router.post('/admin/reject-registration', requireAdminAuth, (req, res) => {
  const { id, type, reason } = req.body;
  if (type === 'SCORER') {
    return authController.updateScorerStatus({ params: { id }, body: { id, status: 'REJECTED', reason } }, res);
  }
  if (type === 'UMPIRE') {
    return authController.updateUmpireStatus({ params: { id }, body: { id, status: 'REJECTED', reason } }, res);
  }
  if (type === 'PLAYER' || type === 'CONTENT' || type === 'CONTENT_CREATOR') {
    return authController.rejectRegistration(req, res);
  }
  return authController.rejectTeam({ params: { id }, body: { id, reason } }, res);
});
router.post('/admin/scorer-status', requireAdminAuth, (req, res) => authController.updateScorerStatus(req, res));
router.post('/admin/umpire-status', requireAdminAuth, (req, res) => authController.updateUmpireStatus(req, res));
router.get('/admin/notifications', requireAdminAuth, (req, res) => authController.getAdminNotifications(req, res));
router.patch('/admin/scorers/:id/status', requireAdminAuth, (req, res) => authController.updateScorerStatus(req, res));
router.patch('/admin/umpires/:id/status', requireAdminAuth, (req, res) => authController.updateUmpireStatus(req, res));

module.exports = router;