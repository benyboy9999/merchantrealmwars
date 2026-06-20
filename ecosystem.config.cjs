// PM2 process config — used on the production server.
// Start with: pm2 start ecosystem.config.cjs
// Deploy:     pm2 restart merchant-realms --update-env
module.exports = {
  apps: [
    {
      name: 'merchant-realms',
      script: './packages/server/dist/app.js',
      cwd: '/var/www/merchant-realms',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',

      // Restart behaviour
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',

      // Logs
      error_file: '/var/log/merchant-realms/error.log',
      out_file: '/var/log/merchant-realms/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
