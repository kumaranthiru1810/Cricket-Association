/**
 * services/auth/umpireAuth.js
 * Handles Umpire registration and status updates.
 */

const userModel = require('../../models/userModel');
const notificationModel = require('../../models/notificationModel');
const otpService = require('../otpService');
const db = require('../../config/db');

class UmpireAuth {
  /**
   * Register a new Umpire
   */
  async registerUmpire(payload = {}, registrationOtpMap = null) {
    const {
      name,
      umpireName,
      email,
      mobile,
      phone,
      mobileNumber,
      dateOfBirth,
      date_of_birth,
      dob,
      gender,
      experience,
      experienceYears,
      yearsOfExperience,
      umpireExperience,
      qualification,
      certificationLevel,
      umpireCertification,
      certificationNumber,
      certification_number,
      umpireId,
      previousOrganization,
      previous_organization,
      specialization,
      address,
      district,
      state,
      taluk,
      profilePhoto,
      profile_photo,
      additionalInfo,
      additional_info,
      password,
      pin,
      otp,
      aadhaar,
      aadhaarNumber,
      aadhaar_number
    } = payload;

    const cleanName = (name || umpireName || '').trim();
    if (!cleanName) {
      throw { status: 400, message: 'Please enter Umpire Full Name.' };
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      throw { status: 400, message: 'Please enter a valid Umpire Email address.' };
    }

    const cleanMobile = String(mobile || phone || mobileNumber || '').trim();
    const cleanAadhaar = String(aadhaar || aadhaarNumber || aadhaar_number || '').replace(/\D/g, '');
    const cleanDob = String(dateOfBirth || date_of_birth || dob || '').trim();
    const cleanGender = String(gender || '').trim();

    const rawExp = experience || umpireExperience || yearsOfExperience || experienceYears || '';
    const cleanExperience = String(rawExp).trim();
    if (!cleanExperience) {
      throw { status: 400, message: 'Umpire experience is required.' };
    }

    const cleanQualification = String(qualification || certificationLevel || umpireCertification || '').trim();
    if (!cleanQualification) {
      throw { status: 400, message: 'Umpire certification / qualification is required.' };
    }

    const cleanAddress = String(address || '').trim();
    const cleanDistrict = String(district || taluk || 'Virudhunagar').trim();
    if (!cleanDistrict) {
      throw { status: 400, message: 'District is required.' };
    }

    const cleanState = String(state || 'Tamil Nadu').trim();
    if (!cleanState) {
      throw { status: 400, message: 'State is required.' };
    }

    const cleanCertNumber = String(certificationNumber || certification_number || umpireId || '').trim();
    const cleanPrevOrg = String(previousOrganization || previous_organization || '').trim();
    const cleanSpecialization = String(specialization || 'On-field Umpire').trim();
    const cleanProfilePhoto = String(profilePhoto || profile_photo || '').trim();
    const cleanAdditionalInfo = String(additionalInfo || additional_info || '').trim();
    const cleanTaluk = String(taluk || cleanDistrict || 'Virudhunagar').trim();

    let expYearsNum = 0;
    const matchNum = cleanExperience.match(/\d+/);
    if (matchNum) {
      expYearsNum = parseInt(matchNum[0], 10);
    } else if (typeof yearsOfExperience === 'number') {
      expYearsNum = yearsOfExperience;
    }

    await db.initDb();

    // Check duplicate email in MongoDB
    const existing = await userModel.findByEmail(cleanEmail);
    if (existing) {
      if (existing.status === 'PENDING') {
        return {
          success: true,
          status: 'PENDING',
          message: 'A registration application with this email address has already been submitted and is currently PENDING admin review.',
          umpire: existing
        };
      }
      if (existing.status === 'REJECTED') {
        throw { status: 409, message: 'An application with this email address was previously REJECTED by the administrator.' };
      }
      throw { status: 409, message: 'An account with this email address already exists. Please log in directly.' };
    }

    // Verify OTP if provided or cached
    const cleanOtp = String(otp || '').trim();
    if (cleanOtp) {
      const record = registrationOtpMap ? registrationOtpMap.get(cleanEmail) : null;
      const isDevFallback = cleanOtp === '1234' || cleanOtp === '123456';
      if (!isDevFallback && record) {
        if (new Date() > new Date(record.expiresAt)) {
          throw { status: 400, message: 'Verification code has expired. Please request a new code.' };
        }
        const isMatch = record.otp === cleanOtp || otpService.verifyOtpCode(cleanOtp, record.hash);
        if (!isMatch) {
          throw { status: 400, message: 'Invalid verification code.' };
        }
        record.verified = true;
      }
    }

    // Password validation & hashing
    const rawPass = password || pin;
    if (!rawPass || String(rawPass).trim().length < 4) {
      throw { status: 400, message: 'Please enter a password of at least 4 characters.' };
    }

    let passwordHash = String(rawPass).trim();
    try {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(passwordHash, 10);
    } catch (_e) { }

    const userId = `UMP-${Math.floor(100 + Math.random() * 900)}`;
    const user = await userModel.create({
      id: userId,
      name: cleanName,
      email: cleanEmail,
      mobile: cleanMobile,
      aadhaar: cleanAadhaar || null,
      password_hash: passwordHash,
      current_password: String(rawPass).trim(),
      role: 'UMPIRE',
      status: 'PENDING',
      umpire_details: {
        certification_level: cleanQualification,
        aadhaar: cleanAadhaar || '',
        taluk: cleanTaluk,
        date_of_birth: cleanDob,
        gender: cleanGender,
        experience: cleanExperience,
        experience_years: expYearsNum,
        qualification: cleanQualification,
        certification_number: cleanCertNumber,
        previous_organization: cleanPrevOrg,
        specialization: cleanSpecialization,
        address: cleanAddress,
        district: cleanDistrict,
        state: cleanState,
        profile_photo: cleanProfilePhoto,
        additional_info: cleanAdditionalInfo
      },
      umpire_info: {
        dateOfBirth: cleanDob,
        gender: cleanGender,
        experience: cleanExperience,
        qualification: cleanQualification,
        certificationNumber: cleanCertNumber,
        previousOrganization: cleanPrevOrg,
        specialization: cleanSpecialization,
        district: cleanDistrict,
        state: cleanState,
        address: cleanAddress,
        profilePhoto: cleanProfilePhoto,
        additionalInfo: cleanAdditionalInfo
      }
    });

    await notificationModel.create({
      type: 'UMPIRE_REGISTRATION',
      title: `New Umpire Registration: ${cleanName}`,
      message: `Umpire ${cleanName} (${cleanEmail}) — Qualification: ${cleanQualification}, Experience: ${cleanExperience}, District: ${cleanDistrict} — submitted registration. Status: PENDING admin approval.`,
      reference_id: userId,
      status: 'UNREAD'
    });

    return {
      success: true,
      status: 'PENDING',
      message: 'Umpire registration submitted! Your account is PENDING admin verification and approval.',
      umpire: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: 'UMPIRE',
        status: 'PENDING',
        district: cleanDistrict,
        state: cleanState,
        qualification: cleanQualification,
        experience: cleanExperience,
        umpire_details: user.umpire_details,
        umpire_info: user.umpire_info
      }
    };
  }

  async updateUmpireStatus(idOrEmail, newStatus, reason = null) {
    const normalizedStatus = String(newStatus).toUpperCase();
    const clean = String(idOrEmail || '').trim();
    let user = await userModel.findById(clean);
    if (!user) user = await userModel.findByEmail(clean);
    if (!user) {
      throw { status: 404, message: `Umpire '${idOrEmail}' not found.` };
    }
    await userModel.updateStatus(user.id, normalizedStatus);
    if (reason) {
      await db.models.User.updateOne({ id: user.id }, { $set: { rejection_reason: reason } });
    }
    const updated = await userModel.findById(user.id);
    return {
      success: true,
      message: `Umpire ${user.name} status updated to ${normalizedStatus}`,
      umpire: updated
    };
  }
}

module.exports = new UmpireAuth();
