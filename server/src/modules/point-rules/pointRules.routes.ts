import { Router } from 'express';
import { pointRulesController } from './pointRules.controller';
import { authenticate, optionalAuth, requireAdmin } from '../../middleware/auth';

const router = Router();

router.get('/', optionalAuth, pointRulesController.list);
router.get('/:key', optionalAuth, pointRulesController.getByKey);

router.post('/', authenticate, requireAdmin, pointRulesController.create);
router.post('/reset-defaults', authenticate, requireAdmin, pointRulesController.resetDefaults);
router.patch('/:id', authenticate, requireAdmin, pointRulesController.update);
router.delete('/:id', authenticate, requireAdmin, pointRulesController.delete);

export default router;
