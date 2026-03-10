import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../index';
import { createLogger } from '@eventhub/shared-utils';

const logger = createLogger('rate-limiter');

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // Authentication endpoints - stricter limits
  '/api/auth/login': { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  '/api/auth/register': { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  '/api/auth/forgot-password': { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  
  // Payment endpoints - moderate limits
  '/api/payments': { windowMs: 60 * 1000, maxRequests: 10 },
  
  // Default - generous limits
  default: { windowMs: 60 * 1000, maxRequests: 100 }
};

export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get identifier (user ID if authenticated, IP otherwise)
    const userId = (req as any).user?.userId;
    const identifier = userId || req.ip || 'unknown';

    // Get rate limit config for this endpoint
    const config = getRateLimitConfig(req.path);
    
    // Create Redis key
    const key = `rate_limit:${req.path}:${identifier}`;

    // Get current count
    const current = await redisCache.get<number>(key);

    if (current === null) {
      // First request in window
      await redisCache.set(key, 1, Math.floor(config.windowMs / 1000));
      setRateLimitHeaders(res, config.maxRequests, config.maxRequests - 1, config.windowMs);
      return next();
    }

    if (current >= config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        identifier,
        path: req.path,
        current,
        limit: config.maxRequests
      });

      setRateLimitHeaders(res, config.maxRequests, 0, config.windowMs);

      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.floor(config.windowMs / 1000)
        }
      });
    }

    // Increment counter
    await redisCache.increment(key);
    
    setRateLimitHeaders(
      res,
      config.maxRequests,
      config.maxRequests - (current + 1),
      config.windowMs
    );

    next();
  } catch (error: any) {
    logger.error('Rate limiter error', { error: error.message });
    // Don't block request if rate limiter fails
    next();
  }
};

function getRateLimitConfig(path: string): RateLimitConfig {
  // Check for exact match
  if (rateLimitConfigs[path]) {
    return rateLimitConfigs[path];
  }

  // Check for pattern match
  for (const [pattern, config] of Object.entries(rateLimitConfigs)) {
    if (path.startsWith(pattern)) {
      return config;
    }
  }

  // Return default
  return rateLimitConfigs.default;
}

function setRateLimitHeaders(
  res: Response,
  limit: number,
  remaining: number,
  windowMs: number
) {
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
}
