import { Router } from 'express';
import { rewardsController } from './rewards.controller';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createRewardSchema, updateRewardSchema } from './rewards.validation';

const router = Router();

router.get('/', rewardsController.list);
router.get('/offers', rewardsController.listOffers);
router.get('/nearby', rewardsController.nearby);
router.get('/:id', rewardsController.getById);
router.post('/', authenticate, requireAdmin, validate(createRewardSchema), rewardsController.create);
router.patch('/:id', authenticate, requireAdmin, validate(updateRewardSchema), rewardsController.update);
router.delete('/:id', authenticate, requireAdmin, rewardsController.delete);

export default router;
