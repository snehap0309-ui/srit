import { Router } from 'express';
import { placesController } from './places.controller';
import { authenticate, optionalAuth, requireAdmin, requireVendorRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createPlaceSchema, updatePlaceSchema, updatePlaceStatusSchema,
  nearbyQuerySchema, viewportQuerySchema, statActionSchema,
  clusterQuerySchema, searchQuerySchema,
  addImageSchema, addVideoSchema,
  createOfferSchema, updateOfferSchema,
  createEventSchema, updateEventSchema,
  reviewSchema, vendorUpdatePlaceSchema,
} from './places.validation';
import { statsLimiter, createPlaceLimiter, videoUploadLimiter, placesDiscoveryLimiter } from '../../config/rateLimit';

// ── Public / User Router (mounted at /places) ──
const router = Router();

// Create
router.post('/', authenticate, createPlaceLimiter, validate(createPlaceSchema), placesController.create);

// Discovery
router.get('/', placesDiscoveryLimiter, optionalAuth, placesController.list);
router.get('/search', placesDiscoveryLimiter, optionalAuth, validate(searchQuerySchema, 'query'), placesController.search);
router.get('/viewport', placesDiscoveryLimiter, optionalAuth, validate(viewportQuerySchema, 'query'), placesController.viewport);
router.get('/viewport-search', placesDiscoveryLimiter, optionalAuth, placesController.viewportSearch);
router.get('/nearby', placesDiscoveryLimiter, optionalAuth, validate(nearbyQuerySchema, 'query'), placesController.nearby);
router.get('/clusters', placesDiscoveryLimiter, optionalAuth, validate(clusterQuerySchema, 'query'), placesController.getClusters);
router.get('/trending', placesDiscoveryLimiter, placesController.getTrending);
router.get('/hidden-gems', placesDiscoveryLimiter, placesController.getHiddenGems);
router.get('/hotspots', placesDiscoveryLimiter, placesController.getHotspots);

// User submissions
router.get('/mine', authenticate, placesController.getMySubmissions);
router.get('/saved', authenticate, placesController.getSavedPlaces);

// Single place
router.get('/:id', optionalAuth, placesController.getById);
router.get('/:id/nearby-vendors', placesDiscoveryLimiter, placesController.getNearbyVendors);
router.patch('/:id', authenticate, validate(updatePlaceSchema), placesController.update);
router.delete('/:id', authenticate, placesController.delete);

// Stats & Analytics
router.get('/:id/stats', statsLimiter, placesController.getStats);
router.get('/:id/analytics', placesController.getAnalytics);
router.get('/:id/recommendations', placesController.getRecommendations);
router.post('/:id/stats', statsLimiter, optionalAuth, validate(statActionSchema), placesController.recordStat);

// Media
router.get('/:id/images', placesController.getImages);
router.post('/:id/images', authenticate, validate(addImageSchema), placesController.addImage);
router.delete('/:id/images/:imageId', authenticate, placesController.deleteImage);
router.patch('/:id/images/:imageId/primary', authenticate, placesController.setPrimaryImage);
router.get('/:id/videos', placesController.getVideos);
router.post('/:id/videos', authenticate, videoUploadLimiter, validate(addVideoSchema), placesController.addVideo);
router.delete('/:id/videos/:videoId', authenticate, placesController.deleteVideo);
router.get('/:id/reels', placesController.getReels);

// Social
router.post('/:id/save', authenticate, placesController.savePlace);
router.delete('/:id/save', authenticate, placesController.unsavePlace);
router.post('/:id/checkin', authenticate, placesController.checkIn);
router.post('/:id/review', authenticate, validate(reviewSchema), placesController.addReview);
router.get('/:id/reviews', placesController.getReviews);
router.post('/:id/reviews/:reviewId/helpful', authenticate, placesController.markReviewHelpful);

// Offers & Events (read-only public)
router.get('/:id/offers', placesController.getOffers);
router.get('/:id/events', placesController.getEvents);

// Status update (admin via places router - legacy)
router.patch('/:id/status', authenticate, requireAdmin, validate(updatePlaceStatusSchema), placesController.updateStatus);

export default router;

// ── Admin Router (mounted at /admin/places) ──
export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/pending', placesController.getPendingPlaces);
adminRouter.post('/import', placesController.bulkImport);
adminRouter.delete('/', placesController.adminDeleteAll);
adminRouter.patch('/:id', validate(updatePlaceSchema), placesController.adminUpdate);
adminRouter.patch('/:id/approve', placesController.approvePlace);
adminRouter.patch('/:id/reject', placesController.rejectPlace);
adminRouter.delete('/:id', placesController.adminDeletePlace);

// ── Vendor Router (mounted at /vendor/places) ──
export const vendorRouter = Router();
vendorRouter.use(authenticate, requireVendorRole);

vendorRouter.patch('/:id', validate(vendorUpdatePlaceSchema), placesController.vendorUpdate);
vendorRouter.get('/:id/offers', placesController.getOffers);
vendorRouter.post('/:id/offers', validate(createOfferSchema), placesController.addOffer);
vendorRouter.patch('/:id/offers/:offerId', validate(updateOfferSchema), placesController.updateOffer);
vendorRouter.delete('/:id/offers/:offerId', placesController.deleteOffer);
vendorRouter.get('/:id/events', placesController.getEvents);
vendorRouter.post('/:id/events', validate(createEventSchema), placesController.addEvent);
vendorRouter.patch('/:id/events/:eventId', validate(updateEventSchema), placesController.updateEvent);
vendorRouter.delete('/:id/events/:eventId', placesController.deleteEvent);
vendorRouter.post('/:id/images', validate(addImageSchema), placesController.addImage);
vendorRouter.delete('/:id/images/:imageId', placesController.deleteImage);
vendorRouter.post('/:id/videos', videoUploadLimiter, validate(addVideoSchema), placesController.addVideo);
vendorRouter.delete('/:id/videos/:videoId', placesController.deleteVideo);
