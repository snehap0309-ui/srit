import { Request, Response } from 'express';
import { vendorsService } from './vendors.service';
import { catchAsync } from '../../shared/utils/catchAsync';
import { sendSuccess, sendCreated } from '../../shared/utils/response';

export const vendorsController = {
  register: catchAsync(async (req: Request, res: Response) => {
    const { vendor, created, resubmitted } = await vendorsService.register(req.body, (req as any).user.id);
    if (created) {
      sendCreated(res, vendor, 'Vendor registration submitted for review');
      return;
    }
    if (resubmitted) {
      sendSuccess(res, vendor, { message: 'Vendor registration resubmitted for review' });
      return;
    }
    sendSuccess(res, vendor, { message: `Vendor registration is already ${vendor.status.toLowerCase()}` });
  }),

  getMyVendor: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    sendSuccess(res, vendor || null, { message: vendor ? 'Success' : 'No vendor account' });
  }),

  updateMyVendor: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.updateMyVendor((req as any).user.id, req.body);
    sendSuccess(res, vendor, { message: 'Vendor updated' });
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const result = await vendorsService.list(req.query as any);
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getById(req.params.id as string);
    sendSuccess(res, vendor);
  }),

  verify: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.verify(
      req.params.id as string,
      req.body.status,
      (req as any).user.id,
      req.body.rejectionReason,
    );
    sendSuccess(res, vendor, { message: `Vendor ${req.body.status.toLowerCase()}` });
  }),

  deleteVendor: catchAsync(async (req: Request, res: Response) => {
    const result = await vendorsService.deleteVendor(req.params.id as string, (req as any).user.id);
    sendSuccess(res, result, { message: 'Vendor deleted' });
  }),

  createOffer: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const offer = await vendorsService.createOffer(vendor.id, req.body);
    sendCreated(res, offer, 'Offer created');
  }),

  updateOffer: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const offer = await vendorsService.updateOffer(req.params.offerId as string, vendor.id, req.body);
    sendSuccess(res, offer, { message: 'Offer updated' });
  }),

  listMyOffers: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, []); return; }
    const offers = await vendorsService.listOffers(vendor.id);
    sendSuccess(res, offers);
  }),

  deleteOffer: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    await vendorsService.deleteOffer(req.params.offerId as string, vendor.id);
    sendSuccess(res, null, { message: 'Offer deleted' });
  }),

  getPublicOffers: catchAsync(async (req: Request, res: Response) => {
    const offers = await vendorsService.getPublicOffers(req.query as any);
    sendSuccess(res, offers);
  }),

  // Business-type-specific public listings
  listByType: (type: string) => catchAsync(async (req: Request, res: Response) => {
    const result = await vendorsService.listByType(type, req.query as any);
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  // ── Public endpoints for map ──

  getNearbyVendors: catchAsync(async (_req: Request, res: Response) => {
    const vendors = await vendorsService.listNearbyApproved();
    sendSuccess(res, vendors);
  }),

  listApprovedForMap: catchAsync(async (_req: Request, res: Response) => {
    const vendors = await vendorsService.listApprovedForMap();
    sendSuccess(res, vendors);
  }),

  getPublicDetails: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getPublicDetails(req.params.id as string);
    sendSuccess(res, vendor);
  }),

  getReviews: catchAsync(async (req: Request, res: Response) => {
    const result = await vendorsService.getReviews(req.params.id as string, req.query as any);
    sendSuccess(res, result.data, { pagination: result.pagination });
  }),

  addReview: catchAsync(async (req: any, res: Response) => {
    const review = await vendorsService.addReview(req.params.id as string, req.user.id, req.body);
    sendSuccess(res, review, { message: 'Review submitted' });
  }),

  markReviewHelpful: catchAsync(async (req: any, res: Response) => {
    const review = await vendorsService.markReviewHelpful(
      req.params.id as string,
      req.params.reviewId as string,
    );
    sendSuccess(res, review, { message: 'Review marked as helpful' });
  }),

  // ── Vendor Reels ──

  getVendorReels: catchAsync(async (req: Request, res: Response) => {
    const reels = await vendorsService.listVendorReels(req.params.id as string);
    sendSuccess(res, reels);
  }),

  createVendorReel: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const reel = await vendorsService.createVendorReel(vendor.id, req.body);
    sendCreated(res, reel, 'Reel created');
  }),

  deleteVendorReel: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    await vendorsService.deleteVendorReel(vendor.id, req.params.reelId as string);
    sendSuccess(res, null, { message: 'Reel deleted' });
  }),

  // ── Offer Lifecycle ──

  getOfferById: catchAsync(async (req: Request, res: Response) => {
    const offer = await vendorsService.getOfferById(req.params.offerId as string);
    sendSuccess(res, offer);
  }),

  approveOffer: catchAsync(async (req: Request, res: Response) => {
    const offer = await vendorsService.approveOffer(
      req.params.offerId as string,
      (req as any).user.id,
      req.body,
    );
    sendSuccess(res, offer, { message: 'Offer approved' });
  }),

  rejectOffer: catchAsync(async (req: Request, res: Response) => {
    const offer = await vendorsService.rejectOffer(
      req.params.offerId as string,
      (req as any).user.id,
      req.body,
    );
    sendSuccess(res, offer, { message: 'Offer rejected' });
  }),

  pauseOffer: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const offer = await vendorsService.pauseOffer(req.params.offerId as string, vendor.id);
    sendSuccess(res, offer, { message: 'Offer paused' });
  }),

  resumeOffer: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const offer = await vendorsService.resumeOffer(req.params.offerId as string, vendor.id);
    sendSuccess(res, offer, { message: 'Offer resumed' });
  }),

  duplicateOffer: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const offer = await vendorsService.duplicateOffer(req.params.offerId as string, vendor.id);
    sendCreated(res, offer, 'Offer duplicated');
  }),

  recordOfferView: catchAsync(async (req: Request, res: Response) => {
    await vendorsService.recordOfferView(req.params.offerId as string);
    sendSuccess(res, null);
  }),

  recordOfferClick: catchAsync(async (req: Request, res: Response) => {
    await vendorsService.recordOfferClick(req.params.offerId as string);
    sendSuccess(res, null);
  }),

  // ── Dashboard & Analytics ──

  getDashboard: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const stats = await vendorsService.getDashboardStats(vendor.id);
    sendSuccess(res, stats);
  }),

  getAnalytics: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const period = (req.query.period as string) || '7d';
    const analytics = await vendorsService.getAnalytics(vendor.id, period as any);
    sendSuccess(res, analytics);
  }),

  getOfferAnalytics: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.getMyVendor((req as any).user.id);
    if (!vendor) { sendSuccess(res, null, { message: 'No vendor account' }); return; }
    const analytics = await vendorsService.getOfferAnalytics(req.params.offerId as string, vendor.id);
    sendSuccess(res, analytics);
  }),

  // ── Admin Offer Management ──

  adminListAllOffers: catchAsync(async (req: Request, res: Response) => {
    const { prisma } = await import('../../config/database');
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const status = req.query.status as string;
    const search = req.query.search as string;

    const where: any = {};
    if (status === 'pending') { where.isApproved = false; where.rejectionReason = null; }
    else if (status === 'approved') { where.isApproved = true; }
    else if (status === 'rejected') { where.rejectionReason = { not: null }; }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { vendor: { businessName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.vendorOffer.findMany({
        where,
        include: {
          vendor: { select: { id: true, businessName: true, businessType: true, city: true, state: true, imageUrl: true } },
          approvedBy: { select: { id: true, name: true } },
          rejectedBy: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vendorOffer.count({ where }),
    ]);

    sendSuccess(res, data, {
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  }),

  // ── Admin ──

  adminUpdateVendor: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.adminUpdate(
      req.params.id as string,
      req.body,
      (req as any).user.id,
    );
    sendSuccess(res, vendor, { message: 'Vendor location updated' });
  }),
};
