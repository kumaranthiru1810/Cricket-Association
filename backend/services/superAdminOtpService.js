/**
 * services/superAdminOtpService.js
 * 
 * High-Security Nodemailer Email OTP Verification Service for Super Administrator.
 * 
 * Core Invariants:
 * 1. Permanent Super Admin: ONLY admin@cfvd.org (single permanent Super Admin).
 * 2. All other administrator accounts are dynamically managed.
 * 3. Cryptographically secure 6-digit OTP generated via Node.js crypto.
 * 4. Hashed OTP storage (SHA-256 HMAC with random salt).
 * 5. 10-minute expiration & single-use execution.
 * 6. Maximum 5 verification attempts & 60-second resend cooldown.
 * 7. Action-specific payload binding with comprehensive audit logging.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const {
  sendSuperAdminVerificationEmail,
  sendAdminApprovalEmail,
  SUPER_ADMIN_EMAIL
} = require('../config/mailer');

/**
 * Add Audit Log Entry
 */
async function recordAuditLog({ action, initiatedBy, targetUser, result, details }) {
  try {
    await db.initDb();
    if (db.models.AuditLog) {
      await db.models.AuditLog.create({
        id: `AUDIT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        action,
        initiated_by: initiatedBy || SUPER_ADMIN_EMAIL,
        target_user: targetUser || null,
        result: result || 'SUCCESS',
        details: details || '',
        ip_address: '127.0.0.1',
        timestamp: new Date()
      });
    }
  } catch (err) {
    console.warn('Audit log write error:', err.message);
  }
}

/**
 * Validate that caller is the designated permanent Super Administrator
 */
function validateSuperAdminIdentity(email) {
  const normalized = (email || '').toLowerCase().trim();
  if (normalized !== SUPER_ADMIN_EMAIL) {
    throw new Error(`Unauthorized: Access restricted to permanent Super Administrator (${SUPER_ADMIN_EMAIL}).`);
  }
  return true;
}

/**
 * Request Super Admin Security OTP for a sensitive operation
 */
async function requestSuperAdminOtp({
  requesterEmail = SUPER_ADMIN_EMAIL,
  action,
  targetId = null,
  targetEmail = null,
  targetData = {}
}) {
  await db.initDb();
  validateSuperAdminIdentity(requesterEmail);

  if (!action) {
    throw new Error('Administrative action type is required.');
  }

  // 1. Check for 60-second cooldown on recent active request
  const recentSession = await db.models.AdminActionOtp.findOne({
    action,
    super_admin_email: SUPER_ADMIN_EMAIL,
    status: 'PENDING',
    expires_at: { $gt: new Date() }
  }).sort({ created_at: -1 });

  if (recentSession && recentSession.last_sent_at) {
    const elapsedMs = Date.now() - new Date(recentSession.last_sent_at).getTime();
    if (elapsedMs < 60000) {
      const waitSeconds = Math.ceil((60000 - elapsedMs) / 1000);
      throw new Error(`OTP already dispatched. Please wait ${waitSeconds}s before requesting a new code.`);
    }
  }

  // 2. Invalidate any existing pending OTPs for the same action/target
  await db.models.AdminActionOtp.updateMany(
    {
      action,
      super_admin_email: SUPER_ADMIN_EMAIL,
      status: 'PENDING'
    },
    { $set: { status: 'EXPIRED' } }
  );

  // 3. Generate crypto-secure 6-digit OTP & salt
  const otp = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.createHmac('sha256', salt).update(otp).digest('hex');

  // 4. Set 10-minute expiration
  const validityMinutes = 10;
  const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);
  const sessionId = `SA-AUTH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // 5. Build descriptive human-readable label for email
  let actionTitle = 'Administrative Operation';
  let actionDescription = '';

  switch (action) {
    case 'CREATE_ADMIN':
      actionTitle = 'Onboard New Administrator';
      actionDescription = `Create new administrator account for ${targetData.name || 'New Admin'} (${targetData.email || targetEmail || 'N/A'}) with clearance level: ${targetData.roleLevel || 'Standard Administrator'}.`;
      break;
    case 'APPROVE_ADMIN':
      actionTitle = 'Approve Pending Administrator';
      actionDescription = `Formally authorize and activate pending administrator account for ${targetData.name || targetId} (${targetEmail || targetData.email}).`;
      break;
    case 'REJECT_ADMIN':
      actionTitle = 'Reject Pending Administrator';
      actionDescription = `Reject pending administrator registration for ${targetData.name || targetId}.`;
      break;
    case 'ACTIVATE_ADMIN':
      actionTitle = 'Activate Administrator Account';
      actionDescription = `Restore active association management privileges for admin ID ${targetId}.`;
      break;
    case 'SUSPEND_ADMIN':
      actionTitle = 'Suspend Administrator Account';
      actionDescription = `Revoke active association management privileges and suspend admin ID ${targetId}.`;
      break;
    case 'REMOVE_ADMIN':
      actionTitle = 'Permanently Remove Administrator';
      actionDescription = `Delete dynamic administrator record ${targetId} (${targetEmail || 'N/A'}) from the association database.`;
      break;
    case 'CHANGE_ROLE':
      actionTitle = 'Elevate User to Administrator Role';
      actionDescription = `Promote user ${targetId} (${targetEmail}) to executive ADMIN privileges.`;
      break;
    case 'CHANGE_PERMISSIONS':
      actionTitle = 'Modify Administrator Permissions';
      actionDescription = `Update management clearance permissions for admin ${targetId}.`;
      break;
    default:
      actionTitle = action.replace(/_/g, ' ');
      actionDescription = JSON.stringify(targetData);
  }

  // 6. Store Hashed OTP session in database
  await db.models.AdminActionOtp.create({
    session_id: sessionId,
    action,
    super_admin_email: SUPER_ADMIN_EMAIL,
    target_id: targetId,
    target_email: targetEmail,
    target_data: targetData,
    otp_hash: otpHash,
    salt,
    attempts: 0,
    max_attempts: 5,
    expires_at: expiresAt,
    last_sent_at: new Date(),
    status: 'PENDING'
  });

  // 7. Dispatch Professional Royal Blue & Gold Email via Nodemailer
  const mailResult = await sendSuperAdminVerificationEmail({
    superAdminEmail: SUPER_ADMIN_EMAIL,
    actionTitle,
    actionDescription,
    otp,
    requestedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  });

  // 8. Audit logging
  await recordAuditLog({
    action: 'SUPER_ADMIN_OTP_REQUESTED',
    initiatedBy: requesterEmail,
    targetUser: targetId || targetEmail,
    result: mailResult.success ? 'DISPATCHED' : 'DISPATCH_ERROR',
    details: `Action: ${actionTitle} • Recipient: ${SUPER_ADMIN_EMAIL} • Session: ${sessionId}`
  });

  return {
    success: true,
    sessionId,
    superAdminEmail: SUPER_ADMIN_EMAIL,
    action,
    actionTitle,
    expiresAt,
    validitySeconds: validityMinutes * 60,
    cooldownSeconds: 60,
    mailDispatched: mailResult.success,
    previewUrl: mailResult.previewUrl || null,
    // Provide demoOtp in development for seamless UI testing
    demoOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
  };
}

/**
 * Resend OTP with 60-second cooldown check
 */
async function resendSuperAdminOtp({ sessionId, requesterEmail = SUPER_ADMIN_EMAIL }) {
  await db.initDb();
  validateSuperAdminIdentity(requesterEmail);

  const session = await db.models.AdminActionOtp.findOne({ session_id: sessionId });
  if (!session) {
    throw new Error('Security session not found or already invalidated.');
  }

  if (session.status !== 'PENDING') {
    throw new Error(`Cannot resend OTP. Security session is already ${session.status.toLowerCase()}.`);
  }

  const elapsedMs = Date.now() - new Date(session.last_sent_at).getTime();
  if (elapsedMs < 60000) {
    const waitSeconds = Math.ceil((60000 - elapsedMs) / 1000);
    throw new Error(`Please wait ${waitSeconds}s before requesting a new verification code.`);
  }

  // Generate new OTP & salt
  const otp = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.createHmac('sha256', salt).update(otp).digest('hex');

  session.otp_hash = otpHash;
  session.salt = salt;
  session.attempts = 0;
  session.expires_at = new Date(Date.now() + 10 * 60 * 1000);
  session.last_sent_at = new Date();
  await session.save();

  await sendSuperAdminVerificationEmail({
    superAdminEmail: SUPER_ADMIN_EMAIL,
    actionTitle: `Resend: ${session.action.replace(/_/g, ' ')}`,
    actionDescription: `Resent verification code for session ${sessionId}.`,
    otp,
    requestedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  });

  await recordAuditLog({
    action: 'SUPER_ADMIN_OTP_RESENT',
    initiatedBy: requesterEmail,
    targetUser: session.target_id || session.target_email,
    result: 'RESENT',
    details: `Session ${sessionId} re-issued new 6-digit OTP`
  });

  return {
    success: true,
    sessionId,
    cooldownSeconds: 60,
    expiresAt: session.expires_at,
    demoOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
  };
}

/**
 * Verify OTP and execute authorized administrative action
 */
async function verifyAndExecuteSuperAdminAction({
  sessionId,
  otp,
  requesterEmail = SUPER_ADMIN_EMAIL
}) {
  await db.initDb();
  validateSuperAdminIdentity(requesterEmail);

  if (!sessionId || !otp) {
    throw new Error('Session ID and 6-digit verification code are required.');
  }

  const session = await db.models.AdminActionOtp.findOne({ session_id: sessionId });
  if (!session) {
    throw new Error('Invalid or expired security session. Please initiate a new request.');
  }

  if (session.status !== 'PENDING') {
    throw new Error(`This security session has already been ${session.status.toLowerCase()}. Single-use security policy enforced.`);
  }

  // Check expiration
  if (Date.now() > new Date(session.expires_at).getTime()) {
    session.status = 'EXPIRED';
    await session.save();
    throw new Error('The security verification code has expired (10-minute validity exceeded). Please request a new code.');
  }

  // Check attempts
  if (session.attempts >= session.max_attempts) {
    session.status = 'MAX_ATTEMPTS_EXCEEDED';
    await session.save();
    throw new Error('Maximum verification attempts (5) exceeded. Session locked for security.');
  }

  // Verify HMAC hash
  const cleanOtp = String(otp).trim();
  const computedHash = crypto.createHmac('sha256', session.salt).update(cleanOtp).digest('hex');

  if (computedHash !== session.otp_hash) {
    session.attempts += 1;
    if (session.attempts >= session.max_attempts) {
      session.status = 'MAX_ATTEMPTS_EXCEEDED';
    }
    await session.save();

    const remaining = session.max_attempts - session.attempts;
    await recordAuditLog({
      action: 'SUPER_ADMIN_OTP_FAILED',
      initiatedBy: requesterEmail,
      targetUser: session.target_id || session.target_email,
      result: 'FAILED_OTP',
      details: `Failed attempt ${session.attempts}/${session.max_attempts} for session ${sessionId}`
    });

    if (remaining <= 0) {
      throw new Error('Verification failed. Maximum attempts exceeded. Session locked.');
    }
    throw new Error(`Incorrect verification code. ${remaining} attempt(s) remaining.`);
  }

  // OTP is correct! Enforce single-use: mark VERIFIED immediately
  session.status = 'VERIFIED';
  await session.save();

  // Execute the specific administrative action bound to this OTP session
  let actionResult = null;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';

  switch (session.action) {
    case 'CREATE_ADMIN': {
      const data = session.target_data || {};
      const newEmail = (data.email || session.target_email || '').toLowerCase().trim();
      if (!newEmail) throw new Error('Administrator email is required.');

      // Check if user with email already exists
      let existingUser = await db.models.User.findOne({ email: newEmail });
      if (existingUser) {
        if (existingUser.role === 'ADMIN' && existingUser.status === 'ACTIVE') {
          throw new Error(`User with email '${newEmail}' is already an active administrator.`);
        }
        // Promote existing user to active dynamic admin
        existingUser.role = 'ADMIN';
        existingUser.status = 'ACTIVE';
        existingUser.is_super_admin = false;
        existingUser.admin_level = data.roleLevel || 'Standard Administrator';
        existingUser.approval_status = 'APPROVED';
        await existingUser.save();
        actionResult = existingUser.toObject();
      } else {
        const adminId = `ADM-${Date.now()}`;
        const tempPassword = data.password || 'Admin@2026!';
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(24).toString('hex');

        const newAdmin = await db.models.User.create({
          id: adminId,
          name: data.name || 'New Administrator',
          email: newEmail,
          mobile: data.mobile || null,
          role: 'ADMIN',
          status: 'ACTIVE',
          is_super_admin: false,
          admin_level: data.roleLevel || 'Standard Administrator',
          approval_status: 'APPROVED',
          password_hash: passwordHash,
          current_password: tempPassword,
          activation_token: activationToken,
          activation_token_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000)
        });
        actionResult = newAdmin.toObject();
      }

      // Send account approval notification & password setup link to new admin
      const setupUrl = `${frontendUrl}/admin/setup-password?email=${encodeURIComponent(newEmail)}&token=${actionResult.activation_token || 'setup'}`;
      await sendAdminApprovalEmail({
        toEmail: newEmail,
        adminName: data.name || 'Administrator',
        adminLevel: data.roleLevel || 'Standard Administrator',
        setupUrl
      });
      break;
    }

    case 'APPROVE_ADMIN': {
      const targetQuery = session.target_id
        ? { id: session.target_id }
        : { email: session.target_email };

      const adminUser = await db.models.User.findOne(targetQuery);
      if (!adminUser) throw new Error(`Administrator account '${session.target_id || session.target_email}' not found.`);

      adminUser.status = 'ACTIVE';
      adminUser.approval_status = 'APPROVED';
      adminUser.role = 'ADMIN';
      adminUser.is_super_admin = false;
      const activationToken = crypto.randomBytes(24).toString('hex');
      adminUser.activation_token = activationToken;
      adminUser.activation_token_expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await adminUser.save();

      const setupUrl = `${frontendUrl}/admin/setup-password?email=${encodeURIComponent(adminUser.email)}&token=${activationToken}`;
      await sendAdminApprovalEmail({
        toEmail: adminUser.email,
        adminName: adminUser.name,
        adminLevel: adminUser.admin_level || 'Standard Administrator',
        setupUrl
      });
      actionResult = adminUser.toObject();
      break;
    }

    case 'REJECT_ADMIN': {
      const targetQuery = session.target_id
        ? { id: session.target_id }
        : { email: session.target_email };

      const adminUser = await db.models.User.findOne(targetQuery);
      if (!adminUser) throw new Error(`Target account '${session.target_id || session.target_email}' not found.`);

      adminUser.status = 'REJECTED';
      adminUser.approval_status = 'REJECTED';
      await adminUser.save();
      actionResult = { id: adminUser.id, status: 'REJECTED' };
      break;
    }

    case 'ACTIVATE_ADMIN': {
      const adminUser = await db.models.User.findOne({ id: session.target_id });
      if (!adminUser) throw new Error(`Administrator ${session.target_id} not found.`);

      adminUser.status = 'ACTIVE';
      await adminUser.save();
      actionResult = { id: adminUser.id, status: 'ACTIVE' };
      break;
    }

    case 'SUSPEND_ADMIN': {
      const adminUser = await db.models.User.findOne({ id: session.target_id });
      if (!adminUser) throw new Error(`Administrator ${session.target_id} not found.`);

      if (adminUser.email.toLowerCase() === SUPER_ADMIN_EMAIL || adminUser.is_super_admin) {
        throw new Error('Forbidden: The permanent Super Administrator account (admin@cfvd.org) cannot be suspended.');
      }

      adminUser.status = 'SUSPENDED';
      await adminUser.save();
      actionResult = { id: adminUser.id, status: 'SUSPENDED' };
      break;
    }

    case 'REMOVE_ADMIN': {
      const adminUser = await db.models.User.findOne({ id: session.target_id });
      if (!adminUser) throw new Error(`Administrator ${session.target_id} not found.`);

      if (adminUser.email.toLowerCase() === SUPER_ADMIN_EMAIL || adminUser.is_super_admin) {
        throw new Error('Forbidden: The permanent Super Administrator account (admin@cfvd.org) cannot be removed.');
      }

      await db.models.User.deleteOne({ id: session.target_id });
      actionResult = { id: session.target_id, removed: true };
      break;
    }

    case 'CHANGE_ROLE': {
      const targetUser = await db.models.User.findOne({ id: session.target_id });
      if (!targetUser) throw new Error(`User ${session.target_id} not found.`);

      if (targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL) {
        throw new Error('Forbidden: The role of permanent Super Administrator cannot be modified.');
      }

      const newRole = session.target_data?.newRole || 'ADMIN';
      targetUser.role = newRole;
      if (newRole === 'ADMIN') {
        targetUser.is_super_admin = false;
        targetUser.status = 'ACTIVE';
      }
      await targetUser.save();
      actionResult = targetUser.toObject();
      break;
    }

    case 'CHANGE_PERMISSIONS': {
      const targetUser = await db.models.User.findOne({ id: session.target_id });
      if (!targetUser) throw new Error(`User ${session.target_id} not found.`);

      targetUser.admin_permissions = session.target_data?.permissions || [];
      await targetUser.save();
      actionResult = targetUser.toObject();
      break;
    }

    default:
      throw new Error(`Unsupported administrative action: ${session.action}`);
  }

  // Audit log of successful execution
  await recordAuditLog({
    action: `SUPER_ADMIN_${session.action}_SUCCESS`,
    initiatedBy: requesterEmail,
    targetUser: session.target_id || session.target_email,
    result: 'AUTHORIZED_AND_EXECUTED',
    details: `Session ${sessionId} validated via 6-digit OTP`
  });

  return {
    success: true,
    message: `Administrative action '${session.action}' verified and executed successfully.`,
    action: session.action,
    data: actionResult
  };
}

/**
 * Get all administrators with distinction between permanent Super Admin & dynamic admins
 */
async function getAdministratorsList() {
  await db.initDb();
  const users = await db.models.User.find({
    $or: [
      { role: 'ADMIN' },
      { email: SUPER_ADMIN_EMAIL }
    ]
  }).sort({ is_super_admin: -1, created_at: -1 }).lean();

  return users.map(u => ({
    ...u,
    is_permanent_super_admin: (u.email || '').toLowerCase() === SUPER_ADMIN_EMAIL,
    admin_category: (u.email || '').toLowerCase() === SUPER_ADMIN_EMAIL ? 'Permanent Super Admin' : 'Dynamic Administrator'
  }));
}

module.exports = {
  SUPER_ADMIN_EMAIL,
  requestSuperAdminOtp,
  resendSuperAdminOtp,
  verifyAndExecuteSuperAdminAction,
  getAdministratorsList,
  recordAuditLog
};
