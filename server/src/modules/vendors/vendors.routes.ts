import { Router } from 'express';
import { vendorsController } from './vendors.controller';
import { authenticate, optionalAuth, requireAdmin, requireVendorRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  registerVendorSchema, updateVendorSchema, verifyVendorSchema,
  createOfferSchema, updateOfferSchema, adminUpdateVendorSchema,
  createVendorReelSchema, approveOfferSchema, rejectOfferSchema,
  vendorReviewSchema,
} from './vendors.validation';

const router = Router();

// ── Public: Map endpoints (must be before /:id) ──
router.get('/nearby', optionalAuth, vendorsController.getNearbyVendors);

// Public - business-type listings (must be before /:id routes)
router.get('/hotels', optionalAuth, vendorsController.listByType('hotel'));
router.get('/restaurants', optionalAuth, vendorsController.listByType('restaurant'));
router.get('/guides', optionalAuth, vendorsController.listByType('guide'));
router.get('/travel-agents', optionalAuth, vendorsController.listByType('travel_agent'));
router.get('/vehicle-rentals', optionalAuth, vendorsController.listByType('vehicle_rental'));
router.get('/local-shops', optionalAuth, vendorsController.listByType('local_shop'));

// Public - offers
router.get('/offers', optionalAuth, vendorsController.getPublicOffers);

// Authenticated user
router.post('/register', authenticate, validate(registerVendorSchema), vendorsController.register);
router.get('/me', authenticate, vendorsController.getMyVendor);
router.patch('/me', authenticate, validate(updateVendorSchema), vendorsController.updateMyVendor);

// Vendor reels
router.post('/reels', authenticate, requireVendorRole, validate(createVendorReelSchema), vendorsController.createVendorReel);
router.delete('/reels/:reelId', authenticate, requireVendorRole, vendorsController.deleteVendorReel);

// Vendor offers CRUD
router.post('/offers', authenticate, requireVendorRole, validate(createOfferSchema), vendorsController.createOffer);
router.get('/offers/mine', authenticate, requireVendorRole, vendorsController.listMyOffers);
router.get('/offers/:offerId', optionalAuth, vendorsController.getOfferById);
router.patch('/offers/:offerId', authenticate, requireVendorRole, validate(updateOfferSchema), vendorsController.updateOffer);
router.delete('/offers/:offerId', authenticate, requireVendorRole, vendorsController.deleteOffer);

// Vendor offer lifecycle (manage own offers)
router.post('/offers/:offerId/pause', authenticate, requireVendorRole, vendorsController.pauseOffer);
router.post('/offers/:offerId/resume', authenticate, requireVendorRole, vendorsController.resumeOffer);
router.post('/offers/:offerId/duplicate', authenticate, requireVendorRole, vendorsController.duplicateOffer);

// Offer analytics tracking (public, no auth needed)
router.post('/offers/:offerId/view', vendorsController.recordOfferView);
router.post('/offers/:offerId/click', vendorsController.recordOfferClick);

// Vendor dashboard & analytics (authenticated vendor)
router.get('/me/dashboard', authenticate, requireVendorRole, vendorsController.getDashboard);
router.get('/me/analytics', authenticate, requireVendorRole, vendorsController.getAnalytics);
router.get('/me/offers/:offerId/analytics', authenticate, requireVendorRole, vendorsController.getOfferAnalytics);

// ── Public: Map vendors list ──
router.get('/map-list', optionalAuth, vendorsController.listApprovedForMap);

// ── Public: Vendor details & reels (must be after named routes) ──
router.get('/:id/details', optionalAuth, vendorsController.getPublicDetails);
router.get('/:id/reels', optionalAuth, vendorsController.getVendorReels);
router.get('/:id/reviews', optionalAuth, vendorsController.getReviews);
router.post('/:id/review', authenticate, validate(vendorReviewSchema), vendorsController.addReview);
router.post('/:id/reviews/:reviewId/helpful', authenticate, vendorsController.markReviewHelpful);

// Admin - vendors
router.get('/', authenticate, requireAdmin, vendorsController.list);
router.get('/:id', authenticate, requireAdmin, vendorsController.getById);
router.patch('/:id/verify', authenticate, requireAdmin, validate(verifyVendorSchema), vendorsController.verify);
router.delete('/:id', authenticate, requireAdmin, vendorsController.deleteVendor);
router.patch('/:id/location', authenticate, requireAdmin, validate(adminUpdateVendorSchema), vendorsController.adminUpdateVendor);

// Admin - offers
router.get('/admin/offers/all', authenticate, requireAdmin, vendorsController.adminListAllOffers);
router.post('/admin/offers/:offerId/approve', authenticate, requireAdmin, validate(approveOfferSchema), vendorsController.approveOffer);
router.post('/admin/offers/:offerId/reject', authenticate, requireAdmin, validate(rejectOfferSchema), vendorsController.rejectOffer);

export default router;
