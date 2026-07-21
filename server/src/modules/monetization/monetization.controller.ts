import { Request, Response } from 'express';
import { PlanAudience, PlanStatus } from '@prisma/client';
import { catchAsync } from '../../shared/utils/catchAsync';
import { plansService } from './plans.service';
import { entitlementsService } from './entitlements.service';
import { paymentsService } from './payments.service';
import { adsService } from './ads.service';
import { couponsService } from './coupons.service';
import { customersService } from './customers.service';
import { documentsService } from './documents.service';
import { iapService } from './iap.service';
import {
  createPlanSchema,
  updatePlanSchema,
  sortPlansSchema,
  createRazorpayOrderSchema,
  verifyRazorpayPaymentSchema,
  verifyIapSchema,
  createCouponSchema,
  updateAdConfigSchema,
  createVendorDocumentSchema,
  reviewVendorDocumentSchema,
  adminGrantSubscriptionSchema,
} from './monetization.validation';

export const monetizationController = {
  // Plans
  listPlansAdmin: catchAsync(async (req: Request, res: Response) => {
    const audience = req.query.audience as PlanAudience | undefined;
    const status = req.query.status as PlanStatus | undefined;
    const data = await plansService.list({ audience, status, includeInactive: true });
    res.json({ success: true, data });
  }),

  listPlansPublic: catchAsync(async (req: Request, res: Response) => {
    const audience = (req.query.audience as PlanAudience) || PlanAudience.USER_PREMIUM;
    const data = await plansService.listPublic(audience);
    res.json({ success: true, data });
  }),

  getPlan: catchAsync(async (req: Request, res: Response) => {
    const data = await plansService.getById(String(req.params.id));
    res.json({ success: true, data });
  }),

  createPlan: catchAsync(async (req: Request, res: Response) => {
    const input = createPlanSchema.parse(req.body);
    const data = await plansService.create(input);
    res.status(201).json({ success: true, data });
  }),

  updatePlan: catchAsync(async (req: Request, res: Response) => {
    const input = updatePlanSchema.parse(req.body);
    const data = await plansService.update(String(req.params.id), input);
    res.json({ success: true, data });
  }),

  setPlanStatus: catchAsync(async (req: Request, res: Response) => {
    const status = req.body.status as PlanStatus;
    const data = await plansService.setStatus(String(req.params.id), status);
    res.json({ success: true, data });
  }),

  duplicatePlan: catchAsync(async (req: Request, res: Response) => {
    const data = await plansService.duplicate(String(req.params.id));
    res.status(201).json({ success: true, data });
  }),

  deletePlan: catchAsync(async (req: Request, res: Response) => {
    const data = await plansService.remove(String(req.params.id));
    res.json({ success: true, data });
  }),

  sortPlans: catchAsync(async (req: Request, res: Response) => {
    const input = sortPlansSchema.parse(req.body);
    const data = await plansService.sort(input.orderedIds);
    res.json({ success: true, data });
  }),

  // Entitlements
  getMyEntitlements: catchAsync(async (req: any, res: Response) => {
    const data = await entitlementsService.getForUser(req.user!.id);
    res.json({ success: true, data });
  }),

  // Payments
  createRazorpayOrder: catchAsync(async (req: any, res: Response) => {
    const input = createRazorpayOrderSchema.parse(req.body);
    const data = await paymentsService.createRazorpayOrder(req.user!.id, input.planId, input.period);
    res.status(201).json({ success: true, data });
  }),

  verifyRazorpayPayment: catchAsync(async (req: any, res: Response) => {
    const input = verifyRazorpayPaymentSchema.parse(req.body);
    const data = await paymentsService.confirmRazorpayPayment(req.user!.id, input);
    res.json({ success: true, data });
  }),

  razorpayWebhook: catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const raw = (req as any).rawBody || JSON.stringify(req.body);
    const data = await paymentsService.handleRazorpayWebhook(raw, signature);
    res.json({ success: true, data });
  }),

  verifyIap: catchAsync(async (req: any, res: Response) => {
    const input = verifyIapSchema.parse(req.body);
    const data = await iapService.verifyAndActivate(req.user!.id, input);
    res.json({ success: true, data });
  }),

  listMyTransactions: catchAsync(async (req: any, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await paymentsService.listTransactions({ userId: req.user!.id, page, limit });
    res.json({ success: true, ...result });
  }),

  listMyInvoices: catchAsync(async (req: any, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await paymentsService.listInvoices(req.user!.id, page, limit);
    res.json({ success: true, ...result });
  }),

  downloadInvoicePdf: catchAsync(async (req: any, res: Response) => {
    const { invoicePdfService } = await import('./invoicePdf.service');
    const { buffer, filename } = await invoicePdfService.buildPdfBuffer(req.user!.id, String(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }),

  downloadInvoicePdfAdmin: catchAsync(async (req: any, res: Response) => {
    const { invoicePdfService } = await import('./invoicePdf.service');
    const { buffer, filename } = await invoicePdfService.buildPdfBuffer(
      req.user!.id,
      String(req.params.id),
      true,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }),

  listTransactionsAdmin: catchAsync(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await paymentsService.listTransactions({
      page,
      limit,
      userId: req.query.userId ? String(req.query.userId) : undefined,
    });
    res.json({ success: true, ...result });
  }),

  revenueSummary: catchAsync(async (_req: Request, res: Response) => {
    const data = await paymentsService.revenueSummary();
    res.json({ success: true, data });
  }),

  adminGrant: catchAsync(async (req: any, res: Response) => {
    const input = adminGrantSubscriptionSchema.parse(req.body);
    const data = await paymentsService.adminGrant(
      req.user!.id,
      input.userId,
      input.planId,
      input.period,
      input.days,
    );
    res.status(201).json({ success: true, data });
  }),

  listRefundsAdmin: catchAsync(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const data = await paymentsService.listRefunds(page, limit);
    res.json({ success: true, ...data });
  }),

  // Ads
  getAdConfigClient: catchAsync(async (req: any, res: Response) => {
    const data = await adsService.getClientConfig({
      userId: req.user?.id,
      country: req.query.country ? String(req.query.country) : undefined,
      appVersion: req.query.appVersion ? String(req.query.appVersion) : undefined,
      platform: req.query.platform === 'ios' ? 'ios' : 'android',
    });
    res.json({ success: true, data });
  }),

  getAdConfigAdmin: catchAsync(async (_req: Request, res: Response) => {
    const data = await adsService.getAdminConfig();
    res.json({ success: true, data });
  }),

  updateAdConfig: catchAsync(async (req: Request, res: Response) => {
    const input = updateAdConfigSchema.parse(req.body);
    const data = await adsService.update(input);
    res.json({ success: true, data });
  }),

  // Coupons
  listCoupons: catchAsync(async (req: Request, res: Response) => {
    const data = await couponsService.list({
      q: req.query.q ? String(req.query.q) : undefined,
      vendorId: req.query.vendorId ? String(req.query.vendorId) : undefined,
    });
    res.json({ success: true, data });
  }),

  createCouponAdmin: catchAsync(async (req: Request, res: Response) => {
    const input = createCouponSchema.parse(req.body);
    const data = await couponsService.create(input, 'ADMIN');
    res.status(201).json({ success: true, data });
  }),

  createCouponVendor: catchAsync(async (req: any, res: Response) => {
    const input = createCouponSchema.parse(req.body);
    const vendor = await import('../../config/database').then((m) =>
      m.prisma.vendor.findUnique({ where: { userId: req.user!.id } }),
    );
    if (!vendor) {
      res.status(404).json({ success: false, message: 'Vendor profile not found' });
      return;
    }
    const data = await couponsService.create({ ...input, vendorId: vendor.id }, 'VENDOR');
    res.status(201).json({ success: true, data });
  }),

  deleteCoupon: catchAsync(async (req: Request, res: Response) => {
    const data = await couponsService.remove(String(req.params.id));
    res.json({ success: true, data });
  }),

  // Customers
  vendorCustomers: catchAsync(async (req: any, res: Response) => {
    const result = await customersService.forVendor(req.user!.id, {
      q: req.query.q ? String(req.query.q) : undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ success: true, ...result });
  }),

  vendorCustomersCsv: catchAsync(async (req: any, res: Response) => {
    const csv = await customersService.exportCsv(req.user!.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  }),

  // Documents
  listMyDocuments: catchAsync(async (req: any, res: Response) => {
    const data = await documentsService.listForVendorUser(req.user!.id);
    res.json({ success: true, data });
  }),

  uploadDocument: catchAsync(async (req: any, res: Response) => {
    const input = createVendorDocumentSchema.parse(req.body);
    const data = await documentsService.upload(req.user!.id, input);
    res.status(201).json({ success: true, data });
  }),

  listDocumentsAdmin: catchAsync(async (req: Request, res: Response) => {
    const result = await documentsService.listPendingAdmin(
      Number(req.query.page) || 1,
      Number(req.query.limit) || 50,
    );
    res.json({ success: true, ...result });
  }),

  reviewDocument: catchAsync(async (req: Request, res: Response) => {
    const input = reviewVendorDocumentSchema.parse(req.body);
    const data = await documentsService.review(
      String(req.params.id),
      input.status as any,
      input.rejectionReason,
    );
    res.json({ success: true, data });
  }),
};
