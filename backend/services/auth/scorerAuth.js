/**
 * backend/services/auth/scorerAuth.js
 * Scorer Authentication & Registration Service
 */

const jwt = require('jsonwebtoken');
const scorerModel = require('../../models/scorerModel');
const userModel = require('../../models/userModel');
const notificationModel = require('../../models/notificationModel');
const otpService = require('../otpService');
const { sendOtpEmail } = require('../../config/mailer');
const db = require('../../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'cricket_super_secret_jwt_2026';

class ScorerAuth {
  /**
   * Request OTP for dedicated Scorer Login
   */
  async requestScorerOtp(email) {
    if (!email || typeof email !== 'string') {
      throw { status: 400, message: 'Scorer email is required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw { status: 400, message: 'Invalid email address format.' };
    }

    if (!global.__scorerRateLimitMap) {
      global.__scorerRateLimitMap = new Map();
    }
    const lastRequest = global.__scorerRateLimitMap.get(cleanEmail);
    const now = Date.now();
    if (lastRequest && (now - lastRequest < 30000)) {
      throw { status: 429, message: 'Please wait 30 seconds before requesting another OTP.' };
    }

    await db.initDb();
    let user = await userModel.findByEmail(cleanEmail);
    if (!user) {
      const s = await scorerModel.findByEmail(cleanEmail);
      if (s) {
        user = {
          id: s.id,
          name: s.full_name,
          email: s.email,
          role: 'SCORER',
          status: s.status,
          otp_hash: s.otp_hash,
          otp_expires_at: s.otp_expires_at
        };
      }
    }

    if (!user) {
      throw { status: 404, notFound: true, message: 'Scorer account not found. Please register as a scorer first.' };
    }

    if (user.role !== 'SCORER' && user.role !== 'ADMIN') {
      throw { status: 403, message: 'Access denied: You are not registered as a scorer.' };
    }

    if (user.status === 'PENDING') {
      throw { status: 403, scorerStatus: 'PENDING', message: 'Your registration is pending admin approval. You can only log in once an administrator approves your account.' };
    }

    if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
      throw { status: 403, scorerStatus: 'REJECTED', message: 'Your scorer account was rejected by the administrator.' };
    }

    global.__scorerRateLimitMap.set(cleanEmail, Date.now());
    const rawOtp = otpService.generateOtpCode();
    const otpHash = otpService.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + otpService.OTP_EXPIRATION_MS);

    await userModel.updateOtp(user.id || cleanEmail, {
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
      otp_attempts: 0
    });

    try {
      await scorerModel.updateOtp(user.id || cleanEmail, {
        otp_hash: otpHash,
        otp_expires_at: expiresAt,
        otp_attempts: 0
      });
    } catch (e) { }

    await sendOtpEmail({
      toEmail: user.email,
      userName: user.name,
      otp: rawOtp
    });

    return {
      success: true,
      message: 'OTP sent successfully'
    };
  }

  /**
   * Verify Scorer OTP and return authenticated session token
   */
  async verifyScorerOtp(email, otp) {
    if (!email || !otp) {
      throw { status: 400, message: 'Email address and OTP code are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    await db.initDb();
    let user = await userModel.findByEmail(cleanEmail);
    if (!user) {
      const s = await scorerModel.findByEmail(cleanEmail);
      if (s) {
        user = {
          id: s.id,
          name: s.full_name,
          email: s.email,
          role: 'SCORER',
          status: s.status,
          otp_hash: s.otp_hash,
          otp_expires_at: s.otp_expires_at,
          otp_attempts: s.otp_attempts || 0
        };
      }
    }

    if (!user) {
      throw { status: 404, message: 'Scorer not found.' };
    }

    if (!user.otp_hash) {
      throw { status: 400, message: 'No active OTP found. Please request an OTP first.' };
    }

    const isExpired = user.otp_expires_at && new Date() > new Date(user.otp_expires_at);
    if (isExpired) {
      await userModel.clearOtp(user.id || cleanEmail);
      try { await scorerModel.clearOtp(user.id || cleanEmail); } catch (e) { }
      throw { status: 400, message: 'OTP has expired. Please request a new OTP.' };
    }

    const isOtpValid = otpService.verifyOtpCode(cleanOtp, user.otp_hash);
    if (!isOtpValid) {
      try {
        const User = db.models.User;
        await User.updateOne({ email: cleanEmail }, { $inc: { otp_attempts: 1 } });
        await scorerModel.incrementOtpAttempts(user.id || cleanEmail);
      } catch (e) { }
      throw { status: 400, message: 'Invalid OTP code. Please enter the correct code.' };
    }

    await userModel.clearOtp(user.id || cleanEmail);
    try { await scorerModel.clearOtp(user.id || cleanEmail); } catch (e) { }

    const certLevel = user.certificationLevel || user.scorer_details?.certification_level || 'District Certified';

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: 'SCORER', certificationLevel: certLevel },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      success: true,
      message: 'Scorer authenticated successfully.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'SCORER',
        certificationLevel: certLevel,
        scorer_details: user.scorer_details
      },
      token
    };
  }

  /**
   * Get all pending scorer applications
   */
  /**
   * Register Scorer
   */
  async registerScorer({ name, full_name, email, password, mobile, phone, aadhaar, aadhaarNumber, taluk, certificationLevel, pin, association }) {
    const scorerName = (name || full_name || '').trim();
    if (!scorerName) {
      throw { status: 400, message: 'Scorer name is required.' };
    }
    if (!email || !email.trim()) {
      throw { status: 400, message: 'Scorer email is required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = String(mobile || phone || '').replace(/\D/g, '');
    const cleanAadhaar = String(aadhaar || aadhaarNumber || '').replace(/\D/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw { status: 400, message: 'Invalid email address format.' };
    }

    await db.initDb();

    // Check duplicate email in MySQL / MongoDB
    const existingUser = await userModel.findByEmail(cleanEmail);
    const existingScorer = await scorerModel.findByEmail(cleanEmail);

    let passwordHash = (password || pin) ? String(password || pin).trim() : null;
    if (passwordHash) {
      try {
        const bcrypt = require('bcryptjs');
        passwordHash = await bcrypt.hash(passwordHash, 10);
      } catch (_e) { }
    }

    const ADMIN_OR_DEV_EMAILS = [
      'admin@example.com',
      'admin@cfvd.org',
      'cricketfederation21@gmail.com',
      'athilingam3336@gmail.com',
      'ponramanan21@gmail.com',
      'ramana.twone@gmail.com'
    ];
    const isAutoApproved = ADMIN_OR_DEV_EMAILS.includes(cleanEmail) || existingUser?.role === 'ADMIN';
    const targetStatus = isAutoApproved ? 'ACTIVE' : 'PENDING';

    // Case 1: Account already exists
    if (existingUser || existingScorer) {
      // If already a registered Scorer
      if (existingScorer || existingUser?.role === 'SCORER') {
        const currentStatus = (existingUser?.status || existingScorer?.status || '').toUpperCase();
        if (currentStatus === 'REJECTED') {
          throw { status: 409, message: 'An application with this email address was previously REJECTED by the administrator.' };
        }
        if (currentStatus === 'PENDING') {
          // Allow re-updating password/phone while pending
          if (passwordHash) {
            await db.models.User.updateOne(
              { email: cleanEmail },
              { $set: { password_hash: passwordHash, name: scorerName, mobile: mobile || undefined } }
            );
          }
          return {
            success: true,
            status: 'PENDING',
            message: 'A registration application with this email address has already been submitted and is currently PENDING admin review.',
            scorer: existingUser || existingScorer
          };
        }
        // If already ACTIVE / APPROVED, update credentials if provided
        if (passwordHash) {
          await db.models.User.updateOne(
            { email: cleanEmail },
            {
              $set: {
                name: scorerName,
                password_hash: passwordHash,
                mobile: cleanMobile || undefined,
                aadhaar: cleanAadhaar || undefined,
                taluk: taluk || 'Virudhunagar',
                certificationLevel: certificationLevel || 'District Certified',
                'scorer_details.certification_level': certificationLevel || 'District Certified',
                'scorer_details.taluk': taluk || 'Virudhunagar'
              }
            }
          );
          if (existingScorer) {
            await db.models.Scorer.updateOne(
              { email: cleanEmail },
              { $set: { full_name: scorerName, mobile: cleanMobile || existingScorer.mobile, ...(cleanAadhaar && { aadhaar: cleanAadhaar }) } }
            );
          }
          return {
            success: true,
            status: 'ACTIVE',
            message: 'Official Scorer credentials updated successfully! You can now log in directly.',
            scorer: {
              id: existingUser?.id || existingScorer?.id,
              name: scorerName,
              email: cleanEmail,
              status: 'ACTIVE'
            }
          };
        }
        throw { status: 409, message: 'An account with this email address is already registered as an Official Scorer. Please log in directly.' };
      }

      // If existing user has a DIFFERENT role
      const updateData = {
        name: scorerName,
        role: isAutoApproved ? (existingUser.role === 'ADMIN' ? 'ADMIN' : 'SCORER') : 'SCORER',
        status: targetStatus,
        mobile: cleanMobile || existingUser.mobile || null,
        aadhaar: cleanAadhaar || existingUser.aadhaar || null,
        taluk: taluk || 'Virudhunagar',
        certificationLevel: certificationLevel || 'District Certified',
        scoringPin: pin || '1234',
        scorer_details: {
          certification_level: certificationLevel || 'District Certified',
          taluk: taluk || 'Virudhunagar'
        }
      };
      if (passwordHash) {
        updateData.password_hash = passwordHash;
      }

      await db.models.User.updateOne({ email: cleanEmail }, { $set: updateData });

      const scorerId = existingUser.id && existingUser.id.startsWith('SCR-') ? existingUser.id : `SCR-${Math.floor(100 + Math.random() * 900)}`;

      await db.models.Scorer.findOneAndUpdate(
        { email: cleanEmail },
        {
          $set: {
            id: scorerId,
            full_name: scorerName,
            email: cleanEmail,
            mobile: cleanMobile || existingUser.mobile || '',
            aadhaar: cleanAadhaar || '',
            association: association || 'Virudhunagar District Cricket Association',
            certification_level: certificationLevel || 'District Certified',
            taluk: taluk || 'Virudhunagar',
            status: targetStatus === 'ACTIVE' ? 'APPROVED' : 'PENDING'
          }
        },
        { upsert: true, new: true }
      );

      await notificationModel.create({
        type: 'SCORER_REGISTRATION',
        title: `New Scorer Registration: ${scorerName}`,
        message: `Scorer ${scorerName} (${cleanEmail}) — Level: ${certificationLevel || 'District Certified'}, Taluk: ${taluk || 'Virudhunagar'} — submitted registration. Status: ${targetStatus}.`,
        reference_id: scorerId,
        status: 'UNREAD'
      });

      return {
        success: true,
        status: targetStatus,
        message: targetStatus === 'ACTIVE'
          ? `Welcome ${scorerName}! Your Official Scorer account is active. You can log in directly.`
          : 'Scorer registration submitted! Your account is PENDING admin verification and approval.',
        scorer: {
          id: existingUser.id,
          name: scorerName,
          email: cleanEmail,
          taluk: taluk || 'Virudhunagar',
          certificationLevel: certificationLevel || 'District Certified',
          status: targetStatus
        }
      };
    }

    const userId = `SCR-${Math.floor(100 + Math.random() * 900)}`;
    const user = await userModel.create({
      id: userId,
      name: scorerName,
      email: cleanEmail,
      mobile: cleanMobile || null,
      aadhaar: cleanAadhaar || null,
      password_hash: passwordHash,
      current_password: pin || '1234',
      role: 'SCORER',
      status: 'PENDING',
      taluk: taluk || 'Virudhunagar',
      certificationLevel: certificationLevel || 'District Certified',
      scoringPin: pin || '1234',
      scorer_details: {
        certification_level: certificationLevel || 'District Certified',
        taluk: taluk || 'Virudhunagar'
      }
    });

    try {
      await scorerModel.create({
        id: userId,
        full_name: scorerName,
        email: cleanEmail,
        mobile: cleanMobile || '',
        aadhaar: cleanAadhaar || '',
        association: association || 'Virudhunagar District Cricket Association',
        status: 'PENDING'
      });
    } catch (e) { }

    await notificationModel.create({
      type: 'SCORER_REGISTRATION',
      title: `New Scorer Registration: ${scorerName}`,
      message: `Scorer ${scorerName} (${cleanEmail}) — Level: ${certificationLevel || 'District Certified'}, Taluk: ${taluk || 'Virudhunagar'} — submitted registration. Status: PENDING admin approval.`,
      reference_id: userId,
      status: 'UNREAD'
    });

    return {
      success: true,
      status: 'PENDING',
      message: 'Scorer registration submitted! Your account is PENDING admin verification and approval.',
      scorer: {
        id: user.id,
        name: user.name,
        email: user.email,
        taluk: taluk || 'Virudhunagar',
        certificationLevel: certificationLevel || 'District Certified',
        status: 'PENDING'
      }
    };
  }

  async getPendingScorers() {
    await db.initDb();
    return scorerModel.getPendingScorers();
  }

  /**
   * Admin approves a scorer registration
   */
  async approveScorer(scorerId) {
    await db.initDb();
    const scorer = await scorerModel.approve(scorerId);
    await userModel.updateStatus(scorerId, 'APPROVED');
    return {
      success: true,
      message: 'Scorer approved successfully.',
      scorer: scorer || { id: scorerId, status: 'APPROVED', approved_at: new Date() }
    };
  }

  /**
   * Admin rejects a scorer registration
   */
  async rejectScorer(scorerId, reason = 'Criteria not met') {
    await db.initDb();
    const scorer = await scorerModel.reject(scorerId, reason);
    await userModel.updateStatus(scorerId, 'REJECTED');
    return {
      success: true,
      message: 'Scorer rejected.',
      scorer: scorer || { id: scorerId, status: 'REJECTED', rejected_at: new Date(), rejection_reason: reason }
    };
  }

  /**
   * Get all registered scorers
   */
  async getScorers(status = null) {
    return userModel.getScorers(status);
  }

  /**
   * Update scorer status
   */
  async updateScorerStatus(idOrEmail, newStatus, reason = null) {
    const normalizedStatus = String(newStatus).toUpperCase();
    const clean = String(idOrEmail || '').trim();
    let user = await userModel.findById(clean);
    if (!user) user = await userModel.findByEmail(clean);
    if (!user) {
      if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'APPROVED') {
        user = await userModel.create({
          id: clean.startsWith('SC') || clean.startsWith('OFF') ? clean : `SCR-${Math.floor(100 + Math.random() * 900)}`,
          name: clean.includes('@') ? clean.split('@')[0] : 'Official Scorer',
          email: clean.toLowerCase(),
          role: 'SCORER',
          status: 'ACTIVE'
        });
      } else {
        throw { status: 404, message: `Scorer '${idOrEmail}' not found.` };
      }
    } else {
      await userModel.updateStatus(user.id, normalizedStatus);
    }

    const updated = await userModel.findById(user.id);
    return {
      success: true,
      message: `Scorer ${user.name} status updated to ${normalizedStatus}`,
      scorer: updated
    };
  }
}

module.exports = new ScorerAuth();
