const cron = require('node-cron');
const config = require('./config');
const { connectDB, disconnectDB } = require('./db');
const { runSendJob, getJobStatus } = require('./jobs/sendApplications');
const { startHealthServer } = require('./health');

const args = process.argv.slice(2);
const once = args.includes('--once');
const dryRun = args.includes('--dry-run');

async function main() {
  if (!once && !cron.validate(config.cronSchedule)) throw new Error(`Invalid CRON_SCHEDULE: ${config.cronSchedule}`);

  await connectDB();

  if (once) {
    await runSendJob({ dryRun });
    await disconnectDB();
    return;
  }

  const task = cron.schedule(config.cronSchedule, () => runSendJob(), { timezone: config.timezone });
  console.log(`[cron] scheduled "${config.cronSchedule}" (${config.timezone}), batch size ${config.batchSize}`);

  const health = config.healthPort
    ? startHealthServer({
        name: 'scheduler',
        port: config.healthPort,
        getDetails: () => ({ schedule: config.cronSchedule, timezone: config.timezone, job: getJobStatus() }),
      })
    : null;

  const shutdown = async (signal) => {
    console.log(`[cron] ${signal} received, shutting down`);
    task.stop();
    health?.close();
    await disconnectDB().catch(() => {});
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

process.on('unhandledRejection', (err) => console.error('[process] unhandled rejection:', err));

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
