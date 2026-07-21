import { Router } from 'express';
import { hiddenGemsController } from './hiddenGems.controller';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createHiddenGemSchema, approveHiddenGemSchema, rejectHiddenGemSchema, listHiddenGemsSchema } from './hiddenGems.validation';
import { createHiddenGemLimiter } from '../../config/rateLimit';

const router = Router();

router.post('/', authenticate, createHiddenGemLimiter, validate(createHiddenGemSchema), hiddenGemsController.create);
router.get('/', authenticate, validate(listHiddenGemsSchema, 'query'), hiddenGemsController.list);
router.get('/:id', authenticate, hiddenGemsController.getById);

export default router;

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);
adminRouter.patch('/:id/approve', validate(approveHiddenGemSchema), hiddenGemsController.approve);
adminRouter.patch('/:id/reject', validate(rejectHiddenGemSchema), hiddenGemsController.reject);