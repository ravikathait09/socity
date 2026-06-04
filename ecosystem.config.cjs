/**
 * PM2 ecosystem — Socity production
 *
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 restart socity
 *   pm2 logs socity
 *
 * Override app root / port:
 *   APP_DIR=/var/www/socity APP_PORT=3300 pm2 start ecosystem.config.cjs --env production
 */
const path = require("path");

const APP_DIR = process.env.APP_DIR || "/var/www/socity";
const APP_PORT = Number(process.env.APP_PORT || 3300);

module.exports = {
  apps: [
    {
      name: "socity",
      cwd: path.join(APP_DIR, ".next/standalone"),
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      time: true,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: path.join(APP_DIR, "logs/pm2-error.log"),
      out_file: path.join(APP_DIR, "logs/pm2-out.log"),
      env_file: path.join(APP_DIR, ".env.production"),
      env_production: {
        NODE_ENV: "production",
        PORT: APP_PORT,
        HOSTNAME: "127.0.0.1",
      },
      uid: "www-data",
      gid: "www-data",
    },
  ],
};
