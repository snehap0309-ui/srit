import { Router } from 'express';
import { settingsController } from './settings.controller';
import { authenticate, requireAdmin } from '../../middleware/auth';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', settingsController.list);
router.get('/categories', settingsController.getCategories);
router.get('/category/:category', settingsController.getByCategory);
router.patch('/:key', settingsController.update);
router.post('/bulk-update', settingsController.bulkUpdate);
router.post('/reset-defaults', settingsController.resetDefaults);
router.post('/seed', settingsController.seedDefaults);

export default router;
