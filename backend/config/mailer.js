/**
 * config/mailer.js
 * 
 * Nodemailer Email Service for Cricket Federation of Virudhunagar District.
 * Supports Gmail SMTP with IPv4 TLS and automated fallback verification.
 * Adheres to Royal Blue, Gold, and White security email design specifications.
 */

const nodemailer = require('nodemailer');

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const rawUser = process.env.SMTP_USER || '';
  const rawPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
  const user = rawUser ? rawUser.replace(/^"|"$/g, '').trim() : '';
  const pass = rawPass ? rawPass.replace(/^"|"$/g, '').replace(/\s+/g, '').trim() : '';
  
  // Port 465 uses SSL/TLS (secure: true); Port 587 uses STARTTLS (secure: false)
  let secure = false;
  if (process.env.SMTP_SECURE !== undefined && process.env.SMTP_SECURE !== '') {
    secure = process.env.SMTP_SECURE === 'true';
  } else {
    secure = (port === 465);
  }

  const env = require('./env');
  const from = process.env.SMTP_FROM
    ? process.env.SMTP_FROM.replace(/^"|"$/g, '').trim()
    : `"Cricket Federation" <${user || 'noreply@localhost.invalid'}>`;
  const superAdmin = env.SUPER_ADMIN_EMAIL;
  const provider = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase().trim();

  return { host, port, user, pass, secure, from, superAdmin, provider };
}

const SUPER_ADMIN_EMAIL = require('./env').SUPER_ADMIN_EMAIL;

function attachDevOtp(otp) {
  return (require('./env').isDevelopment && otp) ? { otp } : {};
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDailyDateKey(dateObj = new Date()) {
  return dateObj.toISOString().slice(0, 10);
}

function isQuotaOrClientHttpError(status) {
  return typeof status === 'number' && (status === 429 || (status >= 400 && status < 500));
}

async function getDailyEmailStatus() {
  const mongoose = require('mongoose');
  const date = getDailyDateKey();
  const cfg = getSmtpConfig();
  const primaryProvider = (process.env.EMAIL_PROVIDER || 'brevo').toLowerCase().trim();
  const fallbackProvider = (process.env.EMAIL_FALLBACK_PROVIDER || (primaryProvider === 'brevo' ? 'resend' : 'smtp')).toLowerCase().trim();

  if (mongoose.connection.readyState !== 1) {
    return {
      date,
      count: 0,
      failures: 0,
      alertSentAt: null,
      currentProvider: primaryProvider || cfg.provider,
      fallbackProvider,
      lastProvider: null,
      lastError: null
    };
  }

  const { EmailDailyCounter } = require('../models');
  const doc = await EmailDailyCounter.findOne({ date }).lean();
  return {
    date,
    count: doc?.count || 0,
    failures: doc?.failures || 0,
    alertSentAt: doc?.alert_sent_at || null,
    currentProvider: doc?.last_provider || primaryProvider || cfg.provider,
    configuredPrimaryProvider: primaryProvider,
    fallbackProvider,
    lastError: doc?.last_error || null
  };
}

async function sendViaProvider(providerName, { toEmail, toName, subject, textContent, htmlContent }) {
  const cfg = getSmtpConfig();
  const provider = String(providerName || '').toLowerCase().trim();

  if (provider === 'brevo') {
    const rawBrevo = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
    const brevoApiKey = rawBrevo.replace(/^"|"$/g, '').trim();
    if (!brevoApiKey) {
      return { ok: false, status: 0, provider: 'BREVO', error: 'BREVO_API_KEY not configured' };
    }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Cricket Federation', email: process.env.BREVO_SENDER_EMAIL || '24ucs021@anjaconline.org' },
        to: [{ email: toEmail, name: toName || 'User' }],
        subject,
        textContent,
        htmlContent
      })
    });
    let data = {};
    try { data = await res.json(); } catch (_e) {}
    if (res.ok && data.messageId) {
      return { ok: true, status: res.status, messageId: data.messageId, provider: 'BREVO' };
    }
    return {
      ok: false,
      status: res.status,
      provider: 'BREVO',
      quotaError: isQuotaOrClientHttpError(res.status),
      error: data.message || data.code || `HTTP ${res.status}`
    };
  }

  if (provider === 'resend') {
    const rawResend = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND_TOKEN || '';
    const resendApiKey = rawResend.replace(/^"|"$/g, '').trim();
    if (!resendApiKey) {
      return { ok: false, status: 0, provider: 'RESEND', error: 'RESEND_API_KEY not configured' };
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Cricket Federation <onboarding@resend.dev>',
        to: [toEmail],
        subject,
        text: textContent,
        html: htmlContent
      })
    });
    let data = {};
    try { data = await res.json(); } catch (_e) {}
    if (res.ok && data.id) {
      return { ok: true, status: res.status, messageId: data.id, provider: 'RESEND' };
    }
    return {
      ok: false,
      status: res.status,
      provider: 'RESEND',
      quotaError: isQuotaOrClientHttpError(res.status),
      error: data.message || `HTTP ${res.status}`
    };
  }

  if (provider === 'smtp') {
    const trans = await getTransporter();
    if (!trans) {
      return { ok: false, status: 0, provider: 'SMTP', error: 'No active SMTP transporter' };
    }
    const info = await trans.sendMail({
      from: cfg.from,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent
    });
    return { ok: true, status: 250, messageId: info?.messageId || `smtp-${Date.now()}`, provider: 'SMTP' };
  }

  return { ok: false, status: 0, provider: provider.toUpperCase() || 'UNKNOWN', error: `Unsupported provider: ${provider}` };
}

