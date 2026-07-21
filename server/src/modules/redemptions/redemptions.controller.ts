import { Response } from 'express';
import { prisma } from '../../config/database';
import { redemptionsService } from './redemptions.service';
import { catchAsync } from '../../shared/utils/catchAsync';
import { sendSuccess, sendCreated } from '../../shared/utils/response';

export const redemptionsController = {
  generate: catchAsync(async (req: any, res: Response) => {
    const redemption = await redemptionsService.generate(req.user.id, req.body.offerId);
    sendCreated(res, redemption, 'Redemption generated');
  }),

  verify: catchAsync(async (req: any, res: Response) => {
    const redemption = await redemptionsService.verify(req.body.token, req.user.id);
    sendSuccess(res, redemption, { message: 'Redemption verified' });
  }),

  myRedemptions: catchAsync(async (req: any, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await redemptionsService.getUserRedemptions(req.user.id, page, limit);
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  vendorRedemptions: catchAsync(async (req: any, res: Response) => {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) { sendSuccess(res, []); return; }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await redemptionsService.getVendorRedemptions(vendor.id, page, limit);
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  adminRefund: catchAsync(async (req: any, res: Response) => {
    const redemption = await redemptionsService.refund(req.params.id, req.user.id, req.body.notes);
    sendSuccess(res, redemption, { message: 'Redemption refunded' });
  }),

  adminListAll: catchAsync(async (req: any, res: Response) => {
    const result = await redemptionsService.adminListAll({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      userId: req.query.userId as string,
      vendorId: req.query.vendorId as string,
      offerId: req.query.offerId as string,
    });
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  pay: catchAsync(async (req: any, res: Response) => {
    const result = await redemptionsService.payPoints(req.user.id, req.body.vendorCode, req.body.points);
    sendCreated(res, result, 'Points transferred');
  }),
};
