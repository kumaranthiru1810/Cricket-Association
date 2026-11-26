/**
 * models/userModel.js
 * Pure MongoDB User Model using Mongoose for Authentication, Profiles, and OTP persistence
 */

const db = require('../config/db');

class UserModel {
  get Model() {
    return db.models.User;
  }

  async findByEmail(email) {
    if (!email) return null;
    await db.initDb();
    const cleanEmail = email.trim().toLowerCase();
    return this.Model.findOne({ email: cleanEmail }).lean();
  }

  async findById(id) {
    if (!id) return null;
    await db.initDb();
    return this.Model.findOne({ id }).lean();
  }

  async create({ id, name, email, mobile, role = 'USER', password_hash = null, status = 'ACTIVE', player_details, scorer_details, umpire_details, ...rest }) {
    await db.initDb();
    const userId = id || `USR-${Date.now()}`;
    const cleanEmail = email.trim().toLowerCase();
    const user = await this.Model.create({
      id: userId,
      name,
      email: cleanEmail,
      mobile: mobile || null,
      role,
      password_hash,
      status,
      ...(player_details && { player_details }),
      ...(scorer_details && { scorer_details }),
      ...(umpire_details && { umpire_details }),
      ...rest
    });
    return user.toObject();
  }

  async updateStatus(userId, status) {
    await db.initDb();
    return this.Model.findOneAndUpdate(
      { id: userId },
      { $set: { status, updated_at: new Date() } },
      { returnDocument: 'after' }
    ).lean();
  }

  async updateStatusByEmail(email, status) {
    await db.initDb();
    const cleanEmail = email.trim().toLowerCase();
    return this.Model.findOneAndUpdate(
      { email: cleanEmail },
      { $set: { status, updated_at: new Date() } },
      { returnDocument: 'after' }
    ).lean();
  }

  async update(identifier, updateFields = {}) {
    await db.initDb();
    if (!identifier) return null;
    const cleanId = typeof identifier === 'string' ? identifier.trim() : identifier;
    const mongoose = require('mongoose');
    const orConditions = [
      { id: cleanId },
      { email: typeof cleanId === 'string' ? cleanId.toLowerCase() : '' }
    ];

    if (mongoose && mongoose.Types && mongoose.Types.ObjectId && mongoose.Types.ObjectId.isValid(cleanId)) {
      orConditions.push({ _id: cleanId });
    }

    return this.Model.findOneAndUpdate(
      { $or: orConditions },
      { $set: { ...updateFields, updated_at: new Date() } },
      { returnDocument: 'after' }
    ).lean();
  }

  async getScorers(status = null) {
    await db.initDb();
    const query = { role: 'SCORER' };
    if (status) query.status = status;
    return this.Model.find(query).lean();
  }

  async getAllUsers(role = null) {
    await db.initDb();
    const query = {};
    if (role) query.role = role;
    return this.Model.find(query).sort({ created_at: -1 }).lean();
  }

  async updateOtp(identifier, { otp_hash, otp_expires_at, otp_attempts }) {
    await db.initDb();
    if (!identifier) return null;
    const cleanId = typeof identifier === 'string' ? identifier.trim() : identifier;
    const query = {
      $or: [
        { id: cleanId },
        { email: typeof cleanId === 'string' ? cleanId.toLowerCase() : '' }
      ]
    };
    const setFields = {
      otp_hash,
      otp_expires_at,
      otp_attempts: typeof otp_attempts === 'number' ? otp_attempts : 0,
      otp_verified_at: null,
      updated_at: new Date()
    };
    return this.Model.findOneAndUpdate(
      query,
      { $set: setFields },
      { returnDocument: 'after' }
    ).lean();
  }

  async markOtpVerified(identifier) {
    await db.initDb();
    if (!identifier) return null;
    const cleanId = typeof identifier === 'string' ? identifier.trim() : identifier;
    const query = {
      $or: [
        { id: cleanId },
        { email: typeof cleanId === 'string' ? cleanId.toLowerCase() : '' }
      ]
    };
    return this.Model.findOneAndUpdate(
      query,
      { 
        $set: { 
          otp_verified_at: new Date(), 
          otp_hash: null, 
          otp_expires_at: null, 
          updated_at: new Date() 
        } 
      },
      { returnDocument: 'after' }
    ).lean();
  }

  async clearOtp(identifier) {
    await db.initDb();
    if (!identifier) return null;
    const cleanId = typeof identifier === 'string' ? identifier.trim() : identifier;
    const query = {
      $or: [
        { id: cleanId },
        { email: typeof cleanId === 'string' ? cleanId.toLowerCase() : '' }
      ]
    };
    return this.Model.findOneAndUpdate(
      query,
      { 
        $set: { 
          otp_hash: null, 
          otp_expires_at: null, 
          updated_at: new Date() 
        } 
      },
      { returnDocument: 'after' }
    ).lean();
  }
}

module.exports = new UserModel();