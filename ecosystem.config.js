// pm2 process file: `pm2 start ecosystem.config.js` runs the scheduler and the
// Telegram bot as two supervised processes, restarted on crash/reboot.
module.exports = {
  apps: [
    {
      name: 'automailer-scheduler',
      script: 'src/index.js',
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
    },
    {
      name: 'automailer-bot',
      script: 'src/bot/telegramBot.js',
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
    },
  ],
};
