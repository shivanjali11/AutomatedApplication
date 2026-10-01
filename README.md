# AutoMailer

Sends job application emails (with resume attached) to HR contacts from a CSV, on a cron schedule.

## Setup
1. `npm install`
2. Edit `.env`: set `MONGO_URI` and `SMTP_PASS` (a Gmail **App Password**).
3. Upload your resume to MongoDB: `npm run resume:upload -- path/to/Resume.pdf`.
   To change it later, run the same command with the new PDF — the next email uses it, no restart needed.
4. Contacts source — either:
   - `GOOGLE_SHEET_URL` in `.env` (recommended): point it at your sheet (shared as "Anyone with the link: Viewer"). New rows you add there are picked up automatically on the next run — no copying needed.
   - or add rows to `data/hr_contacts.csv` directly (columns: `email,name,company` / `Email,HR Name,Company`; only `email` is required). Used as a fallback if no sheet URL is set, or if the sheet fetch fails.
5. `npm run seed` saves the email template to MongoDB.

## Run
- `npm run send:dry` shows what would be sent without sending anything
- `npm run send:now` sends one batch right now
- `npm start` starts the scheduler (checks the sheet every 5 minutes, per `CRON_SCHEDULE`)

Each contact is emailed only once (tracked in the `emaillogs` collection). Failed sends are retried up to `MAX_ATTEMPTS`.

## Telegram bot
Send an HR email from your phone and it goes out immediately — useful when you can't run the CLI during office hours.
1. Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN` in `.env`.
2. Leave `ALLOWED_TELEGRAM_CHAT_ID` blank and run `npm run bot:telegram`. Message your bot once — it replies with your chat id.
3. Put that id into `ALLOWED_TELEGRAM_CHAT_ID` in `.env`, restart `npm run bot:telegram`. It now only responds to you.
4. Message it one or more HR emails (one per line, or comma-separated) — it sends your application email with resume to each and confirms.

Keep `npm run bot:telegram` running in a terminal (or `pm2`) for it to respond while you're at work.
