import { Router } from 'express';
import { challengesController } from './challenges.controller';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createChallengeSchema,
  updateChallengeStatusSchema,
  completeChallengeSchema,
} from './challenges.validation';

const router = Router();

// Public / Optional Auth routes
router.get('/', optionalAuth, challengesController.listApproved);
router.get('/creators/leaderboard', optionalAuth, challengesController.getLeaderboard);
router.get('/:id', optionalAuth, challengesController.getById);

// Authenticated user routes
router.get('/user/mine', authenticate, challengesController.listMyCreated);
router.post('/', authenticate, validate(createChallengeSchema), challengesController.create);
router.post('/:id/complete', authenticate, validate(completeChallengeSchema), challengesController.complete);

// Admin only routes
router.patch('/:id/status', authenticate, requireAdmin, validate(updateChallengeStatusSchema), challengesController.updateStatus);
router.patch('/:id/featured', authenticate, requireAdmin, challengesController.toggleFeatured);
router.patch('/:id/trending', authenticate, requireAdmin, challengesController.toggleTrending);

export default router;
