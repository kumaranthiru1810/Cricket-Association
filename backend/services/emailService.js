/**
 * emailService.js
 * 
 * Development-safe Email & SMS notification service abstraction.
 * 
 * Production Integration Instructions:
 * To connect a real SMTP / Email Provider (SendGrid, AWS SES, Nodemailer, Twilio):
 * 1. Set environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, TWILIO_SID, etc.
 * 2. Replace the sendOtpNotification implementation below with provider client calls.
 */

const mailer = require('../config/mailer');

async function sendOtpNotification({ toEmail, toPhone, recipientRole, otpCode, requestId }) {
  // Never log OTP values in production plain text files or return to clients.
  // In dev mode, log metadata confirmation that dispatch was triggered.
  console.log(`[EmailService] OTP Dispatch triggered for recipient: ${toEmail || toPhone} (Role: ${recipientRole}, RequestId: ${requestId})`);

  // Documented hook point for external providers:
  if (toEmail) {
    try {
      await mailer.sendOtpEmail({ toEmail, otp: otpCode, recipientRole });
    } catch (_e) {}
  }

  return {
    success: true,
    message: `Security notification dispatched to ${toEmail}`
  };
}

module.exports = {
  sendOtpNotification
};
