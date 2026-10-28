/**
 * models/tournamentRegistrationModel.js
 * Dedicated Data Access Model for Team Tournament Registrations.
 * Manages Team applications for official tournaments with status tracking,
 * preventing duplicates, enforcing team quotas, and facilitating Admin approvals.
 */

const db = require('../config/db');

class TournamentRegistrationModel {
  /**
   * Get Mongoose Model
   */
  getModel() {
    return db.models.TournamentRegistration;
  }

  /**
   * Find registration by ID
   */
  async findById(id) {
    if (!id) return null;
    await db.initDb();
    const cleanId = String(id).trim();
    return db.models.TournamentRegistration.findOne({
      $or: [
        { id: cleanId },
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
      ].filter(Boolean)
    }).lean();
  }

  /**
   * Find existing registration for a specific team in a tournament
   */
  async findByTournamentAndTeam(tournamentId, teamId) {
    if (!tournamentId || !teamId) return null;
    await db.initDb();
    return db.models.TournamentRegistration.findOne({
      tournament_id: String(tournamentId).trim(),
      team_id: String(teamId).trim()
    }).lean();
  }

  /**
   * Find existing registration by Coach Email and Tournament
   */
  async findByTournamentAndCoachEmail(tournamentId, coachEmail) {
    if (!tournamentId || !coachEmail) return null;
    await db.initDb();
    return db.models.TournamentRegistration.findOne({
      tournament_id: String(tournamentId).trim(),
      coach_email: String(coachEmail).trim().toLowerCase()
    }).lean();
  }

  /**
   * Create a new registration
   */
  async create(data) {
    await db.initDb();
    return db.models.TournamentRegistration.create(data);
  }

  /**
   * Get all registrations with optional filtering (tournament, team, coach, status)
   */
  async getAll({ tournamentId, teamId, coachEmail, status, search } = {}) {
    await db.initDb();
    const query = {};

    if (tournamentId && tournamentId !== 'ALL' && tournamentId !== 'all') {
      query.tournament_id = String(tournamentId).trim();
    }

    if (teamId) {
      query.team_id = String(teamId).trim();
    }

    if (coachEmail) {
      query.coach_email = String(coachEmail).trim().toLowerCase();
    }

    if (status && status !== 'ALL' && status !== 'all') {
      query.status = String(status).toUpperCase();
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { tournament_name: { $regex: term, $options: 'i' } },
        { team_name: { $regex: term, $options: 'i' } },
        { coach_name: { $regex: term, $options: 'i' } },
        { coach_email: { $regex: term, $options: 'i' } }
      ];
    }

    return db.models.TournamentRegistration.find(query).sort({ registration_date: -1, createdAt: -1 }).lean();
  }

  /**
   * Count approved teams for a tournament
   */
  async countApproved(tournamentId) {
    await db.initDb();
    return db.models.TournamentRegistration.countDocuments({
      tournament_id: String(tournamentId).trim(),
      status: 'APPROVED'
    });
  }

  /**
   * Update registration status (Approve / Reject)
   */
  async updateStatus(id, { status, adminEmail, rejectionReason = null }) {
    await db.initDb();
    const cleanId = String(id).trim();
    const update = {
      status: String(status).toUpperCase(),
      updated_at: new Date()
    };

    if (status === 'APPROVED') {
      update.approved_by = adminEmail || 'admin@cfvd.org';
      update.approved_at = new Date();
      update.rejected_by = null;
      update.rejected_at = null;
      update.rejection_reason = null;
    } else if (status === 'REJECTED') {
      update.rejected_by = adminEmail || 'admin@cfvd.org';
      update.rejected_at = new Date();
      update.rejection_reason = rejectionReason || 'Registration application declined by tournament committee.';
    }

    return db.models.TournamentRegistration.findOneAndUpdate(
      {
        $or: [
          { id: cleanId },
          { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
        ].filter(Boolean)
      },
      { $set: update },
      { returnDocument: 'after' }
    ).lean();
  }

  /**
   * Delete registration
   */
  async delete(id) {
    await db.initDb();
    const cleanId = String(id).trim();
    return db.models.TournamentRegistration.findOneAndDelete({
      $or: [
        { id: cleanId },
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
      ].filter(Boolean)
    }).lean();
  }
}

module.exports = new TournamentRegistrationModel();
