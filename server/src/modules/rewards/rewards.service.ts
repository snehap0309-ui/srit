import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import type { CreateRewardInput, UpdateRewardInput, RewardQueryInput } from './rewards.validation';

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const rewardsService = {
  async listRewards(query: RewardQueryInput) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.isActive === undefined) where.isActive = true;
    else if (query.isActive === 'true') where.isActive = true;
    else if (query.isActive === 'false') where.isActive = false;

    if (query.category) where.category = query.category;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.minPoints || query.maxPoints) {
      where.pointsRequired = {};
      if (query.minPoints) where.pointsRequired.gte = parseInt(query.minPoints, 10);
      if (query.maxPoints) where.pointsRequired.lte = parseInt(query.maxPoints, 10);
    }
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };
    if (query.city) {
      where.vendor = { city: { contains: query.city, mode: 'insensitive' } };
    }

    const orderBy: any = query.sort === 'points_asc'
      ? { pointsRequired: 'asc' }
      : query.sort === 'points_desc'
        ? { pointsRequired: 'desc' }
        : query.sort === 'newest'
          ? { createdAt: 'desc' }
          : [{ sortOrder: 'asc' }, { createdAt: 'desc' }];

    const [data, total] = await Promise.all([
      prisma.rewardCatalog.findMany({
        where,
        include: {
          vendor: { select: { id: true, businessName: true, city: true, state: true, imageUrl: true } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.rewardCatalog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },

  async getRewardById(id: string) {
    const reward = await prisma.rewardCatalog.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, businessName: true, city: true, state: true, imageUrl: true } },
      },
    });
    if (!reward) throw new ApiError(404, 'Reward not found');
    return reward;
  },

  async createReward(input: CreateRewardInput) {
    return prisma.rewardCatalog.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        pointsRequired: input.pointsRequired,
        value: input.value,
        imageUrl: input.imageUrl,
        vendorId: input.vendorId,
        vendorOfferId: input.vendorOfferId,
        sortOrder: input.sortOrder ?? 0,
      },
      include: {
        vendor: { select: { id: true, businessName: true, city: true, state: true, imageUrl: true } },
      },
    });
  },

  async updateReward(id: string, input: UpdateRewardInput) {
    const existing = await prisma.rewardCatalog.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Reward not found');

    return prisma.rewardCatalog.update({
      where: { id },
      data: input,
      include: {
        vendor: { select: { id: true, businessName: true, city: true, state: true, imageUrl: true } },
      },
    });
  },

  async deleteReward(id: string) {
    const existing = await prisma.rewardCatalog.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Reward not found');

    await prisma.rewardCatalog.delete({ where: { id } });
  },

  async listVendorOffers(query: { category?: string; city?: string; minPoints?: string; maxPoints?: string; vendorId?: string; page?: string; limit?: string; sort?: string }) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;
    const where: any = { isApproved: true, isActive: true };

    if (query.category) where.category = query.category;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.minPoints || query.maxPoints) {
      where.pointsRequired = {};
      if (query.minPoints) where.pointsRequired.gte = parseInt(query.minPoints, 10);
      if (query.maxPoints) where.pointsRequired.lte = parseInt(query.maxPoints, 10);
    }
    if (query.city) {
      where.vendor = { city: { contains: query.city, mode: 'insensitive' } };
    }

    const orderBy: any = query.sort === 'points_asc'
      ? { pointsRequired: 'asc' }
      : query.sort === 'points_desc'
        ? { pointsRequired: 'desc' }
        : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      prisma.vendorOffer.findMany({
        where,
        include: {
          vendor: { select: { id: true, businessName: true, city: true, state: true, imageUrl: true } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.vendorOffer.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },

  async getNearbyRewards(lat: number, lng: number, radiusKm: number) {
    const vendors = await prisma.vendor.findMany({
      where: {
        status: 'APPROVED',
        latitude: { not: null },
        longitude: { not: null },
        showOnMap: true,
      },
      select: {
        id: true,
        businessName: true,
        latitude: true,
        longitude: true,
        city: true,
        state: true,
        imageUrl: true,
        offers: {
          where: { isApproved: true, isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const nearby = vendors
      .map((v) => ({
        ...v,
        distance: haversineDistance(lat, lng, v.latitude!, v.longitude!),
      }))
      .filter((v) => v.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return nearby;
  },
};
