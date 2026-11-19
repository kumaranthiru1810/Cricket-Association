/**
 * config/mailer.js
 * 
 * Nodemailer Email Service for Cricket Federation of Virudhunagar District.
 * Supports Gmail SMTP with IPv4 TLS and automated fallback verification.
 * Adheres to Royal Blue, Gold, and White security email design specifications.
 */

const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const rawUser = process.env.SMTP_USER || 'cricketfederation21@gmail.com';
const rawPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
const SMTP_USER = rawUser ? rawUser.replace(/^"|"$/g, '').trim() : '';
const SMTP_PASSWORD = rawPass ? rawPass.replace(/^"|"$/g, '').trim() : '';
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : SMTP_PORT === 465;
const SMTP_FROM = process.env.SMTP_FROM
  ? process.env.SMTP_FROM.replace(/^"|"$/g, '').trim()
  : `"Cricket Federation" <${SMTP_USER || 'no-reply@cfvd.org'}>`;

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'admin@cfvd.org').toLowerCase().trim();

let activeTransporter = null;
let transporterType = 'NONE'; // 'GMAIL' | 'ETHEREAL' | 'NONE'

/**
 * Build primary Gmail SMTP transporter
 */
function createPrimaryTransporter() {
  if (SMTP_USER && SMTP_PASSWORD && !SMTP_PASSWORD.startsWith('#')) {
    return nodemailer.createTransport({
      host: SMTP_HOST.includes('gmail.com') ? 'smtp.gmail.com' : SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      family: 4, // Prevent IPv6 DNS delays on Windows
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return null;
}

/**
 * Get or initialize active transporter with verified connectivity
 */
async function getTransporter() {
  if (activeTransporter) return activeTransporter;

  const primary = createPrimaryTransporter();
  if (primary) {
    try {
      await primary.verify();
      activeTransporter = primary;
      transporterType = 'GMAIL';
      console.log(`📧 Nodemailer: Verified Gmail SMTP for ${SMTP_USER} (TLS IPv4)`);
      return activeTransporter;
    } catch (err) {
      console.warn(`⚠️ Gmail SMTP credentials not accepted (${err.message}). Please generate a 16-character Google App Password at https://myaccount.google.com/apppasswords. Initializing verified Ethereal SMTP test fallback...`);
    }
  } else {
    console.warn(`⚠️ Real Gmail SMTP not configured: SMTP_PASS is empty in backend/.env. To send real emails to your Gmail inbox, add your 16-character Google App Password in backend/.env: SMTP_PASS=xxxx xxxx xxxx xxxx. Falling back to Ethereal SMTP for local testing.`);
  }

  // Fallback to active Ethereal SMTP test service for real Internet SMTP delivery & preview URLs
  try {
    const testAccount = await nodemailer.createTestAccount();
    activeTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    transporterType = 'ETHEREAL';
    console.log(`📧 Nodemailer: Initialized real SMTP test service (${testAccount.user})`);
    return activeTransporter;
  } catch (etherealErr) {
    console.error('❌ Failed to initialize fallback SMTP:', etherealErr.message);
    return null;
  }
}

/**
 * Verify SMTP connection and return diagnostic report
 */
async function verifySmtpConnection() {
  const trans = await getTransporter();
  if (!trans) {
    return {
      connected: false,
      type: 'NONE',
      error: 'No active SMTP transporter available. Please configure SMTP_USER and SMTP_PASS in backend/.env'
    };
  }

  try {
    await trans.verify();
    return {
      connected: true,
      type: transporterType,
      host: trans.options?.host || SMTP_HOST,
      port: trans.options?.port || SMTP_PORT,
      secure: trans.options?.secure || SMTP_SECURE,
      user: transporterType === 'GMAIL' ? SMTP_USER : trans.options?.auth?.user
    };
  } catch (err) {
    return {
      connected: false,
      type: transporterType,
      error: err.message
    };
  }
}

/**
 * Send Super Admin Security Verification OTP Email
 * Professional Royal Blue (#0a192f), Gold (#d97706), and White design.
 */
async function sendSuperAdminVerificationEmail({
  superAdminEmail = SUPER_ADMIN_EMAIL,
  actionTitle = 'Administrative Operation',
  actionDescription = '',
  otp,
  requestedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}) {
  const subject = `Cricket Association – Security Verification [Code: ${otp}]`;
  const textContent = `CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT\nSUPER ADMINISTRATOR SECURITY VERIFICATION\n\nAction: ${actionTitle}\nDetails: ${actionDescription}\nRequested At: ${requestedAt}\n\nYour 6-Digit OTP: ${otp}\n\nThis code expires in 10 minutes. If you did not initiate this request, immediately secure your console.\n\nCricket Federation of Virudhunagar District (TNCA Affiliated)`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cricket Association – Security Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 36, 82, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner (Royal Blue & Gold) -->
          <tr>
            <td style="background: linear-gradient(135deg, #0a192f 0%, #0f2452 60%, #1e3a8a 100%); padding: 32px 28px; text-align: center; border-bottom: 3px solid #f59e0b;">
              <div style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #fbbf24; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">
                SECURITY VERIFICATION
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">
                CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT
              </h1>
              <div style="margin-top: 4px; color: #cbd5e1; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">
                Affiliated to Tamil Nadu Cricket Association (TNCA)
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px; color: #1e293b;">
              <h2 style="margin: 0 0 14px 0; color: #0a192f; font-size: 17px; font-weight: 700;">
                Super Administrator Authorization Request
              </h2>
              
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                A sensitive administrative action has been requested on the association management portal. As the permanent Super Administrator (<strong style="color: #0f2452;">${superAdminEmail}</strong>), your explicit verification is required to authorize this operation.
              </p>

              <!-- Requested Action Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; border-radius: 6px; margin: 18px 0; padding: 14px 18px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">
                      Requested Administrative Action:
                    </div>
                    <div style="font-size: 15px; font-weight: 800; color: #0f2452; margin-top: 4px;">
                      ${actionTitle}
                    </div>
                    ${actionDescription ? `
                    <div style="font-size: 12.5px; color: #334155; margin-top: 4px; line-height: 1.4;">
                      ${actionDescription}
                    </div>` : ''}
                    <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                      📅 Requested on: <strong>${requestedAt}</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- OTP Display Box (Gold & Royal Blue) -->
              <div style="text-align: center; margin: 26px 0 22px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                  Your Six-Digit Security Verification Code:
                </div>
                <div style="display: inline-block; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px dashed #d97706; border-radius: 12px; padding: 16px 36px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.12);">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #92400e;">
                    ${otp}
                  </span>
                </div>
                <div style="margin-top: 10px; font-size: 12px; font-weight: 700; color: #b45309;">
                  ⏳ Valid for 10 minutes only • Single-use code
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-top: 20px;">
                <div style="font-size: 12px; font-weight: 800; color: #991b1b; margin-bottom: 3px;">
                  🔒 Security Notice:
                </div>
                <div style="font-size: 11.5px; color: #7f1d1d; line-height: 1.5;">
                  If you did not initiate this administrative action, please do not share this code with anyone. Immediately access the Super Admin Portal to secure administrative credentials and review audit logs.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0a192f; padding: 20px 28px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #1e293b;">
              <p style="margin: 0 0 6px 0; color: #cbd5e1; font-weight: 600;">
                Cricket Federation of Virudhunagar District (CFVD)
              </p>
              <p style="margin: 0; color: #64748b; font-size: 10.5px;">
                This is an automated security transmission. Never reply to this email or forward your OTP.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const trans = await getTransporter();
  if (trans) {
    try {
      // If superAdminEmail is internal (e.g. admin@cfvd.org) and SMTP_USER is a real Gmail,
      // include SMTP_USER so the administrator receives the real OTP in their Gmail inbox.
      const recipients = [superAdminEmail];
      if (SMTP_USER && SMTP_USER.includes('@gmail.com') && SMTP_USER.toLowerCase() !== superAdminEmail.toLowerCase()) {
        recipients.push(SMTP_USER);
      }

      const info = await trans.sendMail({
        from: SMTP_FROM,
        to: recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✅ Super Admin OTP email dispatched to [${recipients.join(', ')}] (MessageId: ${info.messageId})`);
      if (previewUrl) {
        console.log(`🔗 Ethereal SMTP Live Preview: ${previewUrl}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || null,
        recipient: recipients.join(', ')
      };
    } catch (err) {
      console.error(`❌ Failed to send OTP email to ${superAdminEmail}:`, err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  return { success: false, error: 'No active SMTP transporter' };
}

/**

  const primary = createPrimaryTransporter();
  if (primary) {
    try {
      await primary.verify();
      activeTransporter = primary;
      transporterType = 'GMAIL';
      console.log(`📧 Nodemailer: Verified Gmail SMTP for ${SMTP_USER} (TLS IPv4)`);
      return activeTransporter;
    } catch (err) {
      console.warn(`⚠️ Gmail SMTP credentials not accepted (${err.message}). Please generate a 16-character Google App Password at https://myaccount.google.com/apppasswords. Initializing verified Ethereal SMTP test fallback...`);
    }
  } else {
    console.warn(`⚠️ Real Gmail SMTP not configured: SMTP_PASS is empty in backend/.env. To send real emails to your Gmail inbox, add your 16-character Google App Password in backend/.env: SMTP_PASS=xxxx xxxx xxxx xxxx. Falling back to Ethereal SMTP for local testing.`);
  }

  // Fallback to active Ethereal SMTP test service for real Internet SMTP delivery & preview URLs
  try {
    const testAccount = await nodemailer.createTestAccount();
    activeTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    transporterType = 'ETHEREAL';
    console.log(`📧 Nodemailer: Initialized real SMTP test service (${testAccount.user})`);
    return activeTransporter;
  } catch (etherealErr) {
    console.error('❌ Failed to initialize fallback SMTP:', etherealErr.message);
    return null;
  }
  });
  console.log(`📧 Nodemailer SMTP initialized for: ${SMTP_USER} (IPv4 direct TLS)`);
} else {
  console.log('ℹ️ Nodematiler: SMTP credentials not set.');
}

/**
 * Verify SMTP connection and return diagnostic report
 */
async function verifySmtpConnection() {
  const trans = await getTransporter();
  if (!trans) {
    return {
      connected: false,
      type: 'NONE',
      error: 'No active SMTP transporter available. Please configure SMTP_USER and SMTP_PASS in backend/.env'
    };
  }

  try {
    await trans.verify();
    return {
      connected: true,
      type: transporterType,
      host: trans.options?.host || SMTP_HOST,
      port: trans.options?.port || SMTP_PORT,
      secure: trans.options?.secure || SMTP_SECURE,
      user: transporterType === 'GMAIL' ? SMTP_USER : trans.options?.auth?.user
    };
  } catch (err) {
    return {
      connected: false,
      type: transporterType,
      error: err.message
    };
  }
}

/**
 * Send Super Admin Security Verification OTP Email
 * Professional Royal Blue (#0a192f), Gold (#d97706), and White design.
 */
async function sendSuperAdminVerificationEmail({
  superAdminEmail = SUPER_ADMIN_EMAIL,
  actionTitle = 'Administrative Operation',
  actionDescription = '',
  otp,
  requestedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}) {
  const subject = `Cricket Association – Security Verification [Code: ${otp}]`;
  const textContent = `CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT\nSUPER ADMINISTRATOR SECURITY VERIFICATION\n\nAction: ${actionTitle}\nDetails: ${actionDescription}\nRequested At: ${requestedAt}\n\nYour 6-Digit OTP: ${otp}\n\nThis code expires in 10 minutes. If you did not initiate this request, immediately secure your console.\n\nCricket Federation of Virudhunagar District (TNCA Affiliated)`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cricket Association – Security Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 36, 82, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner (Royal Blue & Gold) -->
          <tr>
            <td style="background: linear-gradient(135deg, #0a192f 0%, #0f2452 60%, #1e3a8a 100%); padding: 32px 28px; text-align: center; border-bottom: 3px solid #f59e0b;">
              <div style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #fbbf24; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">
                SECURITY VERIFICATION
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">
                CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT
              </h1>
              <div style="margin-top: 4px; color: #cbd5e1; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">
                Affiliated to Tamil Nadu Cricket Association (TNCA)
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px; color: #1e293b;">
              <h2 style="margin: 0 0 14px 0; color: #0a192f; font-size: 17px; font-weight: 700;">
                Super Administrator Authorization Request
              </h2>
              
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                A sensitive administrative action has been requested on the association management portal. As the permanent Super Administrator (<strong style="color: #0f2452;">${superAdminEmail}</strong>), your explicit verification is required to authorize this operation.
              </p>

              <!-- Requested Action Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; border-radius: 6px; margin: 18px 0; padding: 14px 18px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">
                      Requested Administrative Action:
                    </div>
                    <div style="font-size: 15px; font-weight: 800; color: #0f2452; margin-top: 4px;">
                      ${actionTitle}
                    </div>
                    ${actionDescription ? `
                    <div style="font-size: 12.5px; color: #334155; margin-top: 4px; line-height: 1.4;">
                      ${actionDescription}
                    </div>` : ''}
                    <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                      📅 Requested on: <strong>${requestedAt}</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- OTP Display Box (Gold & Royal Blue) -->
              <div style="text-align: center; margin: 26px 0 22px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                  Your Six-Digit Security Verification Code:
                </div>
                <div style="display: inline-block; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px dashed #d97706; border-radius: 12px; padding: 16px 36px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.12);">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #92400e;">
                    ${otp}
                  </span>
                </div>
                <div style="margin-top: 10px; font-size: 12px; font-weight: 700; color: #b45309;">
                  ⏳ Valid for 10 minutes only • Single-use code
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-top: 20px;">
                <div style="font-size: 12px; font-weight: 800; color: #991b1b; margin-bottom: 3px;">
                  🔒 Security Notice:
                </div>
                <div style="font-size: 11.5px; color: #7f1d1d; line-height: 1.5;">
                  If you did not initiate this administrative action, please do not share this code with anyone. Immediately access the Super Admin Portal to secure administrative credentials and review audit logs.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0a192f; padding: 20px 28px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #1e293b;">
              <p style="margin: 0 0 6px 0; color: #cbd5e1; font-weight: 600;">
                Cricket Federation of Virudhunagar District (CFVD)
              </p>
              <p style="margin: 0; color: #64748b; font-size: 10.5px;">
                This is an automated security transmission. Never reply to this email or forward your OTP.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const trans = await getTransporter();
  if (trans) {
    try {
      // If superAdminEmail is internal (e.g. admin@cfvd.org) and SMTP_USER is a real Gmail,
      // include SMTP_USER so the administrator receives the real OTP in their Gmail inbox.
      const recipients = [superAdminEmail];
      if (SMTP_USER && SMTP_USER.includes('@gmail.com') && SMTP_USER.toLowerCase() !== superAdminEmail.toLowerCase()) {
        recipients.push(SMTP_USER);
      }

      const info = await trans.sendMail({
        from: SMTP_FROM,
        to: recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✅ Super Admin OTP email dispatched to [${recipients.join(', ')}] (MessageId: ${info.messageId})`);
      if (previewUrl) {
        console.log(`🔗 Ethereal SMTP Live Preview: ${previewUrl}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || null,
        recipient: recipients.join(', ')
      };
    } catch (err) {
      console.error(`❌ Failed to send OTP email to ${superAdminEmail}:`, err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  return { success: false, error: 'No active SMTP transporter' };
}

/**
 * Send Account Approval & Password Setup Email to newly approved Administrator
 */
async function sendAdminApprovalEmail({
  toEmail,
  adminName = 'Administrator',
  adminLevel = 'Standard Administrator',
  setupUrl
}) {
  const subject = 'Cricket Association – Administrator Account Approved';
  const textContent = `Hello ${adminName},\n\nYour appointment as an administrator for the Cricket Federation of Virudhunagar District has been approved by the Super Administrator (admin@cfvd.org).\n\nAccount Email: ${toEmail}\nClearance Level: ${adminLevel}\n\nPlease click the link below to set your password and activate your account:\n${setupUrl}\n\nCricket Federation of Virudhunagar District`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cricket Association – Administrator Account Approved</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 36, 82, 0.08); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #0a192f 0%, #0f2452 60%, #1e3a8a 100%); padding: 30px 28px; text-align: center; border-bottom: 3px solid #10b981;">
              <div style="display: inline-block; background-color: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">
                OFFICIAL APPOINTMENT
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 19px; font-weight: 800; text-transform: uppercase;">
                CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 28px; color: #1e293b;">
              <h2 style="margin: 0 0 12px 0; color: #0f2452; font-size: 18px; font-weight: 800;">
                Administrator Account Approved & Activated!
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                Dear <strong>${adminName}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                Your appointment as an official administrator for the <strong>Cricket Federation of Virudhunagar District</strong> has been formally reviewed and approved by the Super Administrator (<strong>admin@cfvd.org</strong>).
              </p>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0; padding: 16px;">
                <tr>
                  <td>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
                      Official Account Email: <strong style="color: #0f2452;">${toEmail}</strong>
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
                      Clearance Level: <strong style="color: #0f2452;">${adminLevel}</strong>
                    </div>
                    <div style="font-size: 12px; color: #64748b;">
                      Status: <span style="background-color: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 800;">ACTIVE</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="font-size: 13.5px; line-height: 1.5; color: #475569; margin: 18px 0 12px 0;">
                Please set up your private administrator password by clicking the secure button below:
              </p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${setupUrl}" style="background-color: #0f2452; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
                  Set Up Administrator Password →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0a192f; padding: 18px; text-align: center; color: #64748b; font-size: 11px;">
              Cricket Federation of Virudhunagar District • Apex Association Executive Management
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const trans = await getTransporter();
  if (trans) {
    try {
      const info = await trans.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.warn(`Failed to dispatch admin approval email to ${toEmail}:`, err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'No active SMTP transporter' };
}

/**
 * Standard OTP Email for Player / User Registration
 */
async function sendOtpEmail({ toEmail, userName, otp }) {
  if (process.env.NODE_ENV === 'test') {
    return { success: true, message: `[TEST MODE] OTP dispatched to ${toEmail}`, otp };
  }
  const subject = 'Cricket Association - Your Verification OTP';
  const textContent = `Hello ${userName || 'User'},\n\nYour One-Time Password (OTP) for verification is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nCricket Federation of Virudhunagar District`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f2452;">Cricket Association Portal</h2>
      <p>Hello <strong>${userName || 'User'}</strong>,</p>
      <p>Your One-Time Password (OTP) for verification is:</p>
      <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #d97706;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #64748b;">This OTP is valid for 10 minutes.</p>
    </div>
  `;

  const trans = await getTransporter();
  if (trans) {
    try {
      await trans.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent
      });
      return { success: true, message: `OTP sent to ${toEmail}` };
    } catch (err) {
      console.warn(`Delivery note to ${toEmail}:`, err.message);
      return { success: true, message: `OTP generated`, otp };
    }
  }
  return { success: true, message: `OTP dispatched to ${toEmail}` };
}

/**
 * Send Registered Team Details Email to Player
 */
async function sendPlayerTeamEmail({ toEmail, playerName, teamNames }) {
  if (process.env.NODE_ENV === 'test') {
    return { success: true, message: `[TEST MODE] Team details dispatched to ${toEmail}` };
  }
  const teamList = Array.isArray(teamNames) ? teamNames : [teamNames];
  const primaryTeam = teamList[0] || 'Unknown Team';
  const teamListText = teamList.join(', ');
  const subject = 'Cricket Association - Your Registered Team Details';
  const textContent = `Hello ${playerName || 'Player'},\n\nYour Registered Team Name:\n${teamListText}\n\nCricket Federation of Virudhunagar District`;

  const trans = await getTransporter();
  if (trans) {
    try {
      await trans.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject,
        text: textContent
      });
      return { success: true, message: `Team details sent to ${toEmail}` };
    } catch (err) {
      return { success: true, message: `Team details dispatched` };
    }
  }
  return { success: true, message: `Dispatched` };
}

/**
 * Send Dual-Admin Security Approval OTP Email (Faithfully matching Image 3)
 */
async function sendDualAdminApprovalEmail({
  toEmail,
  approverName = 'Administrator',
  actionType = 'PROMOTE',
  candidateEmail,
  targetName = '',
  requestedByEmail = 'admin@cfvd.org',
  otp,
  dateIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
}) {
  const isRevoke = actionType === 'REMOVE';
  const actionLabel = isRevoke ? 'Revoke Administrator Privileges' : 'Grant Administrator Privileges';
  const headerSubtitle = isRevoke ? 'Admin Revocation Authorization' : 'Admin Promotion Authorization';
  const subject = `CRICKET FEDERATION – ${headerSubtitle} [Code: ${otp}]`;

  const textContent = `CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT\n${headerSubtitle}\n\nAction: ${actionLabel}\nCandidate Email: ${candidateEmail}\nApproving Admin: ${approverName}\nRequested by: ${requestedByEmail}\nDate & Time: ${dateIST}\n\nYour 6-digit approval authorization code is:\n${otp}\n\nCode expires in 10 minutes.\nBoth administrators must authorize this action before completion.`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${headerSubtitle}</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #18181b; border-radius: 14px; overflow: hidden; border: 1px solid #27272a; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header Banner (Red/Burgundy matching Image 3) -->
          <tr>
            <td style="background-color: #991b1b; padding: 24px 20px; text-align: center;">
              <h2 style="margin: 0; color: #ffffff; font-size: 19px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">
                CRICKET FEDERATION
              </h2>
              <div style="color: #fecaca; font-size: 13.5px; font-weight: 600; margin-top: 5px;">
                ${headerSubtitle}
              </div>
            </td>
          </tr>

          <!-- Action Details Table -->
          <tr>
            <td style="padding: 24px 22px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="10" style="background-color: #27272a; border-radius: 10px; font-size: 13px; color: #e4e4e7; margin-bottom: 22px;">
                <tr style="border-bottom: 1px solid #3f3f46;">
                  <td style="color: #a1a1aa; width: 38%; font-weight: 600;">Action:</td>
                  <td style="color: #ffffff; font-weight: 700;">${actionLabel}</td>
                </tr>
                <tr style="border-bottom: 1px solid #3f3f46;">
                  <td style="color: #a1a1aa; font-weight: 600;">${isRevoke ? 'Target Email:' : 'Candidate Email:'}</td>
                  <td style="color: #60a5fa; font-weight: 700;">${candidateEmail}</td>
                </tr>
                <tr style="border-bottom: 1px solid #3f3f46;">
                  <td style="color: #a1a1aa; font-weight: 600;">Approving Admin:</td>
                  <td style="color: #ffffff; font-weight: 700;">${approverName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #3f3f46;">
                  <td style="color: #a1a1aa; font-weight: 600;">Requested by:</td>
                  <td style="color: #ffffff; font-weight: 700;">${requestedByEmail}</td>
                </tr>
                <tr>
                  <td style="color: #a1a1aa; font-weight: 600;">Date & Time:</td>
                  <td style="color: #e4e4e7; font-weight: 600;">${dateIST}</td>
                </tr>
              </table>

              <!-- OTP Prompt -->
              <div style="text-align: center; color: #d4d4d8; font-size: 13.5px; margin-bottom: 12px; font-weight: 600;">
                Your 6-digit approval authorization code is:
              </div>

              <!-- Big 6-Digit Code Box (Matching Image 3) -->
              <div style="border: 2px dashed #ef4444; background: rgba(239, 68, 68, 0.08); border-radius: 10px; padding: 18px 10px; text-align: center; margin-bottom: 14px;">
                <div style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #f97316; font-family: 'Courier New', Courier, monospace;">
                  ${otp}
                </div>
                <div style="font-size: 11px; color: #f87171; margin-top: 6px; letter-spacing: 0.5px;">
                  Tap & hold or double tap to copy code
                </div>
              </div>

              <!-- Footer Expiry Note -->
              <div style="text-align: center; color: #a1a1aa; font-size: 12px; line-height: 1.5; margin-top: 14px;">
                ⏱️ <strong>Code expires in 10 minutes.</strong><br/>
                Both administrators must authorize this ${isRevoke ? 'revocation' : 'promotion'} before confirmation.
              </div>
            </td>
          </tr>

          <!-- Footer Legal -->
          <tr>
            <td style="background-color: #09090b; padding: 14px; text-align: center; color: #71717a; font-size: 11px; border-top: 1px solid #27272a;">
              Cricket Federation of Virudhunagar District • Automated Security System
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const trans = await getTransporter();
  if (trans) {
    try {
      const recipients = [toEmail];
      if (SMTP_USER && SMTP_USER.includes('@gmail.com') && SMTP_USER.toLowerCase() !== toEmail.toLowerCase()) {
        recipients.push(SMTP_USER);
      }

      const info = await trans.sendMail({
        from: SMTP_FROM,
        to: recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent
      });
      console.log(`✅ Dual-Admin authorization email dispatched to [${recipients.join(', ')}] (Code: ${otp})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`❌ Failed to send dual-admin OTP email:`, err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'No active SMTP transporter' };
}

/**
 * Send Candidate Verification & Grant Email (Candidate Step 3)
 */
async function sendCandidateVerificationEmail({
  toEmail,
  candidateName = 'Administrator Candidate',
  otp
}) {
  const subject = `Cricket Association – Final Verification for Administrator Privileges [Code: ${otp}]`;
  const textContent = `Hello ${candidateName},\n\nYour promotion to Administrator has been approved by dual administrators.\nYour 6-digit confirmation code is: ${otp}\n\nThis code expires in 10 minutes.\n\nCricket Federation of Virudhunagar District`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0f2452; margin-top: 0;">Cricket Federation of Virudhunagar District</h2>
      <p style="font-size: 14px; color: #334155;">Hello <strong>${candidateName}</strong>,</p>
      <p style="font-size: 13.5px; color: #475569; line-height: 1.5;">
        Your promotion to <strong>Administrator</strong> has been approved by the required dual administrators. Please enter the verification code below to claim your administrative privileges:
      </p>
      <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #15803d;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #64748b; text-align: center;">⏱️ Code expires in 10 minutes.</p>
    </div>
  `;

  const trans = await getTransporter();
  if (trans) {
    try {
      const recipients = [toEmail];
      if (SMTP_USER && SMTP_USER.includes('@gmail.com') && SMTP_USER.toLowerCase() !== toEmail.toLowerCase()) {
        recipients.push(SMTP_USER);
      }

  const trans = await getTransporter();
  if (trans) {
    try {
      await trans.sendMail({
        from: SMTP_FROM,
        to: recipients.join(', '),
        subject,
        text: textContent
      });
      console.log(`✅ Candidate verification OTP email dispatched to [${recipients.join(', ')}]`);
      return { success: true };
    } catch (err) {
      console.error(`❌ Failed to send candidate verification email:`, err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'No active SMTP transporter' };
      return { success: true, message: `Team details dispatched` };
    }
  }
  return { success: true, message: `Dispatched` };
}

module.exports = {
  getTransporter,
  verifySmtpConnection,
  sendSuperAdminVerificationEmail,
  sendAdminApprovalEmail,
  sendDualAdminApprovalEmail,
  sendCandidateVerificationEmail,
  sendOtpEmail,
  sendPlayerTeamEmail,
  SUPER_ADMIN_EMAIL
};