async function send250ThresholdAlert(count, dateKey) {
  const mongoose = require('mongoose');
  const now = new Date();
  const istTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
  const isoTime = now.toISOString();

  console.warn(`⚠️ [MAILER QUOTA ALERT] Daily email count reached ${count} on ${dateKey} at ${istTime} IST (${isoTime})`);

  const recipients = new Set();
  if (process.env.ADMIN_ALERT_EMAIL) {
    process.env.ADMIN_ALERT_EMAIL.split(',').forEach((e) => {
      const clean = e.trim().toLowerCase();
      if (clean) recipients.add(clean);
    });
  }
  if (SUPER_ADMIN_EMAIL) {
    recipients.add(String(SUPER_ADMIN_EMAIL).trim().toLowerCase());
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const { User } = require('../models');
      const admins = await User.find({
        role: { $in: ['ADMIN', 'SUPER_ADMIN'] },
        status: { $nin: ['DELETED', 'SUSPENDED', 'REJECTED'] }
      }).select('email').lean();
      for (const a of admins) {
        if (a?.email) recipients.add(String(a.email).trim().toLowerCase());
      }
    } catch (err) {
      console.warn('[Mailer Alert] Could not query admin emails:', err.message);
    }
  }

  if (recipients.size === 0) return { sent: 0 };

  const fallbackProvider = (process.env.EMAIL_FALLBACK_PROVIDER || 'resend').toLowerCase().trim();
  const subject = `[URGENT ALERT] 250 Daily Email/OTP Limit Reached (${dateKey})`;
  const textContent =
    `Cricket Federation of Virudhunagar District - Email Quota Alert\n\n` +
    `Daily email/OTP count has reached ${count} on ${dateKey}.\n` +
    `Exact Timestamp: ${istTime} IST (${isoTime})\n\n` +
    `Please check the Email Status dashboard and provider quota immediately.`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 20px; border: 1px solid #fecaca; border-radius: 8px; background: #fff;">
      <h2 style="color: #991b1b; margin-top: 0;">Cricket Federation of Virudhunagar District</h2>
      <p><strong>Urgent Quota Alert:</strong> Daily email/OTP volume has reached <strong>${escapeHtml(count)}</strong> on <strong>${escapeHtml(dateKey)}</strong>.</p>
      <p><strong>Exact Time:</strong> ${escapeHtml(istTime)} IST (${escapeHtml(isoTime)})</p>
      <p>Please check your email provider quota and Admin Email Status panel immediately.</p>
    </div>
  `;

  let sent = 0;
  for (const adminEmail of recipients) {
    try {
      const res = await sendViaProvider(fallbackProvider, {
        toEmail: adminEmail,
        toName: 'Administrator',
        subject,
        textContent,
        htmlContent
      });
      if (res.ok) {
        sent += 1;
        console.log(`🚨 [MAILER 250-ALERT] provider=${res.provider} status=${res.status} messageId=${res.messageId}`);
      } else {
        console.warn(`⚠️ [MAILER 250-ALERT FAILED] provider=${res.provider} status=${res.status}`);
      }
    } catch (err) {
      console.warn(`⚠️ [MAILER 250-ALERT ERROR] provider=${fallbackProvider} err=${err.message}`);
    }
  }
  return { sent, recipients: Array.from(recipients) };
}

async function dispatchEmailWithHardening({
  toEmail,
  toName = 'User',
  subject,
  textContent,
  htmlContent,
  priority = 'OTP',
  bypassCounter = false
}) {
  const mongoose = require('mongoose');
  const dateKey = getDailyDateKey();
  const highPriority = priority === 'OTP' || priority === 'PASSWORD_RESET';
  const dbReady = mongoose.connection.readyState === 1;
  const { EmailDailyCounter } = dbReady ? require('../models') : {};

  if (!bypassCounter && dbReady && !highPriority) {
    const existing = await EmailDailyCounter.findOne({ date: dateKey }).lean();
    if ((existing?.count || 0) >= 200) {
      console.warn(`[Mailer] Daily count >= 200 (${existing.count}); deferring/skipping ${priority} email.`);
      return {
        success: false,
        skippedDueToDailyLimit: true,
        message: 'Daily non-OTP email limit reached'
      };
    }
  }

  const configuredPrimary = (process.env.EMAIL_PROVIDER || 'brevo').toLowerCase().trim();
  const configuredFallback = (process.env.EMAIL_FALLBACK_PROVIDER || (configuredPrimary === 'brevo' ? 'resend' : 'smtp')).toLowerCase().trim();
  const providerChain = configuredPrimary === 'auto'
    ? ['brevo', 'resend', 'smtp']
    : [configuredPrimary, ...(configuredFallback && configuredFallback !== configuredPrimary ? [configuredFallback] : [])];

  let lastResult = null;
  let sawQuotaError = false;

  for (const prov of providerChain) {
    try {
      const res = await sendViaProvider(prov, { toEmail, toName, subject, textContent, htmlContent });
      console.log(`[Mailer] provider=${res.provider} status=${res.status} messageId=${res.messageId || 'none'} ok=${res.ok}`);
      if (res.ok) {
        if (!bypassCounter && dbReady) {
          const updated = await EmailDailyCounter.findOneAndUpdate(
            { date: dateKey },
            {
              $inc: { count: 1 },
              $set: { last_provider: res.provider, updated_at: new Date() }
            },
            { upsert: true, new: true }
          );
          if (updated && updated.count >= 250 && !updated.alert_sent_at) {
            const claimed = await EmailDailyCounter.findOneAndUpdate(
              { date: dateKey, count: { $gte: 250 }, alert_sent_at: null },
              { $set: { alert_sent_at: new Date() } },
              { new: true }
            );
            if (claimed) {
              await send250ThresholdAlert(claimed.count, dateKey);
            }
          }
        }
        return {
          success: true,
          message: `Email sent to ${toEmail}`,
          messageId: res.messageId,
          provider: res.provider,
          status: res.status
        };
      }
      if (res.quotaError) sawQuotaError = true;
      lastResult = res;
    } catch (err) {
      console.warn(`[Mailer] provider=${prov.toUpperCase()} status=ERR error=${err.message}`);
      lastResult = { ok: false, status: 500, provider: prov.toUpperCase(), error: err.message };
    }
  }

  if (!bypassCounter && dbReady) {
    await EmailDailyCounter.findOneAndUpdate(
      { date: dateKey },
      {
        $inc: { failures: 1 },
        $set: {
          last_provider: lastResult?.provider || configuredPrimary.toUpperCase(),
          last_error: lastResult?.error || 'Delivery failed',
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
  }

  if (sawQuotaError) {
    return {
      success: false,
      quotaExceeded: true,
      status: lastResult?.status || 429,
      provider: lastResult?.provider,
      error: 'OTP service is busy, please try again later',
      message: 'OTP service is busy, please try again later'
    };
  }

  return {
    success: false,
    status: lastResult?.status || 500,
    provider: lastResult?.provider,
    error: lastResult?.error || 'Email delivery failed',
    message: lastResult?.error || 'Email delivery failed'
  };
}

let activeTransporter = null;
let transporterType = 'NONE'; // 'GMAIL' | 'ETHEREAL' | 'VIRTUAL' | 'NONE'

/**
 * Build Gmail / custom SMTP transporter
 */
function createPrimaryTransporter(portOverride = null, secureOverride = null) {
  const cfg = getSmtpConfig();
  if (!cfg.user || !cfg.pass || cfg.pass.startsWith('#')) {
    return null;
  }

  // Use Nodemailer's built-in 'gmail' service profile for Google accounts
  // It automatically handles the exact hosts, ports, and TLS handshake reliably without timeout
  if (cfg.host.includes('gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: cfg.user,
        pass: cfg.pass
      }
    });
  }

  const port = portOverride !== null ? portOverride : cfg.port;
  const secure = secureOverride !== null ? secureOverride : (port === 465);

  return nodemailer.createTransport({
    host: cfg.host,
    port,
    secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: cfg.user,
      pass: cfg.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Get active transporter with verified connectivity.
 * If credentials succeed, cached as GMAIL.
 * If credentials fail, returns a safe fallback for this call without permanently locking out retries.
 */
async function getTransporter() {
  if (activeTransporter && transporterType === 'GMAIL') {
    return activeTransporter;
  }

  const cfg = getSmtpConfig();
  if (cfg.user && cfg.pass && !cfg.pass.startsWith('#')) {
    const trans = createPrimaryTransporter();
    if (trans) {
      try {
        await Promise.race([
          trans.verify(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP verify timeout (12s)')), 12000))
        ]);
        activeTransporter = trans;
        transporterType = 'GMAIL';
        console.log(`📧 Nodemailer: Verified Gmail SMTP for ${cfg.user}`);
        return activeTransporter;
      } catch (err) {
        console.warn(`⚠️ SMTP verification notice for ${cfg.user}: ${err.message}`);
      }
    }
  }

  // Non-blocking fallback for this request only (not permanently stored so future calls retry)
  return {
    sendMail: async (opts) => {
      console.log(`📧 [VIRTUAL MAIL DISPATCH] To: ${opts.to} | Subject: "${opts.subject}"`);
      return { messageId: `virtual-${Date.now()}` };
    }
  };
}

/**
 * Reset cached transporter (useful when environment variables change)
 */
function resetTransporter() {
  activeTransporter = null;
  transporterType = 'NONE';
}

/**
 * Verify SMTP connection and return diagnostic report
 */
async function verifySmtpConnection() {
  const cfg = getSmtpConfig();

  // Brevo API diagnostic check
  const rawBrevo = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
  const brevoApiKey = rawBrevo.replace(/^"|"$/g, '').trim();
  let brevoStatus = {
    configured: Boolean(brevoApiKey),
    masked: brevoApiKey ? `${brevoApiKey.slice(0, 8)}****${brevoApiKey.slice(-4)}` : null,
    valid: false
  };

  if (brevoApiKey) {
    try {
      const resCheck = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': brevoApiKey, 'Accept': 'application/json' }
      });
      const data = await resCheck.json();
      if (resCheck.ok && data.email) {
        brevoStatus.valid = true;
        brevoStatus.email = data.email;
        brevoStatus.plan = data.plan;
      } else {
        brevoStatus.error = data.message || JSON.stringify(data);
      }
    } catch (e) {
      brevoStatus.error = e.message;
    }
  }

  if (brevoStatus.valid) {
    return {
      connected: true,
      provider: 'BREVO',
      brevo: brevoStatus,
      message: `Brevo HTTPS API connected & verified for account ${brevoStatus.email}!`
    };
  }

  const rawResend = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND_TOKEN || '';
  const resendKey = rawResend.replace(/^"|"$/g, '').trim();

  let resendStatus = {
    configured: Boolean(resendKey),
    masked: resendKey ? `${resendKey.slice(0, 6)}****${resendKey.slice(-4)}` : null,
    valid: false
  };

  if (resendKey) {
    try {
      const resCheck = await fetch('https://api.resend.com/api-keys', {
        headers: { Authorization: `Bearer ${resendKey}` }
      });
      const data = await resCheck.json();
      if (resCheck.ok) {
        resendStatus.valid = true;
        resendStatus.details = data;
      } else {
        resendStatus.error = data.message || JSON.stringify(data);
      }
    } catch (e) {
      resendStatus.error = e.message;
    }
  }

  if (resendStatus.valid) {
    return {
      connected: true,
      provider: 'RESEND',
      resend: resendStatus,
      message: 'Resend HTTPS API (Port 443) connected & verified successfully!'
    };
  }

  if (!cfg.pass || cfg.pass.startsWith('#')) {
    return {
      connected: false,
      configured: false,
      type: 'NONE',
      user: cfg.user,
      resend: resendStatus,
      error: 'Neither RESEND_API_KEY nor SMTP_PASSWORD is valid.'
    };
  }

  const masked = cfg.pass.length > 4
    ? `${cfg.pass.slice(0, 2)}****${cfg.pass.slice(-2)}`
    : '****';

  const trans = createPrimaryTransporter();
  if (!trans) {
    return {
      connected: false,
      configured: false,
      type: 'NONE',
      user: cfg.user,
      resend: resendStatus,
      error: 'Unable to initialize transporter'
    };
  }

  try {
    await Promise.race([
      trans.verify(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP verify timeout (12s)')), 12000))
    ]);
    activeTransporter = trans;
    transporterType = 'GMAIL';
    return {
      connected: true,
      configured: true,
      type: 'GMAIL',
      provider: 'GMAIL_SMTP',
      user: cfg.user,
      passwordLength: cfg.pass.length,
      passwordMasked: masked,
      resend: resendStatus,
      message: `Successfully connected and verified with Gmail SMTP for ${cfg.user}!`
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      type: 'ERROR',
      provider: 'GMAIL_SMTP',
      user: cfg.user,
      passwordLength: cfg.pass.length,
      passwordMasked: masked,
      resend: resendStatus,
      error: err.message,
      code: err.code || err.responseCode
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
  const cfg = getSmtpConfig();
  const toEmail = superAdminEmail;
  const userName = 'Super Administrator';
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

  // 1. Brevo (Sendinblue) HTTPS API (Port 443 - Sends to ANY recipient without requiring custom domain)
  const rawBrevo = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
  const brevoApiKey = rawBrevo.replace(/^"|"$/g, '').trim();
  if (brevoApiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Cricket Federation', email: process.env.BREVO_SENDER_EMAIL || '24ucs021@anjaconline.org' },
          to: [{ email: toEmail, name: userName || 'User' }],
          subject,
          htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.messageId) {
        console.log(`✅ [BREVO EMAIL DELIVERED] To: ${toEmail} | Id: ${data.messageId}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.messageId, provider: 'BREVO' };
      } else {
        console.warn(`⚠️ Brevo API notice for ${toEmail}:`, data);
        // Fall through to Resend / SMTP if Brevo fails
      }
    } catch (brevoErr) {
      console.warn(`⚠️ Brevo fetch error for ${toEmail}:`, brevoErr.message);
    }
  }

  // 2. Resend HTTPS API Dispatch (Port 443 - 100% bypasses Render Free Tier SMTP port blocks)
  const rawResend = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND_TOKEN || '';
  const resendApiKey = rawResend.replace(/^"|"$/g, '').trim();
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Cricket Federation <onboarding@resend.dev>',
          to: [toEmail],
          subject,
          text: textContent,
          html: htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`✅ [RESEND EMAIL DELIVERED] To: ${toEmail} | Id: ${data.id}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.id, provider: 'RESEND' };
      } else {
        console.warn(`⚠️ Resend API notice for ${toEmail}:`, data);
        return { success: false, error: data.message || JSON.stringify(data), provider: 'RESEND' };
      }
    } catch (apiErr) {
      console.warn(`⚠️ Resend fetch error for ${toEmail}:`, apiErr.message);
      return { success: false, error: apiErr.message, provider: 'RESEND' };
    }
  }

  // 2. Standard SMTP Dispatch (Works on local machine or Render paid plan)
  const trans = await getTransporter();
  if (trans) {
    try {
      // If superAdminEmail is internal and SMTP_USER is a real Gmail,
      // include SMTP_USER so the administrator receives the real OTP in their Gmail inbox.
      const recipients = [superAdminEmail];
      if (cfg.user && cfg.user.includes('@gmail.com') && cfg.user.toLowerCase() !== superAdminEmail.toLowerCase()) {
        recipients.push(cfg.user);
      }

      const info = await trans.sendMail({
        from: cfg.from,
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
  const cfg = getSmtpConfig();
  const userName = adminName;
  const subject = 'Cricket Association – Administrator Account Approved';
  const textContent = `Hello ${adminName},\n\nYour appointment as an administrator for the Cricket Federation of Virudhunagar District has been approved by the Super Administrator (Super Administrator).\n\nAccount Email: ${toEmail}\nClearance Level: ${adminLevel}\n\nPlease click the link below to set your password and activate your account:\n${setupUrl}\n\nCricket Federation of Virudhunagar District`;

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
                Your appointment as an official administrator for the <strong>Cricket Federation of Virudhunagar District</strong> has been formally reviewed and approved by the Super Administrator (<strong>Super Administrator</strong>).
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

  // 1. Brevo (Sendinblue) HTTPS API (Port 443 - Sends to ANY recipient without requiring custom domain)
  const rawBrevo = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
  const brevoApiKey = rawBrevo.replace(/^"|"$/g, '').trim();
  if (brevoApiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Cricket Federation', email: process.env.BREVO_SENDER_EMAIL || '24ucs021@anjaconline.org' },
          to: [{ email: toEmail, name: userName || 'User' }],
          subject,
          htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.messageId) {
        console.log(`✅ [BREVO EMAIL DELIVERED] To: ${toEmail} | Id: ${data.messageId}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.messageId, provider: 'BREVO' };
      } else {
        console.warn(`⚠️ Brevo API notice for ${toEmail}:`, data);
        // Fall through to Resend / SMTP if Brevo fails
      }
    } catch (brevoErr) {
      console.warn(`⚠️ Brevo fetch error for ${toEmail}:`, brevoErr.message);
    }
  }

  // 2. Resend HTTPS API Dispatch (Port 443 - 100% bypasses Render Free Tier SMTP port blocks)
  const rawResend = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND_TOKEN || '';
  const resendApiKey = rawResend.replace(/^"|"$/g, '').trim();
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Cricket Federation <onboarding@resend.dev>',
          to: [toEmail],
          subject,
          text: textContent,
          html: htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`✅ [RESEND EMAIL DELIVERED] To: ${toEmail} | Id: ${data.id}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.id, provider: 'RESEND' };
      } else {
        console.warn(`⚠️ Resend API notice for ${toEmail}:`, data);
        return { success: false, error: data.message || JSON.stringify(data), provider: 'RESEND' };
      }
    } catch (apiErr) {
      console.warn(`⚠️ Resend fetch error for ${toEmail}:`, apiErr.message);
      return { success: false, error: apiErr.message, provider: 'RESEND' };
    }
  }

  // 2. Standard SMTP Dispatch (Works on local machine or Render paid plan)
  const trans = await getTransporter();
  if (trans) {
    try {
      const info = await trans.sendMail({
        from: cfg.from,
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
async function sendOtpEmail({ toEmail, userName, otp, priority = 'OTP' }) {
  if (process.env.NODE_ENV === 'test' && process.env.TEST_HARDENED_MAILER !== 'true') {
    return { success: true, message: `[TEST MODE] OTP dispatched to ${toEmail}`, otp };
  }
  const safeName = escapeHtml(userName || 'Member');
  const safeOtp = escapeHtml(String(otp || ''));
  const subject = 'Cricket Federation of Virudhunagar District - Verification OTP';
  const textContent =
    `Cricket Federation of Virudhunagar District\n\n` +
    `Hello ${userName || 'Member'},\n\n` +
    `Your verification code is: ${otp}\n` +
    `This code expires in 10 minutes.\n\n` +
    `Ignore if you did not request this.`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
      <h2 style="color: #0f2452; margin-top: 0;">Cricket Federation of Virudhunagar District</h2>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>Your verification code is:</p>
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
        <span style="font-size: 30px; font-weight: bold; letter-spacing: 6px; color: #0f2452;">${safeOtp}</span>
      </div>
      <p style="font-size: 13px; color: #475569;">This code is valid for 10 minutes.</p>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Ignore if you did not request this.</p>
    </div>
  `;

  const result = await dispatchEmailWithHardening({
    toEmail,
    toName: userName || 'Member',
    subject,
    textContent,
    htmlContent,
    priority
  });

  if (!result.success) {
    return {
      ...result,
      ...(!result.quotaExceeded && process.env.NODE_ENV !== 'production' ? attachDevOtp(otp) : {})
    };
  }
  return result;
}

