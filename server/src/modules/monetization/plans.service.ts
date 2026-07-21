import { PlanAudience, PlanStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';

type CreatePlanInput = {
  audience: PlanAudience;
  name: string;
  slug: string;
  description?: string | null;
  badge?: string | null;
  color?: string | null;
  status?: PlanStatus;
  sortOrder?: number;
  features?: Record<string, unknown>;
  trialDays?: number;
  gracePeriodDays?: number;
  googleProductIdMonthly?: string | null;
  googleProductIdYearly?: string | null;
  appleProductIdMonthly?: string | null;
  appleProductIdYearly?: string | null;
  razorpayPlanIdMonthly?: string | null;
  razorpayPlanIdYearly?: string | null;
  prices: Array<{ period: 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY' | 'LIFETIME'; amountPaise: number; currency?: string; isActive?: boolean }>;
};

const planInclude = {
  prices: { orderBy: { period: 'asc' as const } },
} satisfies Prisma.SubscriptionPlanInclude;

export const plansService = {
  async ensureDefaultVendorPlan() {
    // Creators are free — archive any leftover creator membership plans.
    await prisma.subscriptionPlan.updateMany({
      where: { audience: PlanAudience.CREATOR, status: { not: PlanStatus.ARCHIVED } },
      data: { status: PlanStatus.ARCHIVED },
    });

    const slug = 'vendor-standard';
    const features = {
      maxOffers: 50,
      analyticsLevel: 'advanced',
      featuredListing: true,
    };
    const prices = [
      { period: 'MONTHLY' as const, amountPaise: 9900, currency: 'INR', isActive: true },
      { period: 'SEMIANNUAL' as const, amountPaise: 49900, currency: 'INR', isActive: true },
    ];

    const existing = await prisma.subscriptionPlan.findUnique({
      where: { slug },
      include: planInclude,
    });

    if (!existing) {
      return prisma.subscriptionPlan.create({
        data: {
          audience: PlanAudience.VENDOR,
          name: 'Vendor Standard',
          slug,
          description: 'Unlock higher offer limits, analytics, and featured listing.',
          badge: 'Vendor',
          color: '#B9834B',
          status: PlanStatus.ACTIVE,
          sortOrder: 0,
          features,
          trialDays: 0,
          gracePeriodDays: 3,
          prices: { create: prices },
        },
        include: planInclude,
      });
    }

    // Keep live pricing aligned: ₹99 / month · ₹499 / 6 months
    await prisma.planPrice.deleteMany({ where: { planId: existing.id } });
    await prisma.planPrice.createMany({
      data: prices.map((p) => ({ planId: existing.id, ...p })),
    });
    return prisma.subscriptionPlan.update({
      where: { id: existing.id },
      data: {
        audience: PlanAudience.VENDOR,
        name: 'Vendor Standard',
        description: 'Unlock higher offer limits, analytics, and featured listing.',
        status: PlanStatus.ACTIVE,
        features,
      },
      include: planInclude,
    });
  },

  async list(filters?: { audience?: PlanAudience; status?: PlanStatus; includeInactive?: boolean }) {
    const where: Prisma.SubscriptionPlanWhereInput = {};
    if (filters?.audience) where.audience = filters.audience;
    else where.audience = { not: PlanAudience.CREATOR };
    if (filters?.status) where.status = filters.status;
    else if (!filters?.includeInactive) where.status = { in: [PlanStatus.ACTIVE, PlanStatus.DRAFT] };

    return prisma.subscriptionPlan.findMany({
      where,
      include: planInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  },

  async listPublic(audience: PlanAudience) {
    if (audience === PlanAudience.CREATOR) {
      return [];
    }
    if (audience === PlanAudience.VENDOR) {
      await this.ensureDefaultVendorPlan();
    }
    return prisma.subscriptionPlan.findMany({
      where: { audience, status: PlanStatus.ACTIVE },
      include: {
        prices: { where: { isActive: true }, orderBy: { period: 'asc' } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  },

  async getById(id: string) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: planInclude,
    });
    if (!plan) throw new ApiError(404, 'Subscription plan not found');
    return plan;
  },

  async create(input: CreatePlanInput) {
    if (input.audience === PlanAudience.CREATOR) {
      throw new ApiError(400, 'Creator membership plans are not supported. Only vendor and user-premium plans can be created.');
    }
    const existing = await prisma.subscriptionPlan.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ApiError(409, 'A plan with this slug already exists');

    return prisma.subscriptionPlan.create({
      data: {
        audience: input.audience,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        badge: input.badge ?? null,
        color: input.color ?? '#B9834B',
        status: input.status ?? PlanStatus.DRAFT,
        sortOrder: input.sortOrder ?? 0,
        features: (input.features ?? {}) as Prisma.InputJsonValue,
        trialDays: input.trialDays ?? 0,
        gracePeriodDays: input.gracePeriodDays ?? 3,
        googleProductIdMonthly: input.googleProductIdMonthly ?? null,
        googleProductIdYearly: input.googleProductIdYearly ?? null,
        appleProductIdMonthly: input.appleProductIdMonthly ?? null,
        appleProductIdYearly: input.appleProductIdYearly ?? null,
        razorpayPlanIdMonthly: input.razorpayPlanIdMonthly ?? null,
        razorpayPlanIdYearly: input.razorpayPlanIdYearly ?? null,
        prices: {
          create: input.prices.map((p) => ({
            period: p.period,
            amountPaise: p.amountPaise,
            currency: p.currency ?? 'INR',
            isActive: p.isActive ?? true,
          })),
        },
      },
      include: planInclude,
    });
  },

  async update(id: string, input: Partial<CreatePlanInput>) {
    await this.getById(id);

    if (input.audience === PlanAudience.CREATOR) {
      throw new ApiError(400, 'Creator membership plans are not supported.');
    }

    if (input.slug) {
      const clash = await prisma.subscriptionPlan.findFirst({
        where: { slug: input.slug, NOT: { id } },
      });
      if (clash) throw new ApiError(409, 'A plan with this slug already exists');
    }

    return prisma.$transaction(async (tx) => {
      if (input.prices) {
        await tx.planPrice.deleteMany({ where: { planId: id } });
        await tx.planPrice.createMany({
          data: input.prices.map((p) => ({
            planId: id,
            period: p.period,
            amountPaise: p.amountPaise,
            currency: p.currency ?? 'INR',
            isActive: p.isActive ?? true,
          })),
        });
      }

      return tx.subscriptionPlan.update({
        where: { id },
        data: {
          ...(input.audience !== undefined ? { audience: input.audience } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.badge !== undefined ? { badge: input.badge } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.features !== undefined ? { features: input.features as Prisma.InputJsonValue } : {}),
          ...(input.trialDays !== undefined ? { trialDays: input.trialDays } : {}),
          ...(input.gracePeriodDays !== undefined ? { gracePeriodDays: input.gracePeriodDays } : {}),
          ...(input.googleProductIdMonthly !== undefined ? { googleProductIdMonthly: input.googleProductIdMonthly } : {}),
          ...(input.googleProductIdYearly !== undefined ? { googleProductIdYearly: input.googleProductIdYearly } : {}),
          ...(input.appleProductIdMonthly !== undefined ? { appleProductIdMonthly: input.appleProductIdMonthly } : {}),
          ...(input.appleProductIdYearly !== undefined ? { appleProductIdYearly: input.appleProductIdYearly } : {}),
          ...(input.razorpayPlanIdMonthly !== undefined ? { razorpayPlanIdMonthly: input.razorpayPlanIdMonthly } : {}),
          ...(input.razorpayPlanIdYearly !== undefined ? { razorpayPlanIdYearly: input.razorpayPlanIdYearly } : {}),
        },
        include: planInclude,
      });
    });
  },

  async setStatus(id: string, status: PlanStatus) {
    await this.getById(id);
    return prisma.subscriptionPlan.update({
      where: { id },
      data: { status },
      include: planInclude,
    });
  },

  async duplicate(id: string) {
    const plan = await this.getById(id);
    const slug = `${plan.slug}-copy-${Date.now().toString(36)}`;
    return this.create({
      audience: plan.audience,
      name: `${plan.name} (Copy)`,
      slug,
      description: plan.description,
      badge: plan.badge,
      color: plan.color,
      status: PlanStatus.DRAFT,
      sortOrder: plan.sortOrder + 1,
      features: (plan.features as Record<string, unknown>) ?? {},
      trialDays: plan.trialDays,
      gracePeriodDays: plan.gracePeriodDays,
      googleProductIdMonthly: plan.googleProductIdMonthly,
      googleProductIdYearly: plan.googleProductIdYearly,
      appleProductIdMonthly: plan.appleProductIdMonthly,
      appleProductIdYearly: plan.appleProductIdYearly,
      razorpayPlanIdMonthly: null,
      razorpayPlanIdYearly: null,
      prices: plan.prices.map((p) => ({
        period: p.period,
        amountPaise: p.amountPaise,
        currency: p.currency,
        isActive: p.isActive,
      })),
    });
  },

  async remove(id: string) {
    const activeSubs = await prisma.userSubscription.count({
      where: {
        planId: id,
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE', 'PAST_DUE'] },
      },
    });
    if (activeSubs > 0) {
      throw new ApiError(409, 'Cannot delete a plan with active subscriptions. Deactivate it instead.');
    }
    await prisma.subscriptionPlan.delete({ where: { id } });
    return { deleted: true };
  },

  async sort(orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.subscriptionPlan.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.list({ includeInactive: true });
  },
};
