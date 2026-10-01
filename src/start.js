// `npm start`: runs the scheduler and the Telegram bot side by side as child
// processes, so a single host service (e.g. one Render web service) runs both.
// A crashed process is restarted with backoff; SIGTERM/SIGINT stop both cleanly.
const { spawn } = require('child_process');
const path = require('path');

const apps = [
  { name: 'scheduler', script: path.join(__dirname, 'index.js') },
  { name: 'bot', script: path.join(__dirname, 'bot', 'telegramBot.js') },
];

const MAX_BACKOFF_MS = 60_000;
let shuttingDown = false;

function run(app, restarts = 0) {
  const child = spawn(process.execPath, [app.script], { stdio: 'inherit', env: process.env });
  const startedAt = Date.now();
  app.child = child;

  child.on('exit', (code, signal) => {
    app.child = null;
    if (shuttingDown) return;
    // A process that stayed up for a minute counts as healthy, so the backoff resets.
    const attempt = Date.now() - startedAt > 60_000 ? 0 : restarts + 1;
    const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
    console.error(`[start] ${app.name} exited (${signal || `code ${code}`}), restarting in ${delay / 1000}s`);
    setTimeout(() => run(app, attempt), delay);
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[start] ${signal} received, stopping all processes`);
  for (const app of apps) app.child?.kill(signal);
  // Children close their DB connections and exit on their own; force-exit if one hangs.
  setTimeout(() => process.exit(0), 10_000).unref();
  const check = setInterval(() => {
    if (apps.every((a) => !a.child)) {
      clearInterval(check);
      process.exit(0);
    }
  }, 200);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

for (const app of apps) run(app);
