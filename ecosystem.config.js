module.exports = {
  apps: [
    // API Gateway - Entry point for all requests
    {
      name: 'api-gateway',
      cwd: './services/api-gateway',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/api-gateway-error.log',
      out_file: './logs/api-gateway-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      min_uptime: '10s',
      max_restarts: 10
    },

    // User Service - Authentication & user management
    {
      name: 'user-service',
      cwd: './services/user-service',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/user-service-error.log',
      out_file: './logs/user-service-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
};
