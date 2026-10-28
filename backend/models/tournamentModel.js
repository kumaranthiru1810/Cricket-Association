/**
 * models/tournamentModel.js
 * Dedicated Data Access Model for Tournament Management & Championship Records.
 * Integrates with MongoDB Mongoose Tournament Model.
 */

const db = require('../config/db');

class TournamentModel {
  /**
   * Get Mongoose Tournament Model
   */
  getModel() {
    return db.models.Tournament;
  }

  /**
   * Find tournament by ID
   */
  async findById(tournamentId) {
    if (!tournamentId) return null;
    await db.initDb();
    const cleanId = String(tournamentId).trim();
    return db.models.Tournament.findOne({
      $or: [
        { id: cleanId },
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
      ].filter(Boolean)
    }).lean();
  }

  /**
   * Find tournament by name (case-insensitive)
   */
  async findByName(name, excludeId = null) {
    if (!name) return null;
    await db.initDb();
    const query = {
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    };
    if (excludeId) {
      query.id = { $ne: excludeId };
    }
    return db.models.Tournament.findOne(query).lean();
  }

  /**
   * Query tournaments with optional status filter and search
   */
  async getAll({ status, search } = {}) {
    await db.initDb();
    const query = {};

    if (status && status !== 'all' && status !== 'ALL') {
      const s = String(status).toUpperCase();
      if (s === 'ONGOING') {
        query.status = { $in: ['ONGOING', 'ACTIVE'] };
      } else {
        query.status = s;
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { short_name: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { season: { $regex: term, $options: 'i' } },
        { venue: { $regex: term, $options: 'i' } }
      ];
    }

    return db.models.Tournament.find(query).sort({ createdAt: -1, start_date: -1 }).lean();
  }

  /**
   * Create new tournament
   */
  async create(data) {
    await db.initDb();
    return db.models.Tournament.create(data);
  }

  /**
   * Update existing tournament
   */
  async update(tournamentId, updateData) {
    await db.initDb();
    const cleanId = String(tournamentId).trim();
    return db.models.Tournament.findOneAndUpdate(
      {
        $or: [
          { id: cleanId },
          { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
        ].filter(Boolean)
      },
      { $set: updateData },
      { returnDocument: 'after' }
    ).lean();
  }

  /**
   * Delete or deactivate tournament
   */
  async delete(tournamentId) {
    await db.initDb();
    const cleanId = String(tournamentId).trim();
    return db.models.Tournament.findOneAndDelete({
      $or: [
        { id: cleanId },
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
      ].filter(Boolean)
    }).lean();
  }
}

module.exports = new TournamentModel();
