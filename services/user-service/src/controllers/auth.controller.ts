import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  createLogger, 
  PasswordUtils, 
  JwtUtils 
} from '@eventhub/shared-utils';
import { 
  UserRole, 
  UserStatus, 
  UserCreatedEvent 
} from '@eventhub/shared-types';
import { prisma } from '../config/database';
import { kafkaProducer, redisCache } from '../index';
import { ApiError } from '../utils/api-error';

const logger = createLogger('auth-controller');
const passwordUtils = new PasswordUtils();
const jwtUtils = new JwtUtils();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, firstName, lastName, role, phoneNumber } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
      }

      // Validate password strength
      const passwordValidation = passwordUtils.validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        throw new ApiError(400, 'Password does not meet requirements', {
          errors: passwordValidation.errors
        });
      }

      // Hash password
      const hashedPassword = await passwordUtils.hash(password);

      // Generate email verification token
      const emailVerificationToken = uuidv4();
      const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: role as UserRole,
          phoneNumber,
          emailVerificationToken,
          emailVerificationExpiry
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
          createdAt: true
        }
      });

      // Publish user created event
      await kafkaProducer.sendEvent<UserCreatedEvent>(
        'user-events',
        'USER_CREATED',
        {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as UserRole
        },
        {
          userId: user.id,
          source: 'user-service'
        }
      );

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_REGISTERED',
          resource: 'User',
          resourceId: user.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      res.status(201).json({
        success: true,
        data: {
          user,
          message: 'Registration successful. Please check your email to verify your account.'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ApiError(401, 'Invalid email or password');
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil(
          (user.lockedUntil.getTime() - Date.now()) / (60 * 1000)
        );
        throw new ApiError(
          423,
          `Account is locked. Please try again in ${minutesLeft} minutes.`
        );
      }

      // Verify password
      const isPasswordValid = await passwordUtils.compare(password, user.password);
      if (!isPasswordValid) {
        // Increment login attempts
        const loginAttempts = user.loginAttempts + 1;
        const updates: any = { loginAttempts };

        // Lock account after 5 failed attempts
        if (loginAttempts >= 5) {
          updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
        }

        await prisma.user.update({
          where: { id: user.id },
          data: updates
        });

        throw new ApiError(401, 'Invalid email or password');
      }

      // Check if user is active
      if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING_VERIFICATION) {
        throw new ApiError(403, 'Account is not active');
      }

      // Generate tokens
      const tokens = jwtUtils.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role as UserRole
      });

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      // Update last login and reset login attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: req.ip,
          loginAttempts: 0,
          lockedUntil: null
        }
      });

      // Cache user data
      await redisCache.set(`user:${user.id}`, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }, 3600); // 1 hour

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_LOGIN',
          resource: 'User',
          resourceId: user.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      logger.info('User logged in successfully', { userId: user.id });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified
          },
          tokens
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const payload = jwtUtils.verifyToken(refreshToken);

      // Check if token exists and is not revoked
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      });

      if (!storedToken || storedToken.isRevoked) {
        throw new ApiError(401, 'Invalid refresh token');
      }

      if (storedToken.expiresAt < new Date()) {
        throw new ApiError(401, 'Refresh token expired');
      }

      // Generate new tokens
      const newTokens = jwtUtils.generateTokenPair({
        userId: payload.userId,
        email: payload.email,
        role: payload.role
      });

      // Revoke old refresh token and store new one
      await prisma.$transaction([
        prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { isRevoked: true }
        }),
        prisma.refreshToken.create({
          data: {
            token: newTokens.refreshToken,
            userId: payload.userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        })
      ]);

      logger.info('Token refreshed successfully', { userId: payload.userId });

      res.json({
        success: true,
        data: { tokens: newTokens }
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];

      // Revoke all refresh tokens for this user
      await prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true }
      });

      // Blacklist the access token
      if (token) {
        const decoded = jwtUtils.decodeToken(token);
        if (decoded && decoded.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redisCache.set(`blacklist:${token}`, true, ttl);
          }
        }
      }

      // Clear user cache
      await redisCache.delete(`user:${userId}`);

      logger.info('User logged out successfully', { userId });

      res.json({
        success: true,
        data: { message: 'Logged out successfully' }
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          emailVerificationToken: token,
          emailVerificationExpiry: { gt: new Date() }
        }
      });

      if (!user) {
        throw new ApiError(400, 'Invalid or expired verification token');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          status: UserStatus.ACTIVE,
          emailVerificationToken: null,
          emailVerificationExpiry: null
        }
      });

      logger.info('Email verified successfully', { userId: user.id });

      res.json({
        success: true,
        data: { message: 'Email verified successfully' }
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Don't reveal if user exists
        res.json({
          success: true,
          data: { message: 'If the email exists, a password reset link has been sent' }
        });
        return;
      }

      const resetToken = uuidv4();
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiry: resetExpiry
        }
      });

      // TODO: Send password reset email via notification service

      logger.info('Password reset requested', { userId: user.id });

      res.json({
        success: true,
        data: { message: 'If the email exists, a password reset link has been sent' }
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpiry: { gt: new Date() }
        }
      });

      if (!user) {
        throw new ApiError(400, 'Invalid or expired reset token');
      }

      const passwordValidation = passwordUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        throw new ApiError(400, 'Password does not meet requirements', {
          errors: passwordValidation.errors
        });
      }

      const hashedPassword = await passwordUtils.hash(newPassword);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null
        }
      });

      logger.info('Password reset successfully', { userId: user.id });

      res.json({
        success: true,
        data: { message: 'Password reset successfully' }
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      const isCurrentPasswordValid = await passwordUtils.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        throw new ApiError(401, 'Current password is incorrect');
      }

      const passwordValidation = passwordUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        throw new ApiError(400, 'Password does not meet requirements', {
          errors: passwordValidation.errors
        });
      }

      const hashedPassword = await passwordUtils.hash(newPassword);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      logger.info('Password changed successfully', { userId });

      res.json({
        success: true,
        data: { message: 'Password changed successfully' }
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;

      // Try to get from cache first
      let user = await redisCache.get(`user:${userId}`);

      if (!user) {
        // Get from database
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
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

        if (!dbUser) {
          throw new ApiError(404, 'User not found');
        }

        user = dbUser;

        // Cache the user
        await redisCache.set(`user:${userId}`, user, 3600);
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }
}
