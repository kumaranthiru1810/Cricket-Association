/**
 * services/adminAccessService.js
 * 
 * High-Security Dual-Admin Approval Protocol Service.
 * Implements:
 * 1. SUPER_ADMIN / ADMIN Role System.
 * 2. Simultaneous Dual-Admin OTP verification (HMAC-SHA256, constant-time comparison).
 * 3. Atomic single-document role elevation and revocation updating ONLY target user.
 * 4. Token version incrementing (target signed out immediately, others unaffected).
 * 5. Minimum 3 active administrators threshold for removal.
 * 6. Audit logging for all actions.
 */

const crypto = require('crypto');
const db = require('../config/db');
const {
  sendDualAdminApprovalEmail,
  sendCandidateVerificationEmail
} = require('../config/mailer');

const OTP_SECRET = process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET || 'cricket_dual_admin_hmac_secret_2026';

function generate6DigitOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(code) {
  return crypto.createHmac('sha256', OTP_SECRET).update(String(code).trim()).digest('hex');
}

function verifyConstantTime(rawCode, storedHash) {
  if (!rawCode || !storedHash) return false;
  const candidateHash = hashOtp(rawCode);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'admin@cfvd.org';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

async function writeAudit({ action, initiatedBy, targetUser, result, details, ip, requestId, approvers }) {
  try {
    await db.initDb();
    await db.models.AuditLog.create({
      id: `AUDIT-ACCESS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      action,
      initiated_by: initiatedBy || 'SYSTEM',
      target_user: targetUser || 'N/A',
      result: result || 'SUCCESS',
      details: typeof details === 'string' ? details : JSON.stringify({ details, requestId, approvers }),
      ip_address: ip || '127.0.0.1',
      timestamp: new Date()
    });
  } catch (err) {
    console.warn('[AdminAccess] Audit log error:', err.message);
  }
}

class AdminAccessService {
  /**
   * 1. Get active administrators list with count and min_required: 3
   */
  async getActiveAdmins(currentUserId) {
    await db.initDb();
    const admins = await db.models.User.find({
      $or: [
        { role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
        { is_super_admin: true }
      ],
      status: 'ACTIVE'
    }).sort({ is_super_admin: -1, created_at: 1 }).lean();

    const normalizedCurrent = (currentUserId || '').toLowerCase().trim();

    const mapped = admins.map(a => {
      const isCurrent = (a.id && a.id.toLowerCase() === normalizedCurrent) ||
        (a.email && a.email.toLowerCase() === normalizedCurrent);
      return {
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.is_super_admin ? 'SUPER_ADMIN' : a.role,
        is_super_admin: a.is_super_admin || a.role === 'SUPER_ADMIN',
        is_current_user: isCurrent,
        created_at: a.created_at
      };
    });

    return {
      success: true,
      admins: mapped,
      active_count: mapped.length,
      min_required: 3
    };
  }

  /**
   * 2. Search for registered candidates by email
   */
  async searchCandidate(email) {
    if (!email || typeof email !== 'string') {
      throw { status: 400, message: 'Valid candidate email is required.' };
    }
    const cleanEmail = email.toLowerCase().trim();
    await db.initDb();

    const user = await db.models.User.findOne({ email: cleanEmail }).lean();
    if (!user) {
      return {
        found: false,
        message: `No registered account found with email "${cleanEmail}". Candidates must have an existing account before administrator promotion.`
      };
    }

    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return {
        found: true,
        is_admin: true,
        message: `User "${user.name}" (${cleanEmail}) is already an active ${user.role}.`
      };
    }

    return {
      found: true,
      is_admin: false,
      candidate: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    };
  }

  /**
   * 3. Request Administrator Promotion (Step 1 -> generates Dual-Admin OTPs)
   */
  async requestPromote({ email, name, requestedBy, ip }) {
    if (!email || typeof email !== 'string') {
      throw { status: 400, message: 'Candidate email address is required.' };
    }
    const cleanEmail = email.toLowerCase().trim();
    await db.initDb();

    // Verify candidate exists
    const candidate = await db.models.User.findOne({ email: cleanEmail });
    if (!candidate) {
      throw {
        status: 404,
        message: `Candidate with email "${cleanEmail}" was not found. The user must register an account first.`
      };
    }

    if (candidate.role === 'ADMIN' || candidate.role === 'SUPER_ADMIN') {
      throw { status: 400, message: `Account "${cleanEmail}" already holds administrative privileges.` };
    }

    // Check for existing open request
    const openReq = await db.models.AdminRequest.findOne({
      target_user_id: candidate.id,
      status: { $in: ['PENDING', 'APPROVED', 'EXECUTING'] }
    });
    if (openReq) {
      throw {
        status: 409,
        message: `An active approval request (${openReq.id}) is already in progress for this user.`
      };
    }

    // Select 2 approvers from existing active admins
    const requesterId = String(requestedBy?.id || '').toLowerCase();
    const requesterEmail = String(requestedBy?.email || '').toLowerCase();

    const potentialApprovers = await db.models.User.find({
      $or: [
        { role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
        { is_super_admin: true }
      ],
      status: 'ACTIVE',
      id: { $ne: requestedBy?.id },
      email: { $ne: requesterEmail }
    }).lean();

    let approver1, approver2;
    if (potentialApprovers.length >= 2) {
      approver1 = potentialApprovers[0];
      approver2 = potentialApprovers[1];
    } else if (potentialApprovers.length === 1) {
      approver1 = potentialApprovers[0];
      approver2 = { id: requestedBy?.id || 'admin', name: requestedBy?.name || 'Administrator', email: requestedBy?.email || 'admin@cfvd.org' };
    } else {
      // Bootstrapping: If only 1 administrator exists in system, issue 2 independent dual-auth codes to the chief administrator
      approver1 = { id: requestedBy?.id || 'admin-1', name: requestedBy?.name || 'Chief Administrator', email: requestedBy?.email || 'admin@cfvd.org' };
      approver2 = { id: (requestedBy?.id || 'admin') + '-auth2', name: 'Super Administrator', email: requestedBy?.email || 'admin@cfvd.org' };
    }

    const requestId = `REQ-PROMOTE-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const otp1 = generate6DigitOtp();
    const otp2 = generate6DigitOtp();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const adminRequest = await db.models.AdminRequest.create({
      id: requestId,
      type: 'PROMOTE',
      target_user_id: candidate.id,
      target_email: cleanEmail,
      target_name: name ? name.trim() : candidate.name,
      requested_by_id: requestedBy.id,
      requested_by_email: requestedBy.email,
      approver1_id: approver1.id,
      approver1_email: approver1.email,
      approver2_id: approver2.id,
      approver2_email: approver2.email,
      approver1_otp_hash: hashOtp(otp1),
      approver2_otp_hash: hashOtp(otp2),
      approver1_verified: false,
      approver2_verified: false,
      candidate_verified: false,
      attempts: 0,
      resend_count: 0,
      status: 'PENDING',
      expires_at: expiresAt,
      ip_address: ip || '127.0.0.1'
    });

    // Send emails to Approver 1 and Approver 2
    await Promise.all([
      sendDualAdminApprovalEmail({
        toEmail: approver1.email,
        approverName: approver1.name,
        actionType: 'PROMOTE',
        candidateEmail: cleanEmail,
        targetName: adminRequest.target_name,
        requestedByEmail: requestedBy.email,
        otp: otp1
      }),
      sendDualAdminApprovalEmail({
        toEmail: approver2.email,
        approverName: approver2.name,
        actionType: 'PROMOTE',
        candidateEmail: cleanEmail,
        targetName: adminRequest.target_name,
        requestedByEmail: requestedBy.email,
        otp: otp2
      })
    ]);

    await writeAudit({
      action: 'DUAL_ADMIN_PROMOTE_REQUESTED',
      initiatedBy: requestedBy.email,
      targetUser: cleanEmail,
      result: 'PENDING_APPROVAL',
      details: `Dual-Admin promotion requested for ${cleanEmail}. Approvers: ${approver1.email}, ${approver2.email}`,
      ip,
      requestId,
      approvers: [approver1.email, approver2.email]
    });

    return {
      success: true,
      requestId,
      expiresAt,
      approvers: [
        { id: approver1.id, maskedEmail: maskEmail(approver1.email), email: approver1.email },
        { id: approver2.id, maskedEmail: maskEmail(approver2.email), email: approver2.email }
      ],
      message: `Dual-Admin authorization codes dispatched to ${maskEmail(approver1.email)} and ${maskEmail(approver2.email)}. Valid for 10 minutes.`
    };
  }

  /**
   * 4. Verify Dual-Admin OTPs (Step 2)
   */
  async verifyDualOtp({ requestId, otp1, otp2, userId, ip }) {
    if (!requestId || !otp1 || !otp2) {
      throw { status: 400, message: 'Request ID and both 6-digit administrator codes are required.' };
    }

    const cleanOtp1 = String(otp1).trim();
    const cleanOtp2 = String(otp2).trim();

    if (cleanOtp1.length !== 6 || cleanOtp2.length !== 6) {
      throw { status: 400, message: 'Both codes must be exactly 6 digits.' };
    }

    await db.initDb();
    const reqDoc = await db.models.AdminRequest.findOne({ id: requestId });
    if (!reqDoc) {
      throw { status: 404, message: 'Authorization request not found or expired.' };
    }

    if (reqDoc.status === 'LOCKED') {
      throw { status: 423, message: 'Security lockout: Maximum verification attempts exceeded. Request is locked.' };
    }

    if (reqDoc.status !== 'PENDING') {
      throw { status: 400, message: `Request is already in ${reqDoc.status} state. Single-use policy enforced.` };
    }

    if (new Date() > new Date(reqDoc.expires_at)) {
      reqDoc.status = 'EXPIRED';
      await reqDoc.save();
      throw { status: 410, message: 'Authorization session has expired (10-minute limit exceeded). Please request a new authorization.' };
    }

    if (reqDoc.attempts >= 5) {
      reqDoc.status = 'LOCKED';
      await reqDoc.save();
      throw { status: 423, message: 'Maximum 5 attempts reached. Request locked.' };
    }

    // Verify OTP1 and OTP2 using constant-time comparison
    const match1 = verifyConstantTime(cleanOtp1, reqDoc.approver1_otp_hash);
    const match2 = verifyConstantTime(cleanOtp2, reqDoc.approver2_otp_hash);

    if (!match1 || !match2) {
      reqDoc.attempts += 1;
      const remaining = Math.max(0, 5 - reqDoc.attempts);
      if (reqDoc.attempts >= 5) {
        reqDoc.status = 'LOCKED';
      }
      await reqDoc.save();

      await writeAudit({
        action: 'DUAL_ADMIN_VERIFY_FAILED',
        initiatedBy: userId || 'ADMIN',
        targetUser: reqDoc.target_email,
        result: 'FAILED_ATTEMPT',
        details: `Incorrect OTPs entered. Attempts: ${reqDoc.attempts}/5. Locked: ${reqDoc.attempts >= 5}`,
        ip,
        requestId
      });

      if (reqDoc.attempts >= 5) {
        throw { status: 423, message: 'Incorrect authorization code. Security lockout: Maximum 5 verification attempts exceeded.' };
      }
      throw { status: 400, message: `Incorrect verification code. ${remaining} attempt(s) remaining.` };
    }

    // Both codes matched!
    if (reqDoc.type === 'PROMOTE') {
      // Step 2 complete -> move to Step 3: Candidate Verification
      const candidateCode = generate6DigitOtp();
      reqDoc.approver1_verified = true;
      reqDoc.approver2_verified = true;
      reqDoc.status = 'APPROVED';
      reqDoc.candidate_otp_hash = hashOtp(candidateCode);
      reqDoc.attempts = 0; // Reset attempts for candidate step
      await reqDoc.save();

      // Dispatch code to candidate
      await sendCandidateVerificationEmail({
        toEmail: reqDoc.target_email,
        candidateName: reqDoc.target_name,
        otp: candidateCode
      });

      await writeAudit({
        action: 'DUAL_ADMIN_APPROVAL_GRANTED',
        initiatedBy: userId || 'ADMIN',
        targetUser: reqDoc.target_email,
        result: 'DUAL_APPROVED',
        details: `Both admin codes verified. Candidate code dispatched to ${reqDoc.target_email}`,
        ip,
        requestId,
        approvers: [reqDoc.approver1_email, reqDoc.approver2_email]
      });

      return {
        success: true,
        step: 'CANDIDATE_VERIFY',
        candidateEmail: reqDoc.target_email,
        message: `Dual-Admin codes verified! Verification code dispatched to candidate ${reqDoc.target_email} to complete appointment.`
      };
    } else if (reqDoc.type === 'REMOVE') {
      // Step 2 complete -> execute removal atomically
      return this.executeRevocation({ reqDoc, ip, userId });
    }
  }

  /**
   * Alias for verifyDualOtp when used for revocation
   */
  async verifyRemove({ requestId, otp1, otp2, userId, ip }) {
    return this.verifyDualOtp({ requestId, otp1, otp2, userId, ip });
  }

  /**
   * 5. Resend Dual-Admin Codes (cooldown 30s, max 3 resends)
   */
  async resendDualOtp({ requestId, userId, ip }) {
    await db.initDb();
    const reqDoc = await db.models.AdminRequest.findOne({ id: requestId });
    if (!reqDoc) {
      throw { status: 404, message: 'Authorization request not found.' };
    }

    if (reqDoc.status === 'LOCKED' || reqDoc.status === 'COMPLETED' || reqDoc.status === 'REJECTED') {
      throw { status: 400, message: `Cannot resend codes for request in ${reqDoc.status} state.` };
    }

    if (reqDoc.resend_count >= 3) {
      throw { status: 429, message: 'Maximum 3 resends exceeded for this authorization request.' };
    }

    const now = Date.now();
    if (reqDoc.last_resend_at && (now - new Date(reqDoc.last_resend_at).getTime()) < 30000) {
      const waitSec = Math.ceil((30000 - (now - new Date(reqDoc.last_resend_at).getTime())) / 1000);
      throw { status: 429, message: `Please wait ${waitSec}s before requesting new codes.` };
    }

    const otp1 = generate6DigitOtp();
    const otp2 = generate6DigitOtp();

    reqDoc.approver1_otp_hash = hashOtp(otp1);
    reqDoc.approver2_otp_hash = hashOtp(otp2);
    reqDoc.resend_count += 1;
    reqDoc.last_resend_at = new Date();
    reqDoc.attempts = 0; // Invalidate previous attempts
    reqDoc.expires_at = new Date(Date.now() + 10 * 60 * 1000); // Reset 10 minutes
    await reqDoc.save();

    await Promise.all([
      sendDualAdminApprovalEmail({
        toEmail: reqDoc.approver1_email,
        actionType: reqDoc.type,
        candidateEmail: reqDoc.target_email,
        targetName: reqDoc.target_name,
        requestedByEmail: reqDoc.requested_by_email,
        otp: otp1
      }),
      sendDualAdminApprovalEmail({
        toEmail: reqDoc.approver2_email,
        actionType: reqDoc.type,
        candidateEmail: reqDoc.target_email,
        targetName: reqDoc.target_name,
        requestedByEmail: reqDoc.requested_by_email,
        otp: otp2
      })
    ]);

    await writeAudit({
      action: 'DUAL_ADMIN_CODES_RESENT',
      initiatedBy: userId || 'ADMIN',
      targetUser: reqDoc.target_email,
      result: 'CODES_RESENT',
      details: `Codes regenerated. Resend #${reqDoc.resend_count}/3`,
      ip,
      requestId
    });

    return {
      success: true,
      resendCount: reqDoc.resend_count,
      expiresAt: reqDoc.expires_at,
      message: 'Fresh authorization codes have been dispatched to both approving administrators.'
    };
  }

  /**
   * 6. Step 3: Candidate Verification & Execution of Role Promotion
   */
  async verifyCandidateAndGrant({ requestId, code, ip }) {
    if (!requestId || !code) {
      throw { status: 400, message: 'Request ID and candidate verification code are required.' };
    }
    const cleanCode = String(code).trim();
    if (cleanCode.length !== 6) {
      throw { status: 400, message: 'Verification code must be exactly 6 digits.' };
    }

    await db.initDb();
    const reqDoc = await db.models.AdminRequest.findOne({ id: requestId });
    if (!reqDoc) {
      throw { status: 404, message: 'Authorization request not found.' };
    }

    if (reqDoc.type !== 'PROMOTE') {
      throw { status: 400, message: 'Invalid operation type for candidate verification.' };
    }

    if (reqDoc.status !== 'APPROVED') {
      throw { status: 400, message: `Request is in ${reqDoc.status} state. Dual approval must be completed first.` };
    }

    if (new Date() > new Date(reqDoc.expires_at)) {
      reqDoc.status = 'EXPIRED';
      await reqDoc.save();
      throw { status: 410, message: 'Candidate verification code has expired.' };
    }

    // Verify candidate code using constant-time comparison
    const isMatch = verifyConstantTime(cleanCode, reqDoc.candidate_otp_hash);
    if (!isMatch) {
      reqDoc.attempts += 1;
      await reqDoc.save();
      throw { status: 400, message: 'Invalid candidate verification code.' };
    }

    // Atomic execution lock: transition APPROVED -> EXECUTING
    const lockedReq = await db.models.AdminRequest.findOneAndUpdate(
      { id: requestId, status: 'APPROVED' },
      { $set: { status: 'EXECUTING', candidate_verified: true } },
      { returnDocument: 'after' }
    );

    if (!lockedReq) {
      throw { status: 409, message: 'Concurreny conflict: Request is already executing or completed.' };
    }

    // CRITICAL RULE: A ROLE CHANGE AFFECTS ONLY THE TARGET USER BY UNIQUE ID
    const updatedUser = await db.models.User.findOneAndUpdate(
      {
        id: reqDoc.target_user_id,
        role: { $nin: ['ADMIN', 'SUPER_ADMIN'] }
      },
      {
        $set: {
          role: 'ADMIN',
          status: 'ACTIVE',
          admin_level: 'Administrator',
          role_changed_at: new Date(),
          role_changed_by: `DUAL_ADMIN_APPROVAL:${reqDoc.approver1_id},${reqDoc.approver2_id}`
        },
        $inc: { token_version: 1 }
      },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      // Revert request lock if user not modified
      await db.models.AdminRequest.updateOne({ id: requestId }, { $set: { status: 'APPROVED' } });
      throw { status: 500, message: 'Execution aborted: Exactly one target document must be updated.' };
    }

    // Mark completed
    lockedReq.status = 'COMPLETED';
    await lockedReq.save();

    await writeAudit({
      action: 'ADMIN_PROMOTION_COMPLETED',
      initiatedBy: reqDoc.requested_by_email,
      targetUser: updatedUser.email,
      result: 'PROMOTED',
      details: `Candidate ${updatedUser.name} (${updatedUser.email}) successfully promoted to ADMIN. Token version incremented to ${updatedUser.token_version}.`,
      ip,
      requestId,
      approvers: [reqDoc.approver1_email, reqDoc.approver2_email]
    });

    return {
      success: true,
      message: `🎉 Administrator "${updatedUser.name}" (${updatedUser.email}) has been successfully authorized and granted full administrative clearance!`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        token_version: updatedUser.token_version
      }
    };
  }

  /**
   * 7. Request Administrator Removal (Step 1 -> generates Dual-Admin OTPs)
   */
  async requestRemove({ targetAdminId, requestedBy, ip }) {
    if (!targetAdminId) {
      throw { status: 400, message: 'Target administrator ID is required.' };
    }

    await db.initDb();

    // 1. Minimum 3 Active Administrators Rule
    const activeAdmins = await db.models.User.find({
      role: { $in: ['ADMIN', 'SUPER_ADMIN'] },
      status: 'ACTIVE'
    }).lean();

    if (activeAdmins.length < 3) {
      throw {
        status: 400,
        message: `Removal Protection Active: At least 3 active administrators are required to remove an administrator. Found: ${activeAdmins.length}/3 minimum. This ensures 2 other administrators can authorize revocation and at least 2 remain.`
      };
    }

    // 2. Find target admin
    const target = await db.models.User.findOne({
      $or: [{ id: targetAdminId }, { email: String(targetAdminId).toLowerCase() }]
    });

    if (!target) {
      throw { status: 404, message: 'Target administrator not found.' };
    }

    // 3. SUPER_ADMIN cannot be removed or demoted
    if (target.role === 'SUPER_ADMIN' || target.is_super_admin || target.email.toLowerCase() === 'admin@cfvd.org') {
      throw {
        status: 403,
        message: 'Security Violation: The permanent Super Administrator account cannot be removed, demoted, or deactivated.'
      };
    }

    if (target.role !== 'ADMIN') {
      throw { status: 400, message: `Account "${target.email}" is not currently an administrator.` };
    }

    // 4. Requester cannot be target
    if (target.id === requestedBy.id || target.email.toLowerCase() === requestedBy.email.toLowerCase()) {
      throw {
        status: 403,
        message: 'Self-revocation is prohibited: An administrator cannot initiate their own removal.'
      };
    }

    // 5. Select 2 approvers excluding the target (target cannot be one of the approvers)
    const availableApprovers = activeAdmins.filter(a => a.id !== target.id);
    if (availableApprovers.length < 2) {
      throw {
        status: 400,
        message: 'Dual-Admin revocation requires at least 2 other active administrators.'
      };
    }

    const approver1 = availableApprovers[0];
    const approver2 = availableApprovers[1];

    const requestId = `REQ-REMOVE-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const otp1 = generate6DigitOtp();
    const otp2 = generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const adminRequest = await db.models.AdminRequest.create({
      id: requestId,
      type: 'REMOVE',
      target_user_id: target.id,
      target_email: target.email,
      target_name: target.name,
      requested_by_id: requestedBy.id,
      requested_by_email: requestedBy.email,
      approver1_id: approver1.id,
      approver1_email: approver1.email,
      approver2_id: approver2.id,
      approver2_email: approver2.email,
      approver1_otp_hash: hashOtp(otp1),
      approver2_otp_hash: hashOtp(otp2),
      approver1_verified: false,
      approver2_verified: false,
      attempts: 0,
      resend_count: 0,
      status: 'PENDING',
      expires_at: expiresAt,
      ip_address: ip || '127.0.0.1'
    });

    await Promise.all([
      sendDualAdminApprovalEmail({
        toEmail: approver1.email,
        approverName: approver1.name,
        actionType: 'REMOVE',
        candidateEmail: target.email,
        targetName: target.name,
        requestedByEmail: requestedBy.email,
        otp: otp1
      }),
      sendDualAdminApprovalEmail({
        toEmail: approver2.email,
        approverName: approver2.name,
        actionType: 'REMOVE',
        candidateEmail: target.email,
        targetName: target.name,
        requestedByEmail: requestedBy.email,
        otp: otp2
      })
    ]);

    await writeAudit({
      action: 'DUAL_ADMIN_REMOVE_REQUESTED',
      initiatedBy: requestedBy.email,
      targetUser: target.email,
      result: 'PENDING_APPROVAL',
      details: `Revocation requested for administrator ${target.name} (${target.email}). Approvers: ${approver1.email}, ${approver2.email}`,
      ip,
      requestId,
      approvers: [approver1.email, approver2.email]
    });

    return {
      success: true,
      requestId,
      expiresAt,
      approvers: [
        { id: approver1.id, maskedEmail: maskEmail(approver1.email), email: approver1.email },
        { id: approver2.id, maskedEmail: maskEmail(approver2.email), email: approver2.email }
      ],
      message: `Dual-Admin revocation authorization codes dispatched to ${maskEmail(approver1.email)} and ${maskEmail(approver2.email)}. Valid for 10 minutes.`
    };
  }

  /**
   * 8. Execute Revocation after dual OTP verification
   */
  async executeRevocation({ reqDoc, ip, userId }) {
    // Status lock: PENDING -> EXECUTING
    const lockedReq = await db.models.AdminRequest.findOneAndUpdate(
      { id: reqDoc.id, status: 'PENDING' },
      { $set: { status: 'EXECUTING', approver1_verified: true, approver2_verified: true } },
      { returnDocument: 'after' }
    );

    if (!lockedReq) {
      throw { status: 409, message: 'Conflict: Revocation already executing or completed.' };
    }

    // Minimum 3 rule re-check at execution time
    const activeAdmins = await db.models.User.countDocuments({
      role: { $in: ['ADMIN', 'SUPER_ADMIN'] },
      status: 'ACTIVE'
    });
    if (activeAdmins < 3) {
      await db.models.AdminRequest.updateOne({ id: reqDoc.id }, { $set: { status: 'REJECTED' } });
      throw { status: 400, message: 'Execution aborted: Active administrators count dropped below 3 minimum.' };
    }

    // Atomic update on target user by unique ID
    const updatedUser = await db.models.User.findOneAndUpdate(
      { id: reqDoc.target_user_id, role: 'ADMIN' },
      {
        $set: {
          role: 'USER',
          admin_level: 'Standard User',
          role_changed_at: new Date(),
          role_changed_by: `DUAL_ADMIN_REVOCATION:${reqDoc.approver1_id},${reqDoc.approver2_id}`
        },
        $inc: { token_version: 1 }
      },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      await db.models.AdminRequest.updateOne({ id: reqDoc.id }, { $set: { status: 'PENDING' } });
      throw { status: 500, message: 'Execution aborted: Target administrator record was not modified.' };
    }

    lockedReq.status = 'COMPLETED';
    await lockedReq.save();

    await writeAudit({
      action: 'ADMIN_REMOVAL_COMPLETED',
      initiatedBy: userId || reqDoc.requested_by_email,
      targetUser: updatedUser.email,
      result: 'REVOKED',
      details: `Administrator privileges revoked for ${updatedUser.name} (${updatedUser.email}). Role reverted to USER. Token version incremented to ${updatedUser.token_version}.`,
      ip,
      requestId: reqDoc.id,
      approvers: [reqDoc.approver1_email, reqDoc.approver2_email]
    });

    return {
      success: true,
      message: `Administrator "${updatedUser.name}" (${updatedUser.email}) has been successfully reverted to User status. Existing admin sessions for this user have been invalidated.`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        token_version: updatedUser.token_version
      }
    };
  }

  /**
   * 9. Get all requests
   */
  async getRequests() {
    await db.initDb();
    const requests = await db.models.AdminRequest.find({})
      .sort({ created_at: -1 })
      .limit(50)
      .lean();
    return { success: true, requests };
  }

  /**
   * 10. Get audit log for access control actions
   */
  async getAuditLog() {
    await db.initDb();
    const logs = await db.models.AuditLog.find({
      action: { $regex: /ACCESS|DUAL_ADMIN|ADMIN_PROMOT|ADMIN_REMOV/i }
    }).sort({ timestamp: -1 }).limit(100).lean();
    return { success: true, audit: logs };
  }
}

module.exports = new AdminAccessService();
