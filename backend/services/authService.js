/**
 * services/authService.js
 * Modular Facade Authentication Service.
 * Delegates role-specific operations to:
 * - auth/scorerAuth.js
 * - auth/teamAuth.js
 * - auth/playerAuth.js
 * - auth/umpireAuth.js
 * - auth/adminAuth.js
 * - auth/passwordResetAuth.js
 */

const scorerAuth = require('./auth/scorerAuth');
const teamAuth = require('./auth/teamAuth');
const playerAuth = require('./auth/playerAuth');
const umpireAuth = require('./auth/umpireAuth');
const adminAuth = require('./auth/adminAuth');
const passwordResetAuth = require('./auth/passwordResetAuth');

class AuthService {
  // Password Reset & Registration OTPs
  async requestRegistrationOtp(email, name, role, teamName) {
    return passwordResetAuth.requestRegistrationOtp(
      email,
      name,
      role,
      teamName,
      this.checkRegistrationExists.bind(this)
    );
  }

  async verifyRegistrationOtp(email, otp) {
    return passwordResetAuth.verifyRegistrationOtp(email, otp);
  }

  async requestForgotPasswordOtp(email, role) {
    return passwordResetAuth.requestForgotPasswordOtp(email, role);
  }

  async verifyForgotPasswordOtp(email, otp) {
    return passwordResetAuth.verifyForgotPasswordOtp(email, otp);
  }

  async resetPasswordWithOtp(email, otp, newPassword) {
    return passwordResetAuth.resetPasswordWithOtp(email, otp, newPassword);
  }

  // Scorer Auth
  async requestScorerOtp(email) {
    return scorerAuth.requestScorerOtp(email);
  }

  async verifyScorerOtp(email, otp) {
    return scorerAuth.verifyScorerOtp(email, otp);
  }

  async registerScorer(payload) {
    return scorerAuth.registerScorer(payload, passwordResetAuth.getRegistrationOtpMap());
  }

  async getPendingScorers() {
    return scorerAuth.getPendingScorers();
  }

  async approveScorer(scorerId) {
    return scorerAuth.approveScorer(scorerId);
  }

  async rejectScorer(scorerId, reason) {
    return scorerAuth.rejectScorer(scorerId, reason);
  }

  async getScorers(status = null) {
    return scorerAuth.getScorers(status);
  }

  async updateScorerStatus(idOrEmail, newStatus, reason = null) {
    return scorerAuth.updateScorerStatus(idOrEmail, newStatus, reason);
  }

  // Team Auth
  async requestTeamOtp(coachName, coachEmail) {
    return teamAuth.requestTeamOtp(coachName, coachEmail);
  }

  async verifyTeamOtp(coachEmail, otp) {
    return teamAuth.verifyTeamOtp(coachEmail, otp);
  }

  async registerTeam(data) {
    return teamAuth.registerTeam(data, passwordResetAuth.getRegistrationOtpMap());
  }

  async approveTeam(teamId, adminId = 'ADMIN') {
    return teamAuth.approveTeam(teamId, adminId);
  }

  async rejectTeam(teamId, reason, adminId = 'ADMIN') {
    return teamAuth.rejectTeam(teamId, reason, adminId);
  }

  async checkTeamExists(teamName, coachEmail) {
    return teamAuth.checkTeamExists(teamName, coachEmail, this.checkRegistrationExists.bind(this));
  }

  async getTeams(status = null) {
    return teamAuth.getTeams(status);
  }

  // Player Auth
  async _playerLoginByTeamAndEmail(email, teamName) {
    return playerAuth.playerLoginByTeamAndEmail(email, teamName);
  }

  async requestPlayerOtp(nameOrEmail) {
    return playerAuth.requestPlayerOtp(nameOrEmail);
  }

  async verifyPlayerOtp(nameOrEmail, otp) {
    return playerAuth.verifyPlayerOtp(nameOrEmail, otp);
  }

  async registerPlayer(payload) {
    return playerAuth.registerPlayer(payload, passwordResetAuth.getRegistrationOtpMap());
  }

  async findPlayerTeam(email) {
    return playerAuth.findPlayerTeam(email);
  }

  // Umpire Auth
  async registerUmpire(payload) {
    return umpireAuth.registerUmpire(payload, passwordResetAuth.getRegistrationOtpMap());
  }

  async updateUmpireStatus(idOrEmail, newStatus, reason = null) {
    return umpireAuth.updateUmpireStatus(idOrEmail, newStatus, reason);
  }

  // Admin & Universal Auth
  async requestOtp(email, roleRequired = null) {
    return adminAuth.requestOtp(email, roleRequired);
  }

  async verifyOtp(email, otp) {
    return adminAuth.verifyOtp(email, otp);
  }

  async adminLogin(email, password) {
    return adminAuth.adminLogin(email, password);
  }

  async login(identifier, passwordOrOtp, roleRequired = null, teamName = null) {
    return adminAuth.login(
      identifier,
      passwordOrOtp,
      roleRequired,
      teamName,
      this._playerLoginByTeamAndEmail.bind(this)
    );
  }

  async register(data) {
    const role = (data?.role || '').toUpperCase();
    if (role === 'PLAYER') return this.registerPlayer(data);
    if (role === 'SCORER') return this.registerScorer(data);
    if (role === 'UMPIRE') return this.registerUmpire(data);
    if (role === 'CONTENT' || role === 'CONTENT_CREATOR') return this.registerContentStaff(data);
    return this.registerTeam(data);
  }

  async registerContentStaff(payload) {
    return adminAuth.registerContentStaff(payload);
  }

  async checkRegistrationExists(options) {
    return adminAuth.checkRegistrationExists(options);
  }

  async getAdminNotifications(status = null) {
    return adminAuth.getAdminNotifications(status);
  }

  async getProfile(userId) {
    return adminAuth.getProfile(userId);
  }

  async getAllRegistrations(filterStatus = null, filterRole = null) {
    return adminAuth.getAllRegistrations(filterStatus, filterRole);
  }

  async approveRegistration(id, type = 'TEAM', adminId = 'ADMIN') {
    return adminAuth.approveRegistration(id, type, adminId);
  }

  async rejectRegistration(id, type = 'TEAM', reason = 'Criteria not met', adminId = 'ADMIN') {
    return adminAuth.rejectRegistration(id, type, reason, adminId);
  }
}

module.exports = new AuthService();
