/**
 * models/playerModel.js
 * Pure MongoDB Player Model for Player Profile, Photo / Image Path & Team Squad Roster
 */

const db = require('../config/db');

class PlayerModel {
  get Model() {
    return db.models.Player;
  }

  /**
   * Find player by unique player ID
   */
  async findById(id) {
    if (!id) return null;
    await db.initDb();
    return this.Model.findOne({ id }).lean();
  }

  /**
   * Find player by email
   */
  async findByEmail(email) {
    if (!email) return null;
    await db.initDb();
    const cleanEmail = email.trim().toLowerCase();
    return this.Model.findOne({ email: cleanEmail }).lean();
  }

  /**
   * Find player by either ID or Email
   */
  async findByIdOrEmail(identifier) {
    if (!identifier) return null;
    await db.initDb();
    const cleanId = identifier.trim();
    const cleanEmail = cleanId.toLowerCase();
    return this.Model.findOne({
      $or: [{ id: cleanId }, { email: cleanEmail }]
    }).lean();
  }

  /**
   * Create new player document
   */
  async create(data) {
    await db.initDb();
    const cleanEmail = data.email ? data.email.trim().toLowerCase() : null;
    const photo = data.photo || data.image_path || data.imagePath || null;
    const image_path = data.image_path || data.imagePath || data.photo || null;

    const player = await this.Model.create({
      id: data.id || `PLY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      team_id: data.team_id || data.teamId || 'TM-01',
      name: (data.name || 'Player').trim(),
      email: cleanEmail,
      role: data.role || 'BATTER',
      jersey_number: data.jersey_number ?? data.jerseyNumber ?? 0,
      batting_style: data.batting_style || data.battingStyle || 'Right Hand Bat',
      bowling_style: data.bowling_style || data.bowlingStyle || 'Right Arm Medium',
      photo,
      image_path,
      status: data.status || 'ACTIVE',
      stats: data.stats || {}
    });
    return player.toObject();
  }

  /**
   * Update permitted player profile fields including photo and image_path
   */
  async updateProfile(idOrEmail, updates = {}) {
    await db.initDb();
    if (!idOrEmail) throw new Error('Player ID or email is required');

    const cleanId = idOrEmail.trim();
    const cleanEmail = cleanId.toLowerCase();

    const photo = updates.photo !== undefined 
      ? updates.photo 
      : (updates.image_path !== undefined ? updates.image_path : updates.imagePath);
    const image_path = updates.image_path !== undefined 
      ? updates.image_path 
      : (updates.photo !== undefined ? updates.photo : updates.imagePath);

    const updateDoc = {};
    if (updates.batting_style || updates.battingStyle) {
      updateDoc.batting_style = String(updates.batting_style || updates.battingStyle).trim();
    }
    if (updates.bowling_style || updates.bowlingStyle) {
      updateDoc.bowling_style = String(updates.bowling_style || updates.bowlingStyle).trim();
    }
    if (updates.jersey_number !== undefined || updates.jerseyNumber !== undefined) {
      const num = parseInt(updates.jersey_number ?? updates.jerseyNumber, 10);
      if (!isNaN(num) && num >= 0 && num <= 999) {
        updateDoc.jersey_number = num;
      }
    }
    if (photo !== undefined) {
      updateDoc.photo = photo ? String(photo).trim() : null;
    }
    if (image_path !== undefined) {
      updateDoc.image_path = image_path ? String(image_path).trim() : null;
    }
    updateDoc.updated_at = new Date();

    return this.Model.findOneAndUpdate(
      { $or: [{ id: cleanId }, { email: cleanEmail }] },
      { $set: updateDoc },
      { returnDocument: 'after' }
    ).lean();
  }

  /**
   * Update photo and image path specifically
   */
  async updatePhoto(idOrEmail, photoUrlOrPath) {
    await db.initDb();
    const cleanId = idOrEmail.trim();
    const cleanEmail = cleanId.toLowerCase();
    const val = photoUrlOrPath ? String(photoUrlOrPath).trim() : null;

    return this.Model.findOneAndUpdate(
      { $or: [{ id: cleanId }, { email: cleanEmail }] },
      { $set: { photo: val, image_path: val, updated_at: new Date() } },
      { returnDocument: 'after' }
    ).lean();
  }

  /**
   * Find all players belonging to a team
   */
  async findByTeam(teamId) {
    await db.initDb();
    return this.Model.find({ team_id: teamId }).lean();
  }

  /**
   * Get all players with optional query/filters
   */
  async getAllPlayers(filter = {}) {
    await db.initDb();
    return this.Model.find(filter).sort({ name: 1 }).lean();
  }
}

module.exports = new PlayerModel();
