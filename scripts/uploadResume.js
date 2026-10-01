// Uploads (or replaces) the resume stored in MongoDB. The scheduler and the
// Telegram bot read it from there on every send, so no restart is needed.
//
// Usage:
//   npm run resume:upload -- ./path/to/New_Resume.pdf
//   npm run resume:upload            (uses RESUME_PATH from .env)

const fs = require('fs');
const path = require('path');
const { connectDB, disconnectDB } = require('../src/db');
const config = require('../src/config');
const Resume = require('../src/models/Resume');

const MAX_BYTES = 5 * 1024 * 1024; // comfortably under Gmail's attachment and MongoDB's document limits

(async () => {
  const filePath = path.resolve(process.argv[2] || config.resumePath);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const data = fs.readFileSync(filePath);
  if (data.subarray(0, 4).toString() !== '%PDF') throw new Error(`${filePath} is not a PDF`);
  if (data.length > MAX_BYTES) throw new Error(`Resume is ${(data.length / 1024 / 1024).toFixed(1)} MB — keep it under 5 MB`);

  await connectDB();
  const previous = await Resume.findOne({ name: 'default' }).select('filename size updatedAt').lean();
  await Resume.findOneAndUpdate(
    { name: 'default' },
    { name: 'default', filename: path.basename(filePath), contentType: 'application/pdf', data, size: data.length },
    { upsert: true }
  );

  if (previous) console.log(`[resume] replaced ${previous.filename} (${Math.round(previous.size / 1024)} KB, uploaded ${previous.updatedAt.toISOString()})`);
  console.log(`[resume] saved ${path.basename(filePath)} (${Math.round(data.length / 1024)} KB) to MongoDB — used from the next email onward`);
  await disconnectDB();
})().catch((err) => {
  console.error('[resume] upload failed:', err.message);
  process.exit(1);
});
