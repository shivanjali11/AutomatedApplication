# AutoMailer

Sends job application emails (with resume attached) to HR contacts from a CSV, on a cron schedule.

## Setup
Requires Node.js 20.19+.

1. `npm ci --omit=dev`
2. `cp .env.example .env`, then set `MONGO_URI`, `SMTP_USER` and `SMTP_PASS` (a Gmail **App Password**). All options are documented in `.env.example`.
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

Keep `npm run bot:telegram` running for it to respond while you're at work (see Production below).

## Production
Run the scheduler and the bot under [pm2](https://pm2.keymetrics.io/) so they restart on crash and on reboot:
```
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup   # survive reboots
pm2 logs                  # tail both processes
```
### Health check
Both long-running processes expose `GET /health` (plain JSON, no auth). Point an uptime monitor or load balancer at it.

| Process | Default URL | Port setting |
|---|---|---|
| Scheduler (`npm start`) | `http://localhost:3000/health` | `HEALTH_PORT` |
| Telegram bot | `http://localhost:3001/health` | `BOT_HEALTH_PORT` |

It returns **200** when MongoDB is connected and **503** otherwise. The scheduler also reports its schedule, whether a job is running, and the last run's `sent`/`failed` counts and error. Set a port to `0` to disable it. `--once` runs don't start it.

Both processes shut down cleanly on SIGINT/SIGTERM. `.env`, `data/*.csv` and `resume/` are git-ignored, so contacts, credentials and your resume never get committed.
