import { Router } from 'express';
import { authenticate, optionalAuth, requireAdmin, requireVendorRole } from '../../middleware/auth';
import { monetizationController } from './monetization.controller';

const router = Router();

// ── Public / client ──────────────────────────────────────────────
router.get('/plans', monetizationController.listPlansPublic);
router.get('/plans/:id', monetizationController.getPlan);
router.get('/ads/config', optionalAuth, monetizationController.getAdConfigClient);

// ── Authenticated user ───────────────────────────────────────────
router.get('/entitlements/me', authenticate, monetizationController.getMyEntitlements);
router.get('/transactions/me', authenticate, monetizationController.listMyTransactions);
router.get('/invoices/me', authenticate, monetizationController.listMyInvoices);
router.get('/invoices/:id/pdf', authenticate, monetizationController.downloadInvoicePdf);
router.post('/razorpay/order', authenticate, monetizationController.createRazorpayOrder);
router.post('/razorpay/verify', authenticate, monetizationController.verifyRazorpayPayment);
router.post('/iap/verify', authenticate, monetizationController.verifyIap);

// Vendor ops
router.get('/vendor/customers', authenticate, requireVendorRole, monetizationController.vendorCustomers);
router.get('/vendor/customers/export.csv', authenticate, requireVendorRole, monetizationController.vendorCustomersCsv);
router.get('/vendor/documents', authenticate, requireVendorRole, monetizationController.listMyDocuments);
router.post('/vendor/documents', authenticate, requireVendorRole, monetizationController.uploadDocument);
router.post('/vendor/coupons', authenticate, requireVendorRole, monetizationController.createCouponVendor);

// Webhook (no JWT — signature verified)
router.post('/razorpay/webhook', monetizationController.razorpayWebhook);

// ── Admin ────────────────────────────────────────────────────────
router.get('/admin/plans', authenticate, requireAdmin, monetizationController.listPlansAdmin);
router.post('/admin/plans', authenticate, requireAdmin, monetizationController.createPlan);
router.post('/admin/plans/sort', authenticate, requireAdmin, monetizationController.sortPlans);
router.patch('/admin/plans/:id', authenticate, requireAdmin, monetizationController.updatePlan);
router.patch('/admin/plans/:id/status', authenticate, requireAdmin, monetizationController.setPlanStatus);
router.post('/admin/plans/:id/duplicate', authenticate, requireAdmin, monetizationController.duplicatePlan);
router.delete('/admin/plans/:id', authenticate, requireAdmin, monetizationController.deletePlan);

router.get('/admin/transactions', authenticate, requireAdmin, monetizationController.listTransactionsAdmin);
router.get('/admin/invoices/:id/pdf', authenticate, requireAdmin, monetizationController.downloadInvoicePdfAdmin);
router.get('/admin/refunds', authenticate, requireAdmin, monetizationController.listRefundsAdmin);
router.get('/admin/revenue', authenticate, requireAdmin, monetizationController.revenueSummary);
router.post('/admin/grant', authenticate, requireAdmin, monetizationController.adminGrant);

router.get('/admin/ads', authenticate, requireAdmin, monetizationController.getAdConfigAdmin);
router.patch('/admin/ads', authenticate, requireAdmin, monetizationController.updateAdConfig);

router.get('/admin/coupons', authenticate, requireAdmin, monetizationController.listCoupons);
router.post('/admin/coupons', authenticate, requireAdmin, monetizationController.createCouponAdmin);
router.delete('/admin/coupons/:id', authenticate, requireAdmin, monetizationController.deleteCoupon);

router.get('/admin/documents', authenticate, requireAdmin, monetizationController.listDocumentsAdmin);
router.patch('/admin/documents/:id', authenticate, requireAdmin, monetizationController.reviewDocument);

export default router;