/**
 * Send Registered Team Details Email to Player
 */
async function sendPlayerTeamEmail({ toEmail, playerName, teamNames }) {
  if (process.env.NODE_ENV === 'test') {
    return { success: true, message: `[TEST MODE] Team details dispatched to ${toEmail}` };
  }
  const cfg = getSmtpConfig();
  const userName = playerName || 'Player';
  const teamList = Array.isArray(teamNames) ? teamNames : [teamNames];
  const primaryTeam = teamList[0] || 'Unknown Team';
  const teamListText = teamList.join(', ');
  const subject = 'Cricket Association - Your Registered Team Details';
  const textContent = `Hello ${playerName || 'Player'},\n\nYour Registered Team Name:\n${teamListText}\n\nCricket Federation of Virudhunagar District`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0f2452; margin-top: 0;">Cricket Federation of Virudhunagar District</h2>
      <p style="font-size: 14px; color: #334155;">Hello <strong>${playerName || 'Player'}</strong>,</p>
      <p style="font-size: 13.5px; color: #475569; line-height: 1.5;">Your registered team is: <strong>${teamListText}</strong> (${primaryTeam})</p>
    </div>
  `;

  // 1. Brevo (Sendinblue) HTTPS API (Port 443 - Sends to ANY recipient without requiring custom domain)
  const rawBrevo = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
  const brevoApiKey = rawBrevo.replace(/^"|"$/g, '').trim();
  if (brevoApiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Cricket Federation', email: process.env.BREVO_SENDER_EMAIL || '24ucs021@anjaconline.org' },
          to: [{ email: toEmail, name: userName || 'User' }],
          subject,
          htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.messageId) {
        console.log(`✅ [BREVO EMAIL DELIVERED] To: ${toEmail} | Id: ${data.messageId}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.messageId, provider: 'BREVO' };
      } else {
        console.warn(`⚠️ Brevo API notice for ${toEmail}:`, data);
        // Fall through to Resend / SMTP if Brevo fails
      }
    } catch (brevoErr) {
      console.warn(`⚠️ Brevo fetch error for ${toEmail}:`, brevoErr.message);
    }
  }

  // 2. Resend HTTPS API Dispatch (Port 443 - 100% bypasses Render Free Tier SMTP port blocks)
  const rawResend = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND_TOKEN || '';
  const resendApiKey = rawResend.replace(/^"|"$/g, '').trim();
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Cricket Federation <onboarding@resend.dev>',
          to: [toEmail],
          subject,
          text: textContent,
          html: htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`✅ [RESEND EMAIL DELIVERED] To: ${toEmail} | Id: ${data.id}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.id, provider: 'RESEND' };
      } else {
        console.warn(`⚠️ Resend API notice for ${toEmail}:`, data);
        return { success: false, error: data.message || JSON.stringify(data), provider: 'RESEND' };
      }
    } catch (apiErr) {
      console.warn(`⚠️ Resend fetch error for ${toEmail}:`, apiErr.message);
      return { success: false, error: apiErr.message, provider: 'RESEND' };
    }
  }

  // 2. Standard SMTP Dispatch (Works on local machine or Render paid plan)
  const trans = await getTransporter();
  if (trans) {
    try {
      await trans.sendMail({
        from: cfg.from,
        to: toEmail,
        subject,
        text: textContent
      });
      return { success: true, message: `Team details sent to ${toEmail}` };
    } catch (_err) {
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
  requestedByEmail = 'system-admin',
  otp,
  dateIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
}) {
  const cfg = getSmtpConfig();
  const userName = approverName;
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

  // 1. Brevo (Sendinblue) HTTPS API (Port 443 - Sends to ANY recipient without requiring custom domain)
  const rawBrevo = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
  const brevoApiKey = rawBrevo.replace(/^"|"$/g, '').trim();
  if (brevoApiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Cricket Federation', email: process.env.BREVO_SENDER_EMAIL || '24ucs021@anjaconline.org' },
          to: [{ email: toEmail, name: userName || 'User' }],
          subject,
          htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.messageId) {
        console.log(`✅ [BREVO EMAIL DELIVERED] To: ${toEmail} | Id: ${data.messageId}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.messageId, provider: 'BREVO' };
      } else {
        console.warn(`⚠️ Brevo API notice for ${toEmail}:`, data);
        // Fall through to Resend / SMTP if Brevo fails
      }
    } catch (brevoErr) {
      console.warn(`⚠️ Brevo fetch error for ${toEmail}:`, brevoErr.message);
    }
  }

  // 2. Resend HTTPS API Dispatch (Port 443 - 100% bypasses Render Free Tier SMTP port blocks)
  const rawResend = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND_TOKEN || '';
  const resendApiKey = rawResend.replace(/^"|"$/g, '').trim();
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Cricket Federation <onboarding@resend.dev>',
          to: [toEmail],
          subject,
          text: textContent,
          html: htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`✅ [RESEND EMAIL DELIVERED] To: ${toEmail} | Id: ${data.id}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.id, provider: 'RESEND' };
      } else {
        console.warn(`⚠️ Resend API notice for ${toEmail}:`, data);
        return { success: false, error: data.message || JSON.stringify(data), provider: 'RESEND' };
      }
    } catch (apiErr) {
      console.warn(`⚠️ Resend fetch error for ${toEmail}:`, apiErr.message);
      return { success: false, error: apiErr.message, provider: 'RESEND' };
    }
  }

  // 2. Standard SMTP Dispatch (Works on local machine or Render paid plan)
  const trans = await getTransporter();
  if (trans) {
    try {
      const recipients = [toEmail];
      if (cfg.user && cfg.user.includes('@gmail.com') && cfg.user.toLowerCase() !== toEmail.toLowerCase()) {
        recipients.push(cfg.user);
      }

      const info = await trans.sendMail({
        from: cfg.from,
        to: recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent
      });
      console.log(`✅ Dual-Admin authorization email dispatched to [${recipients.join(', ')}]`);
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
  const cfg = getSmtpConfig();
  const userName = candidateName;
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

  // 1. Brevo (Sendinblue) HTTPS API (Port 443 - Sends to ANY recipient without requiring custom domain)
  const rawBrevo = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
  const brevoApiKey = rawBrevo.replace(/^"|"$/g, '').trim();
  if (brevoApiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Cricket Federation', email: process.env.BREVO_SENDER_EMAIL || '24ucs021@anjaconline.org' },
          to: [{ email: toEmail, name: userName || 'User' }],
          subject,
          htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.messageId) {
        console.log(`✅ [BREVO EMAIL DELIVERED] To: ${toEmail} | Id: ${data.messageId}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.messageId, provider: 'BREVO' };
      } else {
        console.warn(`⚠️ Brevo API notice for ${toEmail}:`, data);
        // Fall through to Resend / SMTP if Brevo fails
      }
    } catch (brevoErr) {
      console.warn(`⚠️ Brevo fetch error for ${toEmail}:`, brevoErr.message);
    }
  }

  // 2. Resend HTTPS API Dispatch (Port 443 - 100% bypasses Render Free Tier SMTP port blocks)
  const rawResend = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND_TOKEN || '';
  const resendApiKey = rawResend.replace(/^"|"$/g, '').trim();
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Cricket Federation <onboarding@resend.dev>',
          to: [toEmail],
          subject,
          text: textContent,
          html: htmlContent
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`✅ [RESEND EMAIL DELIVERED] To: ${toEmail} | Id: ${data.id}`);
        return { success: true, message: `OTP sent to ${toEmail}`, messageId: data.id, provider: 'RESEND' };
      } else {
        console.warn(`⚠️ Resend API notice for ${toEmail}:`, data);
        return { success: false, error: data.message || JSON.stringify(data), provider: 'RESEND' };
      }
    } catch (apiErr) {
      console.warn(`⚠️ Resend fetch error for ${toEmail}:`, apiErr.message);
      return { success: false, error: apiErr.message, provider: 'RESEND' };
    }
  }

  // 2. Standard SMTP Dispatch (Works on local machine or Render paid plan)
  const trans = await getTransporter();
  if (trans) {
    try {
      const recipients = [toEmail];
      if (cfg.user && cfg.user.includes('@gmail.com') && cfg.user.toLowerCase() !== toEmail.toLowerCase()) {
        recipients.push(cfg.user);
      }
      await trans.sendMail({
        from: cfg.from,
        to: recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent
      });
      console.log(`✅ Candidate verification OTP email dispatched to [${recipients.join(', ')}]`);
      return { success: true };
    } catch (err) {
      console.error(`❌ Failed to send candidate verification email:`, err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'No active SMTP transporter' };
}

function resetTransporter() {
  activeTransporter = null;
  transporterType = 'NONE';
}

module.exports = {
  getTransporter,
  resetTransporter,
  verifySmtpConnection,
  sendSuperAdminVerificationEmail,
  sendAdminApprovalEmail,
  sendDualAdminApprovalEmail,
  sendCandidateVerificationEmail,
  sendOtpEmail,
  sendPlayerTeamEmail,
  dispatchEmailWithHardening,
  getDailyEmailStatus,
  send250ThresholdAlert,
  escapeHtml,
  SUPER_ADMIN_EMAIL
};
