import { Router } from 'express';
import { questsController } from './quests.controller';
import { authenticate, requireAdmin, optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createQuestSchema, updateQuestSchema, listQuestsSchema } from './quests.validation';

const router = Router();

// Public routes (optional auth for user-specific data)
router.get('/', optionalAuth, validate(listQuestsSchema, 'query'), questsController.list);
router.get('/:id', optionalAuth, questsController.getById);

// User routes (require auth)
router.post('/:id/complete', authenticate, questsController.complete);
router.get('/:id/my-progress', authenticate, questsController.getMyProgress);
router.post('/:id/checkpoints/:checkpointId/complete', authenticate, questsController.completeCheckpoint);

// Admin routes
router.post('/', authenticate, requireAdmin, validate(createQuestSchema), questsController.create);
router.patch('/:id', authenticate, requireAdmin, validate(updateQuestSchema), questsController.update);
router.delete('/:id', authenticate, requireAdmin, questsController.delete);
router.get('/:id/completions', authenticate, requireAdmin, questsController.getCompletions);

export default router;
