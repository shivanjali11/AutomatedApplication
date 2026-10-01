const nodemailer = require('nodemailer');
const config = require('../config');
const Resume = require('../models/Resume');

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

// Loads the current resume from MongoDB. Callers fetch it once per batch (or
// per bot message) and pass it to sendMail, so an upload takes effect on the
// very next send.
async function getResumeAttachment() {
  const resume = await Resume.findOne({ name: 'default' });
  if (!resume) throw new Error('No resume in MongoDB. Run: npm run resume:upload -- <path-to-resume.pdf>');
  return { filename: resume.filename, content: Buffer.from(resume.data), contentType: resume.contentType };
}

async function sendMail({ to, subject, html, text }, resumeAttachment) {
  return transporter.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.user}>`,
    to,
    subject,
    html,
    text,
    attachments: [resumeAttachment],
  });
}

module.exports = { transporter, sendMail, getResumeAttachment };
