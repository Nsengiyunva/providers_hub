import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@eventhub/shared-utils';
import { UserStatus } from '@eventhub/shared-types';
import { prisma } from '../config/database';
import { redisCache } from '../index';
import { ApiError } from '../utils/api-error';

const logger = createLogger('user-controller');

export class UserController {
  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};

      if (search) {
        where.OR = [
          { email: { contains: search as string, mode: 'insensitive' } },
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      if (role) {
        where.role = role;
      }

      if (status) {
        where.status = status;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            emailVerified: true,
            phoneNumber: true,
            phoneVerified: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true
          },
          skip,
          take: Number(limit),
          orderBy: {
            [sortBy as string]: sortOrder
          }
        }),
        prisma.user.count({ where })
      ]);

      res.json({
        success: true,
        data: { users },
        metadata: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user.userId;
      const currentUserRole = (req as any).user.role;

      // Users can only view their own profile unless they're admin
      if (id !== currentUserId && currentUserRole !== 'ADMIN') {
        throw new ApiError(403, 'You can only view your own profile');
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true,
          phoneNumber: true,
          phoneVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user.userId;
      const currentUserRole = (req as any).user.role;

      // Users can only update their own profile unless they're admin
      if (id !== currentUserId && currentUserRole !== 'ADMIN') {
        throw new ApiError(403, 'You can only update your own profile');
      }

      const { firstName, lastName, phoneNumber } = req.body;

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(phoneNumber !== undefined && { phoneNumber })
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true,
          phoneNumber: true,
          phoneVerified: true,
          updatedAt: true
        }
      });

      // Clear cache
      await redisCache.delete(`user:${id}`);

      logger.info('User updated successfully', { userId: id });

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const currentUserId = (req as any).user.userId;
      const currentUserRole = (req as any).user.role;

      // Users can only delete their own account unless they're admin
      if (id !== currentUserId && currentUserRole !== 'ADMIN') {
        throw new ApiError(403, 'You can only delete your own account');
      }

      await prisma.user.delete({
        where: { id }
      });

      // Clear cache
      await redisCache.delete(`user:${id}`);

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: currentUserId,
          action: 'USER_DELETED',
          resource: 'User',
          resourceId: id
        }
      });

      logger.info('User deleted successfully', { userId: id });

      res.json({
        success: true,
        data: { message: 'User deleted successfully' }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const user = await prisma.user.update({
        where: { id },
        data: { status: status as UserStatus }
      });

      // Clear cache
      await redisCache.delete(`user:${id}`);

      logger.info('User status updated', { userId: id, status });

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserStats(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        totalUsers,
        activeUsers,
        serviceProviders,
        verifiedUsers,
        recentRegistrations
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
        prisma.user.count({ where: { role: 'SERVICE_PROVIDER' } }),
        prisma.user.count({ where: { emailVerified: true } }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          stats: {
            totalUsers,
            activeUsers,
            serviceProviders,
            verifiedUsers,
            recentRegistrations
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
