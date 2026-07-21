import { Router } from 'express';
import { redemptionsController } from './redemptions.controller';
import { authenticate, requireAdmin, requireVendorRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  generateRedemptionSchema,
  verifyRedemptionSchema,
  payPointsSchema,
  adminRefundSchema,
} from './redemptions.validation';

const router = Router();

router.post('/generate', authenticate, validate(generateRedemptionSchema), redemptionsController.generate);
router.post('/pay', authenticate, validate(payPointsSchema), redemptionsController.pay);
router.post('/verify', authenticate, requireVendorRole, validate(verifyRedemptionSchema), redemptionsController.verify);
router.get('/mine', authenticate, redemptionsController.myRedemptions);
router.get('/vendor', authenticate, requireVendorRole, redemptionsController.vendorRedemptions);
router.post('/:id/refund', authenticate, requireAdmin, validate(adminRefundSchema), redemptionsController.adminRefund);
router.get('/admin/all', authenticate, requireAdmin, redemptionsController.adminListAll);

export default router;
