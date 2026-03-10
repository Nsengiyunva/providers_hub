import { Request, Response, NextFunction } from 'express';
import { JwtUtils } from '@eventhub/shared-utils';
import { UserRole } from '@eventhub/shared-types';
import { ApiError } from '../utils/api-error';
import { redisCache } from '../index';

const jwtUtils = new JwtUtils();

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new ApiError(401, 'Access token required');
    }

    // Check if token is blacklisted
    const isBlacklisted = await redisCache.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new ApiError(401, 'Token has been revoked');
    }

    // Verify token
    const payload = jwtUtils.verifyToken(token);

    // Attach user info to request
    (req as any).user = payload;

    next();
  } catch (error: any) {
    if (error.message === 'Invalid or expired token') {
      next(new ApiError(401, 'Invalid or expired token'));
    } else {
      next(error);
    }
  }
};

export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (!roles.includes(user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }

    next();
  };
};
