require('dotenv').config({ quiet: true });

const MAIL_PROVIDERS = {
  smtp: ['SMTP_USER', 'SMTP_PASS'],
  'gmail-api': ['SMTP_USER', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
};
const mailProvider = process.env.MAIL_PROVIDER || 'smtp';
if (!MAIL_PROVIDERS[mailProvider]) {
  throw new Error(`Invalid MAIL_PROVIDER: "${mailProvider}" (expected one of: ${Object.keys(MAIL_PROVIDERS).join(', ')})`);
}

const required = ['MONGO_URI', ...MAIL_PROVIDERS[mailProvider]];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

// Fails fast on typos like BATCH_SIZE=2o instead of silently running with NaN.
function positiveInt(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid ${key}: "${raw}" (expected a non-negative integer)`);
  return n;
}

module.exports = {
  mongoUri: process.env.MONGO_URI,
  mailProvider,
  mailUser: process.env.SMTP_USER, // your Gmail address — the sender for both providers
  mailFromName: process.env.FROM_NAME || 'Shivanjali Kumari',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: positiveInt('SMTP_PORT', 465),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  csvPath: process.env.CSV_PATH || './data/hr_contacts.csv',
  googleSheetUrl: process.env.GOOGLE_SHEET_URL || '',
  resumePath: process.env.RESUME_PATH || './resume/Shivanjali_Resume.pdf',
  templateName: process.env.TEMPLATE_NAME || 'default',
  cronSchedule: process.env.CRON_SCHEDULE || '0 10 * * 1-5',
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  batchSize: positiveInt('BATCH_SIZE', 20),
  delayMs: positiveInt('DELAY_MS', 60000),
  maxAttempts: positiveInt('MAX_ATTEMPTS', 3),
  // Separate ports because the scheduler and the bot run as separate processes. 0 disables.
  healthPort: positiveInt('HEALTH_PORT', positiveInt('PORT', 3000)), // PORT is set by Render / Heroku-style hosts
  botHealthPort: positiveInt('BOT_HEALTH_PORT', 3001),
};
