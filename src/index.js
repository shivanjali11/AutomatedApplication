const cron = require('node-cron');
const config = require('./config');
const { connectDB, disconnectDB } = require('./db');
const { runSendJob } = require('./jobs/sendApplications');

const args = process.argv.slice(2);
const once = args.includes('--once');
const dryRun = args.includes('--dry-run');

async function main() {
  await connectDB();

  if (once) {
    await runSendJob({ dryRun });
    await disconnectDB();
    return;
  }

  if (!cron.validate(config.cronSchedule)) throw new Error(`Invalid CRON_SCHEDULE: ${config.cronSchedule}`);

  cron.schedule(config.cronSchedule, () => runSendJob(), { timezone: config.timezone });
  console.log(`[cron] scheduled "${config.cronSchedule}" (${config.timezone}), batch size ${config.batchSize}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
