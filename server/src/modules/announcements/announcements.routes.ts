import { Router } from 'express';
import { announcementsController } from './announcements.controller';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createAnnouncementSchema, updateAnnouncementSchema } from './announcements.validation';

// ── Public: mobile/web clients read only currently-active announcements ──
const router = Router();
router.get('/active', announcementsController.listActive);
export default router;

// ── Admin: full CRUD ──
const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/', announcementsController.list);
adminRouter.post('/', validate(createAnnouncementSchema), announcementsController.create);
adminRouter.get('/:id', announcementsController.getById);
adminRouter.patch('/:id', validate(updateAnnouncementSchema), announcementsController.update);
adminRouter.delete('/:id', announcementsController.remove);

export { adminRouter };
