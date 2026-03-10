import { Request, Response, NextFunction } from 'express';
import { jwtUtils, redisCache } from '../index';
import { createLogger } from '@eventhub/shared-utils';

const logger = createLogger('gateway-auth');

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required'
        }
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await redisCache.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token has been revoked'
        }
      });
    }

    // Verify token
    const payload = jwtUtils.verifyToken(token);

    // Attach user info to request headers for downstream services
    req.headers['x-user-id'] = payload.userId;
    req.headers['x-user-email'] = payload.email;
    req.headers['x-user-role'] = payload.role;

    // Also attach to request object for use in gateway
    (req as any).user = payload;

    logger.debug('User authenticated', {
      userId: payload.userId,
      role: payload.role,
      path: req.path
    });

    next();
  } catch (error: any) {
    logger.error('Authentication failed', {
      error: error.message,
      path: req.path
    });

    if (error.message === 'Invalid or expired token') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed'
      }
    });
  }
};

export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    // Check if token is blacklisted
    const isBlacklisted = await redisCache.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return next();
    }

    // Verify token
    const payload = jwtUtils.verifyToken(token);

    // Attach user info to request headers
    req.headers['x-user-id'] = payload.userId;
    req.headers['x-user-email'] = payload.email;
    req.headers['x-user-role'] = payload.role;

    (req as any).user = payload;

    next();
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};
