/**
 * services/auth/passwordResetAuth.js
 * Handles OTP issuance, verification, and password reset flows for all roles.
 */

const userModel = require('../../models/userModel');
const teamRegistrationModel = require('../../models/teamRegistrationModel');
const scorerModel = require('../../models/scorerModel');
const otpService = require('../otpService');
const { sendOtpEmail } = require('../../config/mailer');
const db = require('../../config/db');

// In-memory registration OTP cache: email -> { otp, hash, expiresAt, name, role, verified }
const registrationOtpMap = new Map();

// In-memory password reset OTP cache: email -> { otp, hash, expiresAt, name, role, verified }
const forgotPasswordOtpMap = new Map();

class PasswordResetAuth {
  getRegistrationOtpMap() {
    return registrationOtpMap;
  }

  getForgotPasswordOtpMap() {
    return forgotPasswordOtpMap;
  }

  /**
   * Send 6-digit OTP to verify email during Registration (Player, Team, Scorer)
   */
  async requestRegistrationOtp(email, name, role, teamName, checkRegistrationExistsFn) {
    if (!email || typeof email !== 'string') {
      throw { status: 400, message: 'Please provide a valid email address.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw { status: 400, message: 'Invalid email address format.' };
    }

    await db.initDb();

    if (checkRegistrationExistsFn) {
      const check = await checkRegistrationExistsFn({ role, email: cleanEmail, name, teamName });
      if (check && check.exists) {
        throw {
          status: 409,
          message: check.message || `An account with email "${cleanEmail}" is already registered. Please log in directly.`
        };
      }
    }

    const rawOtp = otpService.generateOtpCode();
    const otpHash = otpService.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    registrationOtpMap.set(cleanEmail, {
      hash: otpHash,
      expiresAt,
      name: name || 'Applicant',
      role: role || 'USER',
      verified: false
    });

    const emailResult = await sendOtpEmail({
      toEmail: cleanEmail,
      userName: name || 'Applicant',
      otp: rawOtp,
      priority: 'OTP'
    });
    const env = require('../../config/env');
    if (emailResult && emailResult.quotaExceeded) {
      throw { status: 429, message: 'OTP service is busy, please try again later' };
    }
    if ((!emailResult || emailResult.success === false) && !env.isDevelopment) {
      throw {
        status: 502,
        message: emailResult?.error || 'Unable to send verification OTP email right now. Please check email provider settings or try again.'
      };
    }

    return {
      success: true,
      message: `Verification code sent to ${cleanEmail}. Please enter the 6-digit OTP code sent to your email.`,
      email: cleanEmail,
      ...(env.isDevelopment ? { otp: rawOtp } : {})
    };
  }

  /**
   * Verify the 6-digit OTP entered during Registration
   */
  async verifyRegistrationOtp(email, otp) {
    if (!email || !otp) {
      throw { status: 400, message: 'Email address and OTP code are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const record = registrationOtpMap.get(cleanEmail);

    if (!record) {
      throw {
        status: 400,
        message: 'No OTP requested for this email or OTP has expired. Please click Send Code again.'
      };
    }

    if (new Date() > new Date(record.expiresAt)) {
      registrationOtpMap.delete(cleanEmail);
      throw { status: 400, message: 'Verification code has expired. Please request a new code.' };
    }

    record.attempts = (record.attempts || 0) + 1;
    if (record.attempts > 5) {
      registrationOtpMap.delete(cleanEmail);
      throw { status: 429, message: 'Too many invalid OTP attempts. Please request a new code.' };
    }

    const isMatch = otpService.verifyOtpCode(cleanOtp, record.hash);
    if (!isMatch) {
      if (record.attempts >= 5) registrationOtpMap.delete(cleanEmail);
      throw { status: 400, message: 'Invalid verification code. Please check your email and try again.' };
    }

    record.verified = true;

    return {
      success: true,
      message: '✓ Email verified successfully! You may now set your password below.',
      email: cleanEmail
    };
  }

  /**
   * Step 1: Send 4-digit OTP to user's email for Password Reset (All Roles: Player, Coach, Scorer, Umpire, Admin)
   */
  async requestForgotPasswordOtp(email, role) {
    if (!email || typeof email !== 'string') {
      throw { status: 400, message: 'Please provide a valid email address.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw { status: 400, message: 'Invalid email address format.' };
    }

    await db.initDb();

    // 1. Look for account across Users, TeamRegistrations, Scorers, Admins
    let user = await userModel.findByEmail(cleanEmail);

    if (!user) {
      user = await db.models.User.findOne({ email: cleanEmail }).lean();
    }

    if (!user) {
      const teamReg = await teamRegistrationModel.findByCoachEmail(cleanEmail);
      if (teamReg) {
        user = {
          id: teamReg.id,
          name: teamReg.coach_name || teamReg.team_name,
          email: teamReg.coach_email,
          role: 'COACH',
          status: teamReg.status
        };
      }
    }

    if (!user) {
      const s = await scorerModel.findByEmail(cleanEmail);
      if (s) {
        user = {
          id: s.id,
          name: s.full_name,
          email: s.email,
          role: 'SCORER',
          status: s.status
        };
      }
    }

    if (!user) {
      return {
        success: true,
        message: 'If an eligible account exists for this email, a verification code has been dispatched.',
        email: cleanEmail
      };
    }

    if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
      throw {
        status: 403,
        message: `This account has been ${user.status.toLowerCase()} by the administrator.`
      };
    }

    // 2. Generate 4-digit OTP
    const rawOtp = otpService.generate4DigitOtpCode();
    const otpHash = otpService.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    forgotPasswordOtpMap.set(cleanEmail, {
      hash: otpHash,
      expiresAt,
      name: user.name || 'Member',
      role: user.role || role || 'USER',
      verified: false
    });

    try {
      await userModel.updateOtp(cleanEmail, {
        otp_hash: otpHash,
        otp_expires_at: expiresAt,
        otp_attempts: 0
      });
    } catch (_e) { }

    const emailResult = await sendOtpEmail({
      toEmail: cleanEmail,
      userName: user.name || 'Member',
      otp: rawOtp,
      priority: 'PASSWORD_RESET'
    });
    const env = require('../../config/env');
    if (emailResult && emailResult.quotaExceeded) {
      throw { status: 429, message: 'OTP service is busy, please try again later' };
    }
    if ((!emailResult || emailResult.success === false) && !env.isDevelopment) {
      throw {
        status: 502,
        message: emailResult?.error || 'Unable to send verification OTP email right now. Please check email provider settings or try again.'
      };
    }

    return {
      success: true,
      message: 'If an eligible account exists for this email, a verification code has been dispatched.',
      email: cleanEmail,
      ...(env.isDevelopment ? { otp: rawOtp } : {})
    };
  }

  /**
   * Step 2: Verify 4-digit OTP for Password Reset
   */
  async verifyForgotPasswordOtp(email, otp) {
    if (!email || !otp) {
      throw { status: 400, message: 'Email address and 4-digit OTP code are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const record = forgotPasswordOtpMap.get(cleanEmail);

    await db.initDb();
    const dbUser = await userModel.findByEmail(cleanEmail);

    let isMatch = false;

    if (record) {
      if (new Date() > new Date(record.expiresAt)) {
        forgotPasswordOtpMap.delete(cleanEmail);
        throw { status: 400, message: 'Verification code has expired. Please request a new code.' };
      }
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > 5) {
        forgotPasswordOtpMap.delete(cleanEmail);
        throw { status: 429, message: 'Too many invalid OTP attempts. Please request a new code.' };
      }
      isMatch = otpService.verifyOtpCode(cleanOtp, record.hash);
      if (!isMatch && record.attempts >= 5) {
        forgotPasswordOtpMap.delete(cleanEmail);
      }
    } else if (dbUser && dbUser.otp_hash) {
      const attempts = Number(dbUser.otp_attempts || 0);
      if (attempts >= 5) {
        await db.models.User.updateOne({ email: cleanEmail }, { $set: { otp_hash: null, otp_expires_at: null } });
        throw { status: 429, message: 'Too many invalid OTP attempts. Please request a new code.' };
      }
      const notExpired = dbUser.otp_expires_at && new Date() < new Date(dbUser.otp_expires_at);
      if (!notExpired) {
        throw { status: 400, message: 'Verification code has expired. Please request a new code.' };
      }
      isMatch = otpService.verifyOtpCode(cleanOtp, dbUser.otp_hash);
      if (!isMatch) {
        const nextAttempts = attempts + 1;
        await db.models.User.updateOne(
          { email: cleanEmail },
          { $set: nextAttempts >= 5 ? { otp_attempts: nextAttempts, otp_hash: null, otp_expires_at: null } : { otp_attempts: nextAttempts } }
        );
      }
    }

    if (!isMatch) {
      throw { status: 400, message: 'Invalid or expired OTP code.' };
    }

    if (record) {
      record.verified = true;
    } else {
      forgotPasswordOtpMap.set(cleanEmail, {
        hash: otpService.hashOtp(cleanOtp),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        verified: true
      });
    }

    return {
      success: true,
      message: 'OTP verified successfully! You can configure your new password.',
      email: cleanEmail
    };
  }

  /**
   * Step 3: Encrypt and store new password in Database
   */
  async resetPasswordWithOtp(email, otp, newPassword) {
    if (!email || !newPassword) {
      throw { status: 400, message: 'Email and new password are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = String(newPassword).trim();

    if (cleanPass.length < 8) {
      throw { status: 400, message: 'New password must be at least 8 characters.' };
    }

    const cleanOtp = String(otp || '').trim();
    const record = forgotPasswordOtpMap.get(cleanEmail);

    await db.initDb();
    const dbUser = await userModel.findByEmail(cleanEmail);

    let isMatch = false;
    if (record && record.verified && new Date() <= new Date(record.expiresAt)) {
      isMatch = true;
    } else if (record && new Date() <= new Date(record.expiresAt)) {
      isMatch = otpService.verifyOtpCode(cleanOtp, record.hash);
    } else if (dbUser && dbUser.otp_hash && dbUser.otp_expires_at && new Date() < new Date(dbUser.otp_expires_at)) {
      isMatch = otpService.verifyOtpCode(cleanOtp, dbUser.otp_hash);
    }

    if (!isMatch) {
      throw { status: 400, message: 'Invalid or unverified OTP. Please verify OTP first.' };
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(cleanPass, 12);

    let updated = false;

    // 1. Update in User collection (bump token_version to invalidate existing sessions)
    if (dbUser) {
      await userModel.update(dbUser.id || dbUser._id, {
        password_hash: passwordHash,
        otp_hash: null,
        otp_expires_at: null,
        otp_attempts: 0,
        token_version: Number(dbUser.token_version || 0) + 1
      });
      updated = true;
    }

    // 2. Also update in TeamRegistration if exists
    try {
      const teamRes = await db.models.TeamRegistration.updateOne(
        { coach_email: cleanEmail },
        {
          $set: { password_hash: passwordHash },
          $unset: { current_password: '', passkey: '' }
        }
      );
      if (teamRes.modifiedCount > 0) updated = true;
    } catch (_e) { }

    // 3. Also update in Scorer collection if exists
    try {
      const scorerRes = await db.models.Scorer.updateOne(
        { email: cleanEmail },
        {
          $set: { password_hash: passwordHash },
          $unset: { current_password: '' }
        }
      );
      if (scorerRes.modifiedCount > 0) updated = true;
    } catch (_e) { }

    // Single-use: remove from in-memory cache immediately
    forgotPasswordOtpMap.delete(cleanEmail);

    return {
      success: true,
      message: '✓ Password reset successfully! You can now log in with your new password.',
      email: cleanEmail
    };
  }
}

module.exports = new PasswordResetAuth();

