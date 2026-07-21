import crypto from 'crypto';
import {
  PlanAudience,
  PlanBillingPeriod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  VendorSubscriptionStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { plansService } from './plans.service';

function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getRazorpay() {
  if (!razorpayConfigured()) {
    throw new ApiError(503, 'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  // Lazy require so server boots without the package until installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function periodDays(period: PlanBillingPeriod): number {
  if (period === PlanBillingPeriod.SEMIANNUAL) return 180;
  if (period === PlanBillingPeriod.YEARLY) return 365;
  if (period === PlanBillingPeriod.LIFETIME) return 36500;
  return 30;
}

function receiptNumber() {
  return `PS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function invoiceNumber() {
  return `INV-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export const paymentsService = {
  async createRazorpayOrder(userId: string, planId: string, period: PlanBillingPeriod) {
    const plan = await plansService.getById(planId);
    if (plan.status !== 'ACTIVE') throw new ApiError(400, 'This plan is not available for purchase');
    if (plan.audience === PlanAudience.USER_PREMIUM) {
      throw new ApiError(400, 'User Premium must be purchased via Google Play or App Store billing');
    }
    if (plan.audience === PlanAudience.CREATOR) {
      throw new ApiError(400, 'Creator accounts do not require a paid membership. Subscriptions are for vendors only.');
    }

    const price = plan.prices.find((p) => p.period === period && p.isActive);
    if (!price) throw new ApiError(400, 'Selected billing period is not available for this plan');

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: price.amountPaise,
      currency: price.currency || 'INR',
      receipt: receiptNumber(),
      notes: {
        userId,
        planId,
        period,
        audience: plan.audience,
      },
    });

    const tx = await prisma.paymentTransaction.create({
      data: {
        userId,
        provider: PaymentProvider.RAZORPAY,
        status: PaymentStatus.PENDING,
        amountPaise: price.amountPaise,
        currency: price.currency || 'INR',
        description: `${plan.name} (${period})`,
        providerOrderId: order.id,
        receiptNumber: order.receipt || receiptNumber(),
        rawPayload: order as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      orderId: order.id,
      amountPaise: price.amountPaise,
      currency: price.currency || 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      transactionId: tx.id,
      plan: { id: plan.id, name: plan.name, audience: plan.audience, period },
    };
  },

  verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new ApiError(503, 'Razorpay is not configured');
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (expected !== signature) {
      throw new ApiError(400, 'Invalid payment signature');
    }
  },

  async confirmRazorpayPayment(
    userId: string,
    input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      planId: string;
      period: PlanBillingPeriod;
    },
  ) {
    this.verifyRazorpaySignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
    );

    const existing = await prisma.paymentTransaction.findFirst({
      where: { providerPaymentId: input.razorpayPaymentId },
    });
    if (existing?.status === PaymentStatus.CAPTURED) {
      return { alreadyProcessed: true, transaction: existing };
    }

    const pending = await prisma.paymentTransaction.findFirst({
      where: {
        userId,
        providerOrderId: input.razorpayOrderId,
        provider: PaymentProvider.RAZORPAY,
      },
    });
    if (!pending) throw new ApiError(404, 'Payment order not found');

    const plan = await plansService.getById(input.planId);
    const subscription = await this.activateSubscription({
      userId,
      planId: input.planId,
      audience: plan.audience,
      period: input.period,
      provider: PaymentProvider.RAZORPAY,
      providerPaymentId: input.razorpayPaymentId,
      amountPaise: pending.amountPaise,
      currency: pending.currency,
    });

    const transaction = await prisma.paymentTransaction.update({
      where: { id: pending.id },
      data: {
        status: PaymentStatus.CAPTURED,
        providerPaymentId: input.razorpayPaymentId,
        providerSignature: input.razorpaySignature,
        subscriptionId: subscription.id,
        paidAt: new Date(),
      },
    });

    const invoice = await this.createInvoice(userId, transaction.id);

    return { alreadyProcessed: false, subscription, transaction, invoice };
  },

  async activateSubscription(params: {
    userId: string;
    planId: string;
    audience: PlanAudience;
    period: PlanBillingPeriod;
    provider: PaymentProvider;
    providerPaymentId?: string;
    providerSubscriptionId?: string;
    amountPaise?: number;
    currency?: string;
    daysOverride?: number;
  }) {
    const plan = await plansService.getById(params.planId);
    const start = new Date();
    const days = params.daysOverride ?? periodDays(params.period);
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const graceEndsAt = new Date(end.getTime() + plan.gracePeriodDays * 24 * 60 * 60 * 1000);

    // End prior live subscription for same audience
    await prisma.userSubscription.updateMany({
      where: {
        userId: params.userId,
        audience: params.audience,
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE', 'PAST_DUE'] },
      },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: start },
    });

    const subscription = await prisma.userSubscription.create({
      data: {
        userId: params.userId,
        planId: params.planId,
        audience: params.audience,
        status: SubscriptionStatus.ACTIVE,
        billingPeriod: params.period,
        provider: params.provider,
        providerSubscriptionId: params.providerSubscriptionId ?? params.providerPaymentId ?? null,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        graceEndsAt,
        autoRenew: true,
      },
      include: { plan: true },
    });

    if (params.audience === PlanAudience.VENDOR) {
      await prisma.vendor.updateMany({
        where: { userId: params.userId },
        data: {
          subscriptionStatus: VendorSubscriptionStatus.ACTIVE,
          suspendedAt: null,
        },
      });
    }

    if (params.audience === PlanAudience.CREATOR) {
      const features = (plan.features as Record<string, unknown>) || {};
      await prisma.creatorProfile.updateMany({
        where: { userId: params.userId },
        data: {
          membershipPlanId: plan.id,
          membershipExpiresAt: end,
          uploadLimit: typeof features.uploadLimit === 'number' ? features.uploadLimit : null,
        },
      });
    }

    return subscription;
  },

  async createInvoice(userId: string, transactionId: string) {
    const tx = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new ApiError(404, 'Transaction not found');

    const existing = await prisma.invoice.findUnique({ where: { transactionId } });
    if (existing) return existing;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendor: true },
    });

    return prisma.invoice.create({
      data: {
        userId,
        transactionId,
        invoiceNumber: invoiceNumber(),
        amountPaise: tx.amountPaise,
        taxPaise: 0,
        currency: tx.currency,
        gstNumber: user?.vendor?.gstNumber ?? null,
        billingName: user?.vendor?.businessName || user?.name || null,
        billingAddress: user?.vendor
          ? `${user.vendor.address}, ${user.vendor.city}, ${user.vendor.state}`
          : null,
        lineItems: [
          {
            description: tx.description || 'Subscription',
            amountPaise: tx.amountPaise,
          },
        ] as Prisma.InputJsonValue,
      },
    });
  },

  async listTransactions(filters: {
    userId?: string;
    page?: number;
    limit?: number;
    status?: PaymentStatus;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const where: Prisma.PaymentTransactionWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          invoice: true,
          subscription: { include: { plan: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.paymentTransaction.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async listInvoices(userId: string, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { userId },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { transaction: true },
      }),
      prisma.invoice.count({ where: { userId } }),
    ]);
    return { data, pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) } };
  },

  async listRefunds(page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const [data, total] = await Promise.all([
      prisma.refund.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: {
          transaction: { select: { id: true, userId: true, amountPaise: true, provider: true, status: true } },
        },
      }),
      prisma.refund.count(),
    ]);
    return { data, pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) } };
  },

  async adminGrant(adminUserId: string, userId: string, planId: string, period: PlanBillingPeriod, days?: number) {
    const plan = await plansService.getById(planId);
    const price = plan.prices.find((p) => p.period === period);
    const subscription = await this.activateSubscription({
      userId,
      planId,
      audience: plan.audience,
      period,
      provider: PaymentProvider.ADMIN_GRANT,
      daysOverride: days,
      amountPaise: price?.amountPaise ?? 0,
    });

    const transaction = await prisma.paymentTransaction.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        provider: PaymentProvider.ADMIN_GRANT,
        status: PaymentStatus.CAPTURED,
        amountPaise: 0,
        currency: 'INR',
        description: `Admin grant by ${adminUserId}: ${plan.name}`,
        receiptNumber: receiptNumber(),
        paidAt: new Date(),
        rawPayload: { grantedBy: adminUserId } as Prisma.InputJsonValue,
      },
    });

    return { subscription, transaction };
  },

  async handleRazorpayWebhook(rawBody: Buffer | string, signature: string | undefined) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new ApiError(503, 'RAZORPAY_WEBHOOK_SECRET is not configured');
    if (!signature) throw new ApiError(401, 'Missing webhook signature');

    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (expected !== signature) throw new ApiError(401, 'Invalid webhook signature');

    const payload = JSON.parse(body) as {
      event: string;
      payload?: { payment?: { entity?: any }; order?: { entity?: any } };
    };

    if (payload.event === 'payment.captured') {
      const payment = payload.payload?.payment?.entity;
      if (!payment?.id || !payment?.order_id) return { ignored: true };

      const already = await prisma.paymentTransaction.findFirst({
        where: { providerPaymentId: payment.id },
      });
      if (already?.status === PaymentStatus.CAPTURED) return { ignored: true };

      const pending = await prisma.paymentTransaction.findFirst({
        where: { providerOrderId: payment.order_id, provider: PaymentProvider.RAZORPAY },
      });
      if (!pending) return { ignored: true, reason: 'order_not_found' };

      const notes = (payment.notes || {}) as Record<string, string>;
      if (!notes.userId || !notes.planId || !notes.period) {
        return { ignored: true, reason: 'missing_notes' };
      }

      const plan = await plansService.getById(String(notes.planId));
      const subscription = await this.activateSubscription({
        userId: String(notes.userId),
        planId: String(notes.planId),
        audience: plan.audience,
        period: notes.period as PlanBillingPeriod,
        provider: PaymentProvider.RAZORPAY,
        providerPaymentId: payment.id,
        amountPaise: pending.amountPaise,
      });

      const transaction = await prisma.paymentTransaction.update({
        where: { id: pending.id },
        data: {
          status: PaymentStatus.CAPTURED,
          providerPaymentId: payment.id,
          subscriptionId: subscription.id,
          paidAt: new Date(),
          rawPayload: payment as unknown as Prisma.InputJsonValue,
        },
      });
      await this.createInvoice(String(notes.userId), transaction.id);
      return { processed: true };
    }

    return { ignored: true, event: payload.event };
  },

  async revenueSummary() {
    const captured = await prisma.paymentTransaction.aggregate({
      where: { status: PaymentStatus.CAPTURED },
      _sum: { amountPaise: true },
      _count: true,
    });
    const refunded = await prisma.paymentTransaction.aggregate({
      where: { status: { in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] } },
      _sum: { amountPaise: true },
      _count: true,
    });
    const activeSubs = await prisma.userSubscription.count({
      where: { status: { in: ['ACTIVE', 'TRIALING', 'GRACE'] } },
    });
    return {
      capturedAmountPaise: captured._sum.amountPaise || 0,
      capturedCount: captured._count,
      refundedAmountPaise: refunded._sum.amountPaise || 0,
      refundedCount: refunded._count,
      activeSubscriptions: activeSubs,
    };
  },
};
