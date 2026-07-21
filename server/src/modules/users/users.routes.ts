import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateRoleSchema } from './users.validation';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', usersController.list);
router.get('/:id', usersController.getById);
router.patch('/:id/role', validate(updateRoleSchema), usersController.updateRole);
router.delete('/:id', usersController.deleteUser);

export default router;
