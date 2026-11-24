/**
 * models/venueModel.js
 * Dedicated Data Access Model for Venues & Grounds Management.
 * Integrates with MongoDB Mongoose Venue Model.
 */

const db = require('../config/db');

class VenueModel {
  /**
   * Get Mongoose Venue Model
   */
  getModel() {
    return db.models.Venue;
  }

  /**
   * Get all venues
   */
  async getAll({ search } = {}) {
    await db.initDb();
    const query = {};
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { location: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } }
      ];
    }
    return db.models.Venue.find(query).sort({ name: 1 }).lean();
  }

  /**
   * Find venue by ID
   */
  async findById(id) {
    if (!id) return null;
    await db.initDb();
    const cleanId = String(id).trim();
    return db.models.Venue.findOne({
      $or: [
        { id: cleanId },
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
      ].filter(Boolean)
    }).lean();
  }

  /**
   * Find venue by name (case-insensitive)
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
    return db.models.Venue.findOne(query).lean();
  }

  /**
   * Create or update venue
   */
  async save(venueData) {
    await db.initDb();
    const cleanName = String(venueData.name || '').trim();
    if (!cleanName) {
      throw new Error('Venue name is required');
    }

    const venId = venueData.id || `VEN-${Date.now()}`;
    const updateData = {
      id: venId,
      name: cleanName,
      location: (venueData.location || venueData.description || 'Virudhunagar').trim(),
      capacity: Number(venueData.capacity) || 5000,
      floodlights: venueData.floodlights !== undefined ? Boolean(venueData.floodlights) : true,
      description: (venueData.description || '').trim()
    };

    return db.models.Venue.findOneAndUpdate(
      { $or: [{ id: venId }, { name: { $regex: new RegExp(`^${cleanName}$`, 'i') } }] },
      { $set: updateData },
      { upsert: true, returnDocument: 'after' }
    ).lean();
  }

  /**
   * Delete venue by ID or name
   */
  async delete(id) {
    if (!id) return null;
    await db.initDb();
    const cleanId = String(id).trim();
    const query = {
      $or: [
        { id: cleanId },
        { name: cleanId },
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }
      ].filter(Boolean)
    };
    return db.models.Venue.findOneAndDelete(query).lean();
  }
}

module.exports = new VenueModel();
