module.exports = {
  apps: [
    {
      name: 'weiai',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_USER: 'weiai',
        DB_PASSWORD: 'weiai123',
        DB_NAME: 'weiai',
        JWT_SECRET: 'your_jwt_secret_key_here_change_in_production'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000
    }
  ],
  deploy: {
    production: {
      user: 'root',
      host: 'your_server_ip',
      ref: 'origin/main',
      repo: 'https://github.com/yeluoge26/weiai-indepnces.git',
      path: '/var/www/weiai',
      'post-deploy': 'npm install && npm start'
    }
  }
};
