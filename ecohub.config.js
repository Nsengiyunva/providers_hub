module.exports = {
  apps: [
    // API Gateway - Entry point for all requests
    {
      name: 'api-gateway',
      cwd: '/home/user1/personal/providers_hub/services/api-gateway',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/home/user1/personal/providers_hub/logs/api-gateway-error.log',
      out_file: '/home/user1/personal/providers_hub/logs/api-gateway-out.log',
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
      cwd: '/home/user1/personal/providers_hub/services/user-service',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/home/user1/personal/providers_hub/logs/user-service-error.log',
      out_file: '/home/user1/personal/providers_hub/logs/user-service-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      min_uptime: '10s',
      max_restarts: 10
    },

    // Profile Service - Service provider profiles
    // {
    //   name: 'profile-service',
    //   cwd: '/home/user1/personal/providers_hub/services/profile-service',
    //   script: 'dist/index.js',
    //   instances: 2,
    //   exec_mode: 'cluster',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3002
    //   },
    //   error_file: '/home/user1/personal/providers_hub/logs/profile-service-error.log',
    //   out_file: '/home/user1/personal/providers_hub/logs/profile-service-out.log',
    //   merge_logs: true,
    //   time: true,
    //   max_memory_restart: '500M',
    //   autorestart: true,
    //   watch: false,
    //   min_uptime: '10s',
    //   max_restarts: 10
    // },

    // // Catalog Service - Service listings and packages
    // {
    //   name: 'catalog-service',
    //   cwd: '/home/user1/personal/providers_hub/services/catalog-service',
    //   script: 'dist/index.js',
    //   instances: 2,
    //   exec_mode: 'cluster',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3003
    //   },
    //   error_file: '/home/user1/personal/providers_hub/logs/catalog-service-error.log',
    //   out_file: '/home/user1/personal/providers_hub/logs/catalog-service-out.log',
    //   merge_logs: true,
    //   time: true,
    //   max_memory_restart: '500M',
    //   autorestart: true,
    //   watch: false,
    //   min_uptime: '10s',
    //   max_restarts: 10
    // },

    // // Inquiry Service - Booking requests and inquiries
    // {
    //   name: 'inquiry-service',
    //   cwd: '/home/user1/personal/providers_hub/services/inquiry-service',
    //   script: 'dist/index.js',
    //   instances: 2,
    //   exec_mode: 'cluster',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3004
    //   },
    //   error_file: '/home/user1/personal/providers_hub/logs/inquiry-service-error.log',
    //   out_file: '/home/user1/personal/providers_hub/logs/inquiry-service-out.log',
    //   merge_logs: true,
    //   time: true,
    //   max_memory_restart: '500M',
    //   autorestart: true,
    //   watch: false,
    //   min_uptime: '10s',
    //   max_restarts: 10
    // },

    // // Payment Service - Payment processing
    // {
    //   name: 'payment-service',
    //   cwd: '/home/user1/personal/providers_hub/services/payment-service',
    //   script: 'dist/index.js',
    //   instances: 2,
    //   exec_mode: 'cluster',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3005
    //   },
    //   error_file: '/home/user1/personal/providers_hub/logs/payment-service-error.log',
    //   out_file: '/home/user1/personal/providers_hub/logs/payment-service-out.log',
    //   merge_logs: true,
    //   time: true,
    //   max_memory_restart: '500M',
    //   autorestart: true,
    //   watch: false,
    //   min_uptime: '10s',
    //   max_restarts: 10
    // },

    // // Review Service - Ratings and reviews
    // {
    //   name: 'review-service',
    //   cwd: '/home/user1/personal/providers_hub/services/review-service',
    //   script: 'dist/index.js',
    //   instances: 2,
    //   exec_mode: 'cluster',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3006
    //   },
    //   error_file: '/home/user1/personal/providers_hub/logs/review-service-error.log',
    //   out_file: '/home/user1/personal/providers_hub/logs/review-service-out.log',
    //   merge_logs: true,
    //   time: true,
    //   max_memory_restart: '500M',
    //   autorestart: true,
    //   watch: false,
    //   min_uptime: '10s',
    //   max_restarts: 10
    // },

    // // Notification Service - Email, SMS, push notifications
    // {
    //   name: 'notification-service',
    //   cwd: '/home/user1/personal/providers_hub/services/notification-service',
    //   script: 'dist/index.js',
    //   instances: 1, // Single instance for notifications to avoid duplicates
    //   exec_mode: 'fork',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3007
    //   },
    //   error_file: '/home/user1/personal/providers_hub/logs/notification-service-error.log',
    //   out_file: '/home/user1/personal/providers_hub/logs/notification-service-out.log',
    //   merge_logs: true,
    //   time: true,
    //   max_memory_restart: '500M',
    //   autorestart: true,
    //   watch: false,
    //   min_uptime: '10s',
    //   max_restarts: 10
    // },

    // // Media Service - File uploads and media handling
    // {
    //   name: 'media-service',
    //   cwd: '/home/user1/personal/providers_hub/services/media-service',
    //   script: 'dist/index.js',
    //   instances: 2,
    //   exec_mode: 'cluster',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 3008
    //   },
    //   error_file: '/home/user1/personal/providers_hub/logs/media-service-error.log',
    //   out_file: '/home/user1/personal/providers_hub/logs/media-service-out.log',
    //   merge_logs: true,
    //   time: true,
    //   max_memory_restart: '500M',
    //   autorestart: true,
    //   watch: false,
    //   min_uptime: '10s',
    //   max_restarts: 10
    // }
  ]
};
