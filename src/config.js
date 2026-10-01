require('dotenv').config({ quiet: true });

const required = ['MONGO_URI', 'SMTP_USER', 'SMTP_PASS'];
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
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: positiveInt('SMTP_PORT', 465),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.FROM_NAME || 'Shivanjali Kumari',
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
};
