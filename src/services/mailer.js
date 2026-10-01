const nodemailer = require('nodemailer');
const config = require('../config');
const Resume = require('../models/Resume');

// Two ways to deliver the same message, picked by MAIL_PROVIDER:
//   smtp      — Gmail SMTP with an App Password (ports 465/587)
//   gmail-api — Gmail REST API over HTTPS (port 443). Use this on hosts that
//               block outbound SMTP, such as Render's free tier.
// In both cases nodemailer builds the MIME message, so attachments and
// headers are identical whichever provider sends it.

const smtpTransporter =
  config.mailProvider === 'smtp'
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      })
    : null;

// Builds the raw RFC 822 message without sending it.
const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const REQUEST_TIMEOUT_MS = 30_000;
let cachedToken = null; // { value, expiresAt }

async function getGmailAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.gmail.clientId,
      client_secret: config.gmail.clientSecret,
      refresh_token: config.gmail.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant = refresh token revoked/expired: re-run `npm run gmail:auth`
    throw new Error(`Gmail auth failed (${body.error || res.status}): ${body.error_description || 'no details'}`);
  }
  // Refresh a minute early so a token never expires mid-request.
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function sendViaGmailApi(message) {
  const { message: raw, messageId } = await composer.sendMail(message);
  const token = await getGmailAccessToken();
  const res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: raw.toString('base64url') }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail API send failed (HTTP ${res.status}): ${body.error?.message || 'no details'}`);
  return { messageId, gmailId: body.id };
}

// Checks credentials before a batch starts, so a bad password/token fails
// once up front instead of once per contact.
async function verifyMailer() {
  if (smtpTransporter) return smtpTransporter.verify();
  return getGmailAccessToken();
}

// Loads the current resume from MongoDB. Callers fetch it once per batch (or
// per bot message) and pass it to sendMail, so an upload takes effect on the
// very next send.
async function getResumeAttachment() {
  const resume = await Resume.findOne({ name: 'default' });
  if (!resume) throw new Error('No resume in MongoDB. Run: npm run resume:upload -- <path-to-resume.pdf>');
  return { filename: resume.filename, content: Buffer.from(resume.data), contentType: resume.contentType };
}

async function sendMail({ to, subject, html, text }, resumeAttachment) {
  const message = {
    from: `"${config.mailFromName}" <${config.mailUser}>`,
    to,
    subject,
    html,
    text,
    attachments: [resumeAttachment],
  };
  return smtpTransporter ? smtpTransporter.sendMail(message) : sendViaGmailApi(message);
}

module.exports = { sendMail, getResumeAttachment, verifyMailer };
