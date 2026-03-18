import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { createLogger, RedisCache, JwtUtils } from '@eventhub/shared-utils';
import { rateLimitMiddleware } from './middleware/rate-limiter';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { circuitBreaker } from './middleware/circuit-breaker';
import { serviceRegistry } from './config/service-registry';

dotenv.config();

const logger = createLogger('api-gateway');
const app: Express = express();
const PORT = process.env.PORT || 3000;

// Initialize Redis for caching and rate limiting
export const redisCache = new RedisCache(
  process.env.REDIS_URL || 'redis://localhost:6379'
);

export const jwtUtils = new JwtUtils();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Custom middleware
app.use(requestLogger);
app.use(rateLimitMiddleware);

app.use(circuitBreaker)    // ✓
app.use(requestLogger)                // ✓
app.use(errorHandler) 

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: serviceRegistry.getHealthStatus()
  });
});

// API version
app.get('/version', (req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    apiVersion: 'v1',
    services: serviceRegistry.getAllServices()
  });
});

// Service status endpoint
app.get('/services/status', (req: Request, res: Response) => {
  res.json({
    services: serviceRegistry.getHealthStatus()
  });
});

// ==================== ROUTE PROXIES ====================

// User Service Routes (Public + Protected)
app.use('/api/auth', 
  circuitBreaker('user-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('user-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/auth': '/api/auth'
    },
    onError: (err, req, res) => {
      logger.error('User service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'User service is temporarily unavailable'
        }
      });
    }
  })
);

app.use('/api/users',
  authMiddleware, // Requires authentication
  circuitBreaker('user-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('user-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/users': '/api/users'
    },
    onError: (err, req, res) => {
      logger.error('User service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'User service is temporarily unavailable'
        }
      });
    }
  })
);

// Profile Service Routes
app.use('/api/profiles',
  circuitBreaker('profile-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('profile-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/profiles': '/api/profiles'
    },
    onError: (err, req, res) => {
      logger.error('Profile service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Profile service is temporarily unavailable'
        }
      });
    }
  })
);

// Catalog Service Routes
app.use('/api/catalog',
  circuitBreaker('catalog-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('catalog-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/catalog': '/api/catalog'
    },
    onError: (err, req, res) => {
      logger.error('Catalog service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Catalog service is temporarily unavailable'
        }
      });
    }
  })
);

// Inquiry Service Routes
app.use('/api/inquiries',
  authMiddleware, // Requires authentication
  circuitBreaker('inquiry-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('inquiry-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/inquiries': '/api/inquiries'
    },
    onError: (err, req, res) => {
      logger.error('Inquiry service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Inquiry service is temporarily unavailable'
        }
      });
    }
  })
);

// Booking routes (part of inquiry service)
app.use('/api/bookings',
  authMiddleware,
  circuitBreaker('inquiry-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('inquiry-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/bookings': '/api/bookings'
    },
    onError: (err, req, res) => {
      logger.error('Inquiry service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Booking service is temporarily unavailable'
        }
      });
    }
  })
);

// Payment Service Routes
app.use('/api/payments',
  authMiddleware,
  circuitBreaker('payment-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('payment-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/payments': '/api/payments'
    },
    onError: (err, req, res) => {
      logger.error('Payment service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Payment service is temporarily unavailable'
        }
      });
    }
  })
);

// Review Service Routes
app.use('/api/reviews',
  circuitBreaker('review-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('review-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/reviews': '/api/reviews'
    },
    onError: (err, req, res) => {
      logger.error('Review service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Review service is temporarily unavailable'
        }
      });
    }
  })
);

// Media Service Routes
app.use('/api/media',
  authMiddleware,
  circuitBreaker('media-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('media-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/media': '/api/media'
    },
    onError: (err, req, res) => {
      logger.error('Media service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Media service is temporarily unavailable'
        }
      });
    }
  })
);

// Notification Service Routes (admin only)
app.use('/api/notifications',
  authMiddleware,
  circuitBreaker('notification-service'),
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('notification-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/notifications': '/api/notifications'
    },
    onError: (err, req, res) => {
      logger.error('Notification service proxy error', { error: err.message });
      (res as Response).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Notification service is temporarily unavailable'
        }
      });
    }
  })
);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist'
    }
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  await redisCache.disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const startServer = async () => {
  try {
    // Connect to Redis
    await redisCache.connect();
    logger.info('Redis connected');

    // Health check all services
    await serviceRegistry.healthCheckAll();

    app.listen(PORT, () => {
      logger.info(`API Gateway running on port ${PORT}`);
      logger.info('Registered services:', serviceRegistry.getAllServices());
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();

export default app;
