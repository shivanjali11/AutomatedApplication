// Telegram bot: message it an HR email (or several, one per line / comma-separated)
// and it sends your application email (with resume) to each, right from your phone.
//
// One-time setup:
//   1. Message @BotFather on Telegram -> /newbot -> follow prompts -> copy the token
//      into TELEGRAM_BOT_TOKEN in .env
//   2. Run `npm run bot:telegram` with ALLOWED_TELEGRAM_CHAT_ID left blank —
//      it starts in "setup mode" and just tells you your chat id when you
//      message it. Put that id into ALLOWED_TELEGRAM_CHAT_ID in .env.
//   3. Restart `npm run bot:telegram` — it now only responds to you, and can send.

const { Telegraf } = require('telegraf');
const config = require('../config');
const { connectDB, disconnectDB } = require('../db');
const EmailLog = require('../models/EmailLog');
const { getTemplate, render } = require('../services/templateService');
const { sendMail, getResumeAttachment, transporter } = require('../services/mailer');
const { EMAIL_RE } = require('../services/csvReader');

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedChatId = process.env.ALLOWED_TELEGRAM_CHAT_ID;
if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN in .env — get one from @BotFather on Telegram');

// Telegraf kills any handler that runs past 90s by default — far too short
// when sending several emails with a multi-minute anti-spam delay between each.
const bot = new Telegraf(token, { handlerTimeout: 60 * 60 * 1000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Any handler error not caught locally lands here instead of crashing the bot.
bot.catch((err, ctx) => {
  console.error(`[bot] unhandled error for update ${ctx.update?.update_id}:`, err);
});

// A reply failing (e.g. a network blip during a multi-minute send loop) must
// never crash the whole bot — log it and keep going instead.
async function safeReply(ctx, text) {
  try {
    await ctx.reply(text);
  } catch (err) {
    console.error('[bot] failed to send Telegram reply (continuing anyway):', err.message);
  }
}

async function sendToEmail(email) {
  const template = await getTemplate(config.templateName);
  const resume = await getResumeAttachment(); // latest upload from MongoDB
  const existing = await EmailLog.findOne({ email });
  const data = { name: existing?.name, company: existing?.company, email };
  const mail = {
    to: email,
    subject: render(template.subject, data),
    html: render(template.html, data, { html: true }),
    text: render(template.text, data),
  };
  const info = await sendMail(mail, resume);
  await EmailLog.findOneAndUpdate(
    { email },
    { $set: { status: 'sent', sentAt: new Date(), messageId: info.messageId, lastError: undefined }, $inc: { attempts: 1 } },
    { upsert: true }
  );
  return info;
}

if (!allowedChatId) {
  // Setup mode: this bot can send real email from your Gmail account, so it
  // must not act on anyone's messages until it's locked to your chat id.
  bot.on('text', (ctx) => {
    console.log(`[bot:setup] message from chat id ${ctx.chat.id}`);
    ctx.reply(
      `Setup mode — your chat id is: ${ctx.chat.id}\n\n` +
        `Add this to ALLOWED_TELEGRAM_CHAT_ID in .env, then restart the bot. ` +
        `Until then, no emails will be sent.`
    );
  });
  console.log('[bot] running in SETUP MODE — no ALLOWED_TELEGRAM_CHAT_ID set yet');
} else {
  // Locked mode: only the owner's chat can trigger sends.
  bot.use((ctx, next) => {
    const chatId = String(ctx.chat?.id);
    if (chatId !== String(allowedChatId)) {
      console.warn(`[bot] ignored message from unauthorized chat ${chatId}`);
      return; // silently ignore anyone else
    }
    return next();
  });

  bot.start((ctx) =>
    ctx.reply(
      "👋 Send me one or more HR email addresses (one per line, or comma-separated) and I'll send your application email with resume to each.\n\n" +
        'Commands:\n/stats — sent/pending counts'
    )
  );

  bot.command('stats', async (ctx) => {
    const counts = await EmailLog.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const text = counts.map((c) => `${c._id}: ${c.n}`).join('\n') || 'No contacts tracked yet.';
    await safeReply(ctx, text);
  });

  bot.on('text', async (ctx) => {
    try {
      const raw = ctx.message.text.trim();
      if (raw.startsWith('/')) return; // unrecognized command

      const emails = [...new Set(raw.split(/[\n,]+/).map((s) => s.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
      if (!emails.length) {
        await safeReply(ctx, "That doesn't look like an email address. Send one or more HR emails (one per line or comma-separated).");
        return;
      }

      for (const [i, email] of emails.entries()) {
        try {
          await sendToEmail(email);
          await safeReply(ctx, `✅ Sent to ${email}`);
        } catch (err) {
          console.error(`[bot] send failed for ${email}:`, err.message);
          await safeReply(ctx, `❌ Failed to send to ${email}: ${err.message}`);
        }
        // same spam-safety pacing as the scheduled batch job, only when sending multiple at once
        if (i < emails.length - 1) await sleep(config.delayMs);
      }
    } catch (err) {
      // last-resort net: nothing above should throw uncaught, but if something
      // does, log it and keep the bot alive rather than let Telegraf's own
      // handling of it destabilize the process.
      console.error('[bot] unexpected error handling message:', err);
      await safeReply(ctx, `❌ Something went wrong: ${err.message}`);
    }
  });

  console.log(`[bot] running LOCKED to chat id ${allowedChatId}`);
}

(async () => {
  await connectDB();
  if (allowedChatId) await transporter.verify();
  await bot.launch();
  console.log('[bot] Telegram bot online (long-polling) — press Ctrl+C to stop');
})().catch((err) => {
  console.error('[bot] failed to start:', err.message);
  process.exit(1);
});

async function shutdown(signal) {
  console.log(`[bot] ${signal} received, shutting down`);
  try {
    bot.stop(signal);
  } catch {
    // not launched yet
  }
  await disconnectDB().catch(() => {});
  process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
process.on('unhandledRejection', (err) => console.error('[bot] unhandled rejection:', err));
