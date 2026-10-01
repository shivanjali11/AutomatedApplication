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
- `npm start` starts **both** the scheduler (per `CRON_SCHEDULE`) and the Telegram bot in one command, restarting either if it crashes
- `npm run start:scheduler` / `npm run bot:telegram` start just one of them

Each contact is emailed only once (tracked in the `emaillogs` collection). Failed sends are retried up to `MAX_ATTEMPTS`.

## Telegram bot
Send an HR email from your phone and it goes out immediately — useful when you can't run the CLI during office hours.
1. Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN` in `.env`.
2. Leave `ALLOWED_TELEGRAM_CHAT_ID` blank and run `npm run bot:telegram`. Message your bot once — it replies with your chat id.
3. Put that id into `ALLOWED_TELEGRAM_CHAT_ID` in `.env`, restart `npm run bot:telegram`. It now only responds to you.
4. Message it one or more HR emails (one per line, or comma-separated) — it sends your application email with resume to each and confirms.

Keep `npm run bot:telegram` running for it to respond while you're at work (see Production below).

## Gmail API (for hosts that block SMTP)
Render's free tier (and many others) blocks outbound SMTP, so every send fails with `MAIL_PROVIDER=smtp`. With `MAIL_PROVIDER=gmail-api`, mail goes out from the same Gmail account over HTTPS. You get the same sender and the same daily limit. One-time setup:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and **enable the Gmail API** (APIs & Services → Library).
2. Configure the **OAuth consent screen**: user type *External*, fill in the app name and your email, and add your Gmail as a test user.
3. **Publish the app** (consent screen → Audience/Publishing status → *In production*). You don't need Google verification for personal use. If you skip this step, Google expires the refresh token after **7 days** and sending stops.
4. Create credentials → **OAuth client ID** → type **Desktop app**. Put its ID and secret in `.env` as `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`.
5. On your own computer, run `npm run gmail:auth`, open the printed link, and sign in with your Gmail. Google shows "Google hasn't verified this app": click *Advanced → Go to …* (it's your own app). Copy the printed `GMAIL_REFRESH_TOKEN` into `.env`.
6. Set `MAIL_PROVIDER=gmail-api`. `SMTP_PASS` is no longer needed. Test locally with `npm run send:dry`, then `npm run send:now`.

The app only gets the `gmail.send` permission, so it can send mail but cannot read your inbox. To revoke it, go to https://myaccount.google.com/permissions.

## Production
### Render (or any single-command host)
Build command `npm ci --omit=dev`, start command `npm start`. This runs the scheduler and the bot together in one service, and the health check listens on Render's `PORT`.

On the **free** plan:
- use `MAIL_PROVIDER=gmail-api` (SMTP is blocked; see above)
- point a free uptime monitor (e.g. UptimeRobot) at `https://<your-app>.onrender.com/health` every 10 minutes. Otherwise Render puts the service to sleep after 15 idle minutes, and the scheduler and bot stop.
- allow `0.0.0.0/0` in MongoDB Atlas → Network Access, because Render's outbound IPs aren't fixed

### VPS with pm2
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
