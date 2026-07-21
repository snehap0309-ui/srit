import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/pagination';
import { eventBus, AppEvents } from '../../config/events';
import { CreateHiddenGemInput, ApproveHiddenGemInput, RejectHiddenGemInput } from './hiddenGems.validation';
import { resolvePlace } from '../places/services/places.helpers';
import { walletService } from '../wallet/wallet.service';
import { pointRulesService } from '../point-rules/pointRules.service';
import { logger } from '../../config/logger';

const HIDDEN_GEM_CATEGORIES = [
  'waterfall', 'sunset_point', 'old_temple', 'local_viewpoint',
  'photo_spot', 'river_ghat', 'small_fort', 'nature_trail',
  'cultural_place', 'lake', 'cave', 'wildlife', 'heritage', 'other',
];

export const hiddenGemsService = {
  async create(input: CreateHiddenGemInput, userId: string) {

    let bestTimeDb: any;
    if (input.bestTimeToVisit) {
      if (typeof input.bestTimeToVisit === 'string') {
        bestTimeDb = { from: 'Any', to: 'Any', label: input.bestTimeToVisit };
      } else {
        bestTimeDb = {
          from: input.bestTimeToVisit.from,
          to: input.bestTimeToVisit.to,
          label: input.bestTimeToVisit.label || undefined,
        };
      }
    }

    const place = await prisma.place.create({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        latitude: true,
        longitude: true,
        category: true,
        images: true,
        thumbnail: true,
        tags: true,
        status: true,
        city: true,
        state: true,
        country: true,
        rating: true,
        reviewCount: true,
        hiddenGemScore: true,
        popularityScore: true,
        verificationLevel: true,
        bestTimeToVisit: true,
        submittedBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
      data: {
        name: input.placeName,
        slug: `hidden-gem-${input.placeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        shortDescription: input.description.substring(0, 200),
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        category: 'hidden_gem',
        images: input.imageUri ? [input.imageUri] : [],
        tags: [input.category, 'hidden-gem', 'pending-review'],
        city: input.city,
        state: input.state,
        country: 'India',
        submittedById: userId,
        status: 'PENDING',
        hiddenGemScore: 0,
        popularityScore: 0,
        verificationLevel: 0,
        bestTimeToVisit: bestTimeDb ? JSON.parse(JSON.stringify(bestTimeDb)) : undefined,
      },
    });

    const submission = {
      id: place.id,
      userId,
      userName: (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name || 'User',
      placeName: input.placeName,
      category: input.category,
      city: input.city,
      state: input.state,
      latitude: input.latitude,
      longitude: input.longitude,
      imageUri: input.imageUri,
      description: input.description,
      bestTimeToVisit: place.bestTimeToVisit || bestTimeDb || null,
      estimatedCost: input.estimatedCost,
      safetyTip: input.safetyTip,
      worthVisitingReason: input.worthVisitingReason,
      locationMethod: input.locationMethod,
      status: 'pending',
      submittedAt: place.createdAt.getTime(),
      pointsReward: 0,
    };

    eventBus.emit(AppEvents.PLACE_CREATED, {
      placeId: place.id,
      actorId: userId,
      data: submission,
    });

    return submission;
  },

  async list(query: { page?: string; limit?: string; status?: string }, viewer?: { isAdmin?: boolean; userId?: string }) {
    const pagination = getPaginationParams(query);
    const where: any = { category: 'hidden_gem' };
    const requestedStatus = query.status ? query.status.toUpperCase() : undefined;

    if (viewer?.isAdmin) {
      if (requestedStatus) where.status = requestedStatus;
    } else if (requestedStatus && requestedStatus !== 'APPROVED') {
      where.status = requestedStatus;
      where.submittedById = viewer?.userId || '__none__';
    } else {
      where.status = 'APPROVED';
    }

    const [data, total] = await Promise.all([
      prisma.place.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          shortDescription: true,
          latitude: true,
          longitude: true,
          category: true,
          images: true,
          thumbnail: true,
          tags: true,
          status: true,
          city: true,
          state: true,
          country: true,
          rating: true,
          reviewCount: true,
          hiddenGemScore: true,
          popularityScore: true,
          verificationLevel: true,
          rejectionReason: true,
          bestTimeToVisit: true,
          submittedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.place.count({ where }),
    ]);

    const submissions = data.map((p) => ({
      id: p.id,
      userId: p.submittedBy?.id || '',
      userName: p.submittedBy?.name || 'System',
      placeName: p.name,
      category: p.tags.find((t: string) => HIDDEN_GEM_CATEGORIES.includes(t)) || 'other',
      city: p.city,
      state: p.state,
      latitude: p.latitude,
      longitude: p.longitude,
      imageUri: p.images[0] || null,
      description: p.description,
      bestTimeToVisit: p.bestTimeToVisit || null,
      status: p.status.toLowerCase(),
      submittedAt: p.createdAt.getTime(),
      pointsReward: p.hiddenGemScore || 0,
      reviewedAt: p.reviewedAt?.getTime(),
      reviewedBy: p.approvedBy?.name,
      rejectionReason: p.rejectionReason,
    }));

    return paginatedResponse(submissions, total, pagination);
  },

  async getById(idOrSlug: string, viewer?: { isAdmin?: boolean; userId?: string }) {
    const { id } = await resolvePlace(idOrSlug);
    const place = await prisma.place.findFirst({
      where: { id, category: 'hidden_gem' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        latitude: true,
        longitude: true,
        category: true,
        images: true,
        thumbnail: true,
        tags: true,
        status: true,
        city: true,
        state: true,
        country: true,
        rating: true,
        reviewCount: true,
        hiddenGemScore: true,
        popularityScore: true,
        verificationLevel: true,
        rejectionReason: true,
        bestTimeToVisit: true,
        submittedById: true,
        submittedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!place) {
      throw new ApiError(404, 'Hidden gem not found.');
    }
    if (place.status !== 'APPROVED') {
      const allowed =
        viewer?.isAdmin ||
        (!!viewer?.userId && place.submittedById === viewer.userId);
      if (!allowed) {
        throw new ApiError(404, 'Hidden gem not found.');
      }
    }

    return {
      id: place.id,
      userId: place.submittedBy?.id || '',
      userName: place.submittedBy?.name || 'System',
      placeName: place.name,
      category: place.tags.find((t: string) => HIDDEN_GEM_CATEGORIES.includes(t)) || 'other',
      city: place.city,
      state: place.state,
      latitude: place.latitude,
      longitude: place.longitude,
      imageUri: place.images[0] || null,
      description: place.description,
      bestTimeToVisit: place.bestTimeToVisit || null,
      status: place.status.toLowerCase(),
      submittedAt: place.createdAt.getTime(),
      pointsReward: place.hiddenGemScore || 0,
      reviewedAt: place.reviewedAt?.getTime(),
      reviewedBy: place.approvedBy?.name,
      rejectionReason: place.rejectionReason,
    };
  },

  async approve(idOrSlug: string, input: ApproveHiddenGemInput, adminId: string) {
    const { id } = await resolvePlace(idOrSlug);
    const place = await prisma.place.findFirst({
      where: { id, category: 'hidden_gem' },
    });
    if (!place) {
      throw new ApiError(404, 'Hidden gem not found.');
    }
    if (place.status !== 'PENDING') {
      throw new ApiError(400, 'Only pending hidden gems can be approved.');
    }

    const rule = await pointRulesService.getPointsForAction('hidden_gem');
    const points = input.points ?? rule?.points ?? 50;
    const previous = { status: place.status };

    const updated = await prisma.place.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: adminId,
        reviewedAt: new Date(),
        hiddenGemScore: points,
      },
    });

    if (place.submittedById && points > 0) {
      try {
        await walletService.earn(place.submittedById, points, 'hidden_gem', updated.id, 'HIDDEN_GEM');
      } catch (error) {
        logger.error({ error, placeId: id }, 'Failed to award hidden gem points');
      }
    }

    eventBus.emit(AppEvents.PLACE_APPROVED, {
      placeId: id,
      actorId: adminId,
      submitterId: place.submittedById,
      placeName: place.name,
      previous,
    });

    return {
      id: updated.id,
      status: 'approved',
      pointsReward: points,
      reviewedAt: updated.reviewedAt?.getTime(),
    };
  },

  async reject(idOrSlug: string, input: RejectHiddenGemInput, adminId: string) {
    const { id } = await resolvePlace(idOrSlug);
    const place = await prisma.place.findFirst({
      where: { id, category: 'hidden_gem' },
    });
    if (!place) {
      throw new ApiError(404, 'Hidden gem not found.');
    }
    if (place.status !== 'PENDING') {
      throw new ApiError(400, 'Only pending hidden gems can be rejected.');
    }

    const updated = await prisma.place.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: input.reason || null,
      },
    });

    eventBus.emit(AppEvents.PLACE_REJECTED, {
      placeId: id,
      actorId: adminId,
      submitterId: place.submittedById,
      placeName: place.name,
      reason: input.reason || null,
      previous: { status: place.status },
    });

    return {
      id: updated.id,
      status: 'rejected',
      reviewedAt: updated.reviewedAt?.getTime(),
      rejectionReason: input.reason,
    };
  },
};