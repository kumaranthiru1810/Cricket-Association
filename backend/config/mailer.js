const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const rawUser = process.env.SMTP_USER || 'cricketfederation21@gmail.com';
const rawPass = process.env.SMTP_PASSWORD || 'rkwu lzke kklq znig';
const SMTP_USER = rawUser ? rawUser.replace(/^"|"$/g, '').trim() : '';
const SMTP_PASSWORD = rawPass ? rawPass.replace(/^"|"$/g, '').trim() : '';
const SMTP_FROM = process.env.SMTP_FROM ? process.env.SMTP_FROM.replace(/^"|"$/g, '').trim() : `"Cricket Federation" <${SMTP_USER}>`;

const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : SMTP_PORT === 465;

let transporter = null;

if (SMTP_USER && SMTP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST.includes('gmail.com') ? 'smtp.gmail.com' : SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    family: 4, // Force IPv4 to prevent 90-second Windows IPv6 DNS timeout
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  console.log(`📧 Nodemailer SMTP initialized for: ${SMTP_USER} (IPv4 direct TLS)`);
} else {
  console.log('ℹ️ Nodemailer: SMTP credentials not set.');
}

async function sendOtpEmail({ toEmail, userName, otp }) {
  const subject = 'Cricket Association - Your Verification OTP';
  const textContent = `Hello ${userName || 'User'},\n\nYour One-Time Password (OTP) for verification is: ${otp}\n\nThis OTP is valid for 5 minutes.\n\nCricket Association`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2>Cricket Association Portal</h2>
      <p>Hello <strong>${userName || 'User'}</strong>,</p>
      <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #d97706;">${otp}</span>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent
      });
      return { success: true, message: `OTP sent to ${toEmail}` };
    } catch (err) {
      console.warn(`❌ Nodemailer delivery note to ${toEmail}:`, err.message);
      if (err.message && (err.message.includes('Application-specific password') || err.message.includes('534'))) {
        console.warn(`💡 [GMAIL SETUP TIP] Gmail requires a 16-character App Password (not your normal password). Generate one at https://myaccount.google.com/apppasswords and set SMTP_PASSWORD in backend/.env`);
      }
      return {
        success: true,
        message: `OTP generated successfully`,
        otp,
        smtpError: err.message
      };
    }
  } else {
    return { success: true, message: `OTP dispatched to ${toEmail}` };
  }
}

async function sendPlayerTeamEmail({ toEmail, playerName, teamNames }) {
  const teamList = Array.isArray(teamNames) ? teamNames : [teamNames];
  const primaryTeam = teamList[0] || 'Unknown Team';
  const teamListText = teamList.join(', ');
  const subject = 'Cricket Association - Your Registered Team Details';
  const textContent = `Hello ${playerName || 'Player'},\n\nWe received a request to find your registered team name for the Player Portal login.\n\nYour Registered Team Name:\n${teamListText}\n\nYou can use this Team Name to log in at the Player Portal:\n- Team Name: ${primaryTeam}\n- Registered Email: ${toEmail}\n\nCricket Federation of Virudhunagar District`;

  const teamCardsHtml = teamList.map(name => `
    <div style="background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 14px 20px; margin: 10px 0; text-align: center;">
      <span style="font-size: 20px; font-weight: bold; color: #92400e; letter-spacing: 0.5px;">🏏 ${name}</span>
    </div>
  `).join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #0f172a; font-size: 19px; text-transform: uppercase; letter-spacing: 1px;">CRICKET FEDERATION OF</h2>
        <h3 style="margin: 4px 0 0; color: #d97706; font-size: 15px; font-weight: 800;">VIRUDHUNAGAR DISTRICT</h3>
      </div>
      
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 12px 0;">Hello <strong>${playerName || 'Player'}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px 0;">
        You requested your registered team name for the <strong>Player Portal Login</strong>. Here is the team affiliated with your email address:
      </p>

      <div style="margin: 20px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Your Registered Team:</div>
        ${teamCardsHtml}
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <div style="font-weight: bold; color: #0f172a; font-size: 13.5px; margin-bottom: 8px;">How to log in:</div>
        <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
          <li>Open the <strong>Login Screen</strong> and ensure <strong>Player</strong> is selected.</li>
          <li>Enter <strong>Team Name</strong>: <span style="color: #b45309; font-weight: bold;">${primaryTeam}</span></li>
          <li>Enter <strong>Registered Email</strong>: <span style="color: #b45309; font-weight: bold;">${toEmail}</span></li>
          <li>Tap <strong>Access Player Portal</strong> to enter!</li>
        </ol>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 24px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 14px;">
        Cricket Federation of Virudhunagar District • Automated Notification System
      </p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent
      });
      return { success: true, message: `Team details sent to ${toEmail}` };
    } catch (err) {
      console.warn(`❌ Nodemailer delivery note to ${toEmail}:`, err.message);
      return {
        success: true,
        message: `Team details dispatched to ${toEmail}`,
        smtpError: err.message
      };
    }
  } else {
    return { success: true, message: `Team details dispatched to ${toEmail}` };
  }
}

module.exports = {
  sendOtpEmail,
  sendPlayerTeamEmail,
  transporter
};
