import { Router } from 'express';
import { body, param } from 'express-validator';
import { UserController } from '../controllers/user.controller';
import { validate } from '../middleware/validator';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { UserRole } from '@eventhub/shared-types';

export const userRouter = Router();
const userController = new UserController();

// All routes require authentication
userRouter.use(authenticateToken);

// Get all users (admin only)
userRouter.get(
  '/',
  authorizeRoles(UserRole.ADMIN),
  userController.getAllUsers
);

// Get user by ID
userRouter.get(
  '/:id',
  [
    param('id').isUUID(),
    validate
  ],
  userController.getUserById
);

// Update user profile
userRouter.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('phoneNumber').optional().trim(),
    validate
  ],
  userController.updateUser
);

// Delete user
userRouter.delete(
  '/:id',
  [
    param('id').isUUID(),
    validate
  ],
  userController.deleteUser
);

// Update user status (admin only)
userRouter.patch(
  '/:id/status',
  authorizeRoles(UserRole.ADMIN),
  [
    param('id').isUUID(),
    body('status').isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
    validate
  ],
  userController.updateUserStatus
);

// Get user statistics (admin only)
userRouter.get(
  '/stats/overview',
  authorizeRoles(UserRole.ADMIN),
  userController.getUserStats
);
