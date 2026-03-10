import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../index';
import { ApiError } from '../utils/api-error';

export const rateLimiter = (maxRequests: number, windowSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = req.ip || 'unknown';
      const key = `rate_limit:${req.path}:${identifier}`;

      const current = await redisCache.get<number>(key);
      
      if (current === null) {
        // First request in the window
        await redisCache.set(key, 1, windowSeconds);
        return next();
      }

      if (current >= maxRequests) {
        throw new ApiError(
          429,
          `Too many requests. Please try again later.`,
          {
            retryAfter: windowSeconds
          }
        );
      }

      await redisCache.increment(key);
      next();
    } catch (error) {
      next(error);
    }
  };
};
