require('dotenv').config();

const required = ['MONGO_URI', 'SMTP_USER', 'SMTP_PASS'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

module.exports = {
  mongoUri: process.env.MONGO_URI,
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
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
  batchSize: Number(process.env.BATCH_SIZE || 20),
  delayMs: Number(process.env.DELAY_MS || 60000),
  maxAttempts: Number(process.env.MAX_ATTEMPTS || 3),
};
