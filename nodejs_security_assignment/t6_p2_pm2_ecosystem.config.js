module.exports = {
  apps: [
    {
      name: "my-app",
      script: "./server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "500M",
      kill_timeout: 5000,
      listen_timeout: 3000,
      source_map_support: true,
      watch: false,
      ignore_watch: ["node_modules", "logs"],
      merge_logs: true,
      time: true,
    },
  ],
  deploy: {
    production: {
      user: "deploy",
      host: "your-server.com",
      ref: "origin/main",
      repo: "git@github.com:username/repo.git",
      path: "/var/www/production",
      "post-deploy": "npm install && pm2 reload ecosystem.config.js --env production",
    },
  },
};
