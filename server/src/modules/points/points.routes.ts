import { Router } from 'express';
import { pointsController } from './points.controller';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { earnPointsSchema } from './points.validation';

const router = Router();

router.get('/balance', authenticate, pointsController.getBalance);
router.post('/earn', authenticate, requireAdmin, validate(earnPointsSchema), pointsController.earn);
router.get('/history', authenticate, pointsController.history);

export default router;
