import {
  PlanAudience,
  SubscriptionStatus,
  VendorSubscriptionStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';

const LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.GRACE,
  SubscriptionStatus.PAST_DUE,
];

function featuresOf(features: unknown): Record<string, unknown> {
  if (features && typeof features === 'object' && !Array.isArray(features)) {
    return features as Record<string, unknown>;
  }
  return {};
}

export const entitlementsService = {
  async getForUser(userId: string) {
    const now = new Date();
    await this.reconcileExpired(userId, now);

    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        userId,
        status: { in: LIVE_STATUSES },
        currentPeriodEnd: { gte: now },
      },
      include: {
        plan: { include: { prices: true } },
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    const premium = subscriptions.find((s) => s.audience === PlanAudience.USER_PREMIUM) ?? null;
    const vendor = subscriptions.find((s) => s.audience === PlanAudience.VENDOR) ?? null;
    const creator = subscriptions.find((s) => s.audience === PlanAudience.CREATOR) ?? null;

    const isPremium = !!premium;
    const vendorFeatures = featuresOf(vendor?.plan.features);
    const creatorFeatures = featuresOf(creator?.plan.features);
    const premiumFeatures = featuresOf(premium?.plan.features);

    return {
      isPremium,
      showAds: !isPremium,
      premiumBadge: isPremium ? (String(premiumFeatures.badge || premium?.plan.badge || 'Premium')) : null,
      premiumTheme: isPremium && premiumFeatures.premiumTheme !== false,
      premiumExpiresAt: premium?.currentPeriodEnd ?? null,
      premiumPlan: premium
        ? {
            id: premium.planId,
            name: premium.plan.name,
            status: premium.status,
            period: premium.billingPeriod,
            features: premiumFeatures,
          }
        : null,
      vendorSubscription: vendor
        ? {
            id: vendor.id,
            planId: vendor.planId,
            name: vendor.plan.name,
            status: vendor.status,
            period: vendor.billingPeriod,
            expiresAt: vendor.currentPeriodEnd,
            graceEndsAt: vendor.graceEndsAt,
            features: vendorFeatures,
            maxOffers: Number(vendorFeatures.maxOffers ?? 50),
            maxStaff: Number(vendorFeatures.maxStaff ?? 1),
            analyticsLevel: String(vendorFeatures.analyticsLevel ?? 'basic'),
            featuredListing: Boolean(vendorFeatures.featuredListing),
            redemptionLimit: Number(vendorFeatures.redemptionLimit ?? 1000),
          }
        : null,
      creatorMembership: creator
        ? {
            id: creator.id,
            planId: creator.planId,
            name: creator.plan.name,
            status: creator.status,
            period: creator.billingPeriod,
            expiresAt: creator.currentPeriodEnd,
            features: creatorFeatures,
            uploadLimit: Number(creatorFeatures.uploadLimit ?? 30),
            analyticsLevel: String(creatorFeatures.analyticsLevel ?? 'basic'),
            verifiedBadge: Boolean(creatorFeatures.verifiedBadge),
            priorityRanking: Boolean(creatorFeatures.priorityRanking),
          }
        : null,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        audience: s.audience,
        status: s.status,
        planName: s.plan.name,
        period: s.billingPeriod,
        expiresAt: s.currentPeriodEnd,
        autoRenew: s.autoRenew,
        provider: s.provider,
      })),
    };
  },

  async reconcileExpired(userId: string, now = new Date()) {
    const expired = await prisma.userSubscription.findMany({
      where: {
        userId,
        status: { in: LIVE_STATUSES },
        currentPeriodEnd: { lt: now },
      },
    });

    for (const sub of expired) {
      const graceEnd = sub.graceEndsAt ?? sub.currentPeriodEnd;
      if (graceEnd > now && sub.status !== SubscriptionStatus.GRACE) {
        await prisma.userSubscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.GRACE },
        });
        if (sub.audience === PlanAudience.VENDOR) {
          await prisma.vendor.updateMany({
            where: { userId },
            data: { subscriptionStatus: VendorSubscriptionStatus.GRACE },
          });
        }
        continue;
      }

      if (graceEnd <= now) {
        await prisma.userSubscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });
        if (sub.audience === PlanAudience.VENDOR) {
          await prisma.vendor.updateMany({
            where: { userId },
            data: {
              subscriptionStatus: VendorSubscriptionStatus.EXPIRED,
              suspendedAt: now,
            },
          });
        }
        if (sub.audience === PlanAudience.CREATOR) {
          await prisma.creatorProfile.updateMany({
            where: { userId },
            data: { membershipExpiresAt: sub.currentPeriodEnd },
          });
        }
      }
    }
  },
};
