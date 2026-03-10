import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validator';
import { authenticateToken } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';

export const authRouter = Router();
const authController = new AuthController();

// Register
authRouter.post(
  '/register',
  rateLimiter(5, 15 * 60), // 5 requests per 15 minutes
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn(['GUEST', 'SERVICE_PROVIDER']),
    validate
  ],
  authController.register
);

// Login
authRouter.post(
  '/login',
  rateLimiter(10, 15 * 60), // 10 requests per 15 minutes
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validate
  ],
  authController.login
);

// Refresh token
authRouter.post(
  '/refresh',
  rateLimiter(20, 15 * 60),
  [
    body('refreshToken').notEmpty(),
    validate
  ],
  authController.refreshToken
);

// Logout
authRouter.post(
  '/logout',
  authenticateToken,
  authController.logout
);

// Verify email
authRouter.post(
  '/verify-email',
  [
    body('token').notEmpty(),
    validate
  ],
  authController.verifyEmail
);

// Request password reset
authRouter.post(
  '/forgot-password',
  rateLimiter(3, 60 * 60), // 3 requests per hour
  [
    body('email').isEmail().normalizeEmail(),
    validate
  ],
  authController.forgotPassword
);

// Reset password
authRouter.post(
  '/reset-password',
  rateLimiter(5, 60 * 60),
  [
    body('token').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
    validate
  ],
  authController.resetPassword
);

// Change password (authenticated)
authRouter.post(
  '/change-password',
  authenticateToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
    validate
  ],
  authController.changePassword
);

// Get current user
authRouter.get(
  '/me',
  authenticateToken,
  authController.getCurrentUser
);
