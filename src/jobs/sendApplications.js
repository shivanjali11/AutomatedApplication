const config = require('../config');
const EmailLog = require('../models/EmailLog');
const { readContacts } = require('../services/csvReader');
const { readContactsFromSheet } = require('../services/sheetReader');
const { getTemplate, render } = require('../services/templateService');
const { sendMail, getResumeAttachment, transporter } = require('../services/mailer');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let isRunning = false;
let lastRun = null; // summary of the most recent scheduled run, reported by the health check

// Adds new contacts to EmailLog as "pending"; existing ones are left untouched.
// Prefers the live Google Sheet (if configured) so new rows are picked up
// automatically without a manual CSV copy; falls back to the local CSV file
// if no sheet URL is set, or if the sheet fetch fails (e.g. briefly offline).
async function syncContacts() {
  let contacts;
  if (config.googleSheetUrl) {
    try {
      contacts = await readContactsFromSheet(config.googleSheetUrl);
      console.log(`[job] read ${contacts.length} contact(s) from Google Sheet`);
    } catch (err) {
      console.warn(`[job] Google Sheet fetch failed (${err.message}), falling back to local CSV`);
      contacts = readContacts(config.csvPath);
    }
  } else {
    contacts = readContacts(config.csvPath);
  }
  if (!contacts.length) return 0;

  const result = await EmailLog.bulkWrite(
    contacts.map((c) => ({
      updateOne: { filter: { email: c.email }, update: { $setOnInsert: c }, upsert: true },
    }))
  );
  return result.upsertedCount;
}

async function runSendJob({ dryRun = false } = {}) {
  if (isRunning) {
    console.log('[job] previous run still in progress, skipping');
    return;
  }
  isRunning = true;
  const run = { startedAt: new Date(), error: null };
  let sent = 0;
  let failed = 0;

  try {
    const added = await syncContacts();
    console.log(`[job] ${added} new contact(s) added`);

    const template = await getTemplate(config.templateName);
    const resume = await getResumeAttachment(); // loaded once per run; fails fast if none uploaded
    if (!dryRun) await transporter.verify();

    const batch = await EmailLog.find({
      $or: [{ status: 'pending' }, { status: 'failed', attempts: { $lt: config.maxAttempts } }],
    })
      .sort({ createdAt: 1 })
      .limit(config.batchSize);

    if (!batch.length) {
      console.log('[job] nothing to send');
      return;
    }
    console.log(`[job] sending ${batch.length} email(s)${dryRun ? ' (DRY RUN)' : ''}`);

    for (const [i, contact] of batch.entries()) {
      const data = { name: contact.name, company: contact.company, email: contact.email };
      const mail = {
        to: contact.email,
        subject: render(template.subject, data),
        html: render(template.html, data, { html: true }),
        text: render(template.text, data),
      };

      if (dryRun) {
        console.log(`\n--- to: ${mail.to}\n--- subject: ${mail.subject}\n${i === 0 ? mail.text : '(body omitted)'}`);
        continue;
      }

      try {
        const info = await sendMail(mail, resume);
        contact.set({ status: 'sent', sentAt: new Date(), messageId: info.messageId, lastError: undefined });
        sent++;
        console.log(`[job] ✓ ${contact.email}`);
      } catch (err) {
        contact.set({ status: 'failed', lastError: err.message });
        failed++;
        console.error(`[job] ✗ ${contact.email}: ${err.message}`);
      }
      contact.attempts += 1;
      await contact.save();

      if (i < batch.length - 1) await sleep(config.delayMs);
    }

    if (!dryRun) console.log(`[job] done — sent: ${sent}, failed: ${failed}`);
  } catch (err) {
    run.error = err.message;
    console.error('[job] run aborted:', err.message);
  } finally {
    Object.assign(run, { finishedAt: new Date(), sent, failed });
    if (!dryRun) lastRun = run;
    isRunning = false;
  }
}

function getJobStatus() {
  return { running: isRunning, lastRun };
}

module.exports = { runSendJob, getJobStatus };
