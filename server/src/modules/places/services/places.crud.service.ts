import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ApiError } from '../../../shared/utils/ApiError';
import { getPaginationParams, paginatedResponse } from '../../../shared/utils/pagination';
import { eventBus, AppEvents } from '../../../config/events';
import {
  CreatePlaceInput, UpdatePlaceInput, VendorUpdatePlaceInput,
  CreateOfferInput, UpdateOfferInput, CreateEventInput, UpdateEventInput,
  AddImageInput, AddVideoInput, ReviewInput,
} from '../places.validation';
import {
  placeListSelect, placeDetailSelect, generateSlug,
  verifyVendorAccess, verifyAccess, recalculatePlaceRating, resolvePlace,
  dedupeImageUrls,
} from './places.helpers';
import { dedupePlacesByLocation } from '../../../shared/utils/placeDedupe';
import { walletService } from '../../wallet/wallet.service';
import { pointRulesService } from '../../point-rules/pointRules.service';
import { logger } from '../../../config/logger';

export const placesCrudService = {
  async create(input: CreatePlaceInput, userId: string) {
    const slug = await generateSlug(input.name);

    function safeJson(val: unknown) {
      return val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined;
    }

    const images = dedupeImageUrls(input.images);
    const place = await prisma.place.create({
      select: placeListSelect,
      data: {
        name: input.name,
        slug,
        shortDescription: input.shortDescription || (input.description?.substring(0, 200) ?? ''),
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        category: input.category,
        images,
        thumbnail: images[0] || null,
        tags: input.tags ?? [],
        city: input.city ?? '',
        state: input.state ?? '',
        country: input.country ?? 'India',
        openingHours: safeJson(input.openingHours),
        ticketPrice: safeJson(input.ticketPrice),
        history: input.history,
        recommendedDuration: input.recommendedDuration,
        hasParking: input.hasParking,
        parkingDetails: input.parkingDetails,
        isAccessible: input.isAccessible,
        accessibilityDetails: input.accessibilityDetails,
        hasWashroom: input.hasWashroom,
        isPetFriendly: input.isPetFriendly,
        website: input.website,
        emergencyContact: input.emergencyContact,
        bestTimeToVisit: safeJson(input.bestTimeToVisit),
        bestTimeReason: input.bestTimeReason,
        submittedById: userId,
      },
    });

    eventBus.emit(AppEvents.PLACE_CREATED, {
      placeId: place.id,
      actorId: userId,
      data: { name: input.name, category: input.category, city: input.city },
    });

    return place;
  },

  async list(query: {
    page?: string;
    limit?: string;
    status?: string;
    category?: string;
    search?: string;
    city?: string;
    state?: string;
  }, viewer?: { isAdmin?: boolean; userId?: string }) {
    const pagination = getPaginationParams(query, 100);
    const where: Prisma.PlaceWhereInput = {};

    const requestedStatus = query.status ? String(query.status).toUpperCase() : undefined;
    if (viewer?.isAdmin) {
      if (requestedStatus) where.status = requestedStatus as any;
    } else if (requestedStatus && requestedStatus !== 'APPROVED' && viewer?.userId) {
      // Non-admins may only filter non-approved statuses for their own submissions
      where.status = requestedStatus as any;
      where.submittedById = viewer.userId;
    } else {
      where.status = 'APPROVED';
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.city) {
      where.city = { contains: query.city, mode: 'insensitive' };
    }
    if (query.state) {
      where.state = { contains: query.state, mode: 'insensitive' };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.place.findMany({
        select: placeListSelect,
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.place.count({ where }),
    ]);

    const deduped = dedupePlacesByLocation(data);

    return paginatedResponse(deduped, total, pagination);
  },

  async getById(idOrSlug: string, viewer?: { isAdmin?: boolean; userId?: string }) {
    const place = await prisma.place.findFirst({
      select: { ...placeDetailSelect, submittedById: true },
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
    });
    if (!place) {
      throw new ApiError(404, 'Place not found.');
    }
    if (place.status !== 'APPROVED') {
      const allowed =
        viewer?.isAdmin ||
        (!!viewer?.userId && place.submittedById === viewer.userId);
      if (!allowed) {
        throw new ApiError(404, 'Place not found.');
      }
    }
    const { submittedById: _omit, ...publicPlace } = place as typeof place & { submittedById?: string | null };
    return publicPlace;
  },

  async getBySlug(slug: string, viewer?: { isAdmin?: boolean; userId?: string }) {
    return this.getById(slug, viewer);
  },

  async update(idOrSlug: string, input: UpdatePlaceInput, userId: string) {
    const { id } = await resolvePlace(idOrSlug);
    const existing = await prisma.place.findUnique({ where: { id }, select: { submittedById: true, status: true } });
    if (!existing) throw new ApiError(404, 'Place not found.');
    if (existing.submittedById !== userId) {
      throw new ApiError(403, 'You can only update your own submissions.');
    }
    if (existing.status !== 'PENDING') {
      throw new ApiError(400, 'Only pending places can be edited by the submitter.');
    }

    const data: any = { ...input };
    if (input.name) {
      data.slug = await generateSlug(input.name, id);
    }
    if (input.openingHours) {
      data.openingHours = JSON.parse(JSON.stringify(input.openingHours));
    }
    if (input.ticketPrice) {
      data.ticketPrice = JSON.parse(JSON.stringify(input.ticketPrice));
    }
    if (input.bestTimeToVisit) {
      data.bestTimeToVisit = JSON.parse(JSON.stringify(input.bestTimeToVisit));
    }
    if (input.images) {
      data.images = dedupeImageUrls(input.images);
      if (!input.thumbnail) data.thumbnail = data.images[0] || null;
    }

    const updated = await prisma.place.update({
      select: placeListSelect,
      where: { id },
      data,
    });

    return updated;
  },

  async adminUpdate(idOrSlug: string, input: UpdatePlaceInput, actorId: string) {
    const { id } = await resolvePlace(idOrSlug);
    const existing = await prisma.place.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, images: true, thumbnail: true },
    });
    if (!existing) throw new ApiError(404, 'Place not found.');

    const data: any = { ...input };
    if (input.name) {
      data.slug = await generateSlug(input.name, id);
    }
    if (input.openingHours) {
      data.openingHours = JSON.parse(JSON.stringify(input.openingHours));
    }
    if (input.ticketPrice) {
      data.ticketPrice = JSON.parse(JSON.stringify(input.ticketPrice));
    }
    if (input.bestTimeToVisit) {
      data.bestTimeToVisit = JSON.parse(JSON.stringify(input.bestTimeToVisit));
    }
    if (input.images) {
      data.images = dedupeImageUrls(input.images);
      if (!input.thumbnail) {
        data.thumbnail = data.images[0] || null;
      }
    } else if (input.thumbnail === undefined && existing.images?.length) {
      // keep existing; no-op
    }

    const updated = await prisma.place.update({
      select: placeListSelect,
      where: { id },
      data,
    });

    // Drop duplicate PlaceImage rows for this place (keep oldest)
    if (input.images) {
      const rows = await prisma.placeImage.findMany({
        where: { placeId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, url: true },
      });
      const seen = new Set<string>();
      const dupIds: string[] = [];
      for (const row of rows) {
        if (seen.has(row.url)) dupIds.push(row.id);
        else seen.add(row.url);
      }
      if (dupIds.length) {
        await prisma.placeImage.deleteMany({ where: { id: { in: dupIds } } });
      }
    }

    eventBus.emit(AppEvents.PLACE_UPDATED, {
      placeId: id,
      actorId,
      data: { previous: { name: existing.name, status: existing.status }, newValues: input },
    });

    return updated;
  },

  async delete(idOrSlug: string, actorId: string) {
    const { id } = await resolvePlace(idOrSlug);
    const place = await prisma.place.findUnique({
      where: { id },
      select: {
        name: true,
        slug: true,
        status: true,
        latitude: true,
        longitude: true,
        submittedById: true,
        city: true,
        state: true,
        externalId: true,
      },
    });
    if (!place) throw new ApiError(404, 'Place not found.');

    const user = await prisma.user.findUnique({ where: { id: actorId } });
    if (user?.permission !== 'ADMIN' && place.submittedById !== actorId) {
      throw new ApiError(403, 'You do not have permission to delete this place.');
    }

    const previous = { name: place.name, status: place.status, latitude: place.latitude, longitude: place.longitude };

    // Tombstone so curated/OSM reseed cannot recreate this place
    await prisma.deletedPlaceRef.upsert({
      where: { slug: place.slug },
      create: {
        slug: place.slug,
        curatedId: place.externalId?.startsWith('curated:')
          ? place.externalId.replace(/^curated:/, '')
          : place.slug,
        name: place.name,
        city: place.city || '',
        state: place.state || '',
        externalId: place.externalId,
        deletedById: actorId,
      },
      update: {
        name: place.name,
        city: place.city || '',
        state: place.state || '',
        externalId: place.externalId,
        deletedById: actorId,
        deletedAt: new Date(),
      },
    });

    await prisma.tripPlanStop.deleteMany({ where: { placeId: id } });
    await prisma.collectionPlace.deleteMany({ where: { placeId: id } });
    await prisma.placeStat.deleteMany({ where: { placeId: id } });
    await prisma.checkIn.deleteMany({ where: { placeId: id } });
    await prisma.review.deleteMany({ where: { placeId: id } });
    await prisma.placeImage.deleteMany({ where: { placeId: id } });
    await prisma.placeVideo.deleteMany({ where: { placeId: id } });
    await prisma.placeOffer.deleteMany({ where: { placeId: id } });
    await prisma.placeEvent.deleteMany({ where: { placeId: id } });
    await prisma.reel.updateMany({ where: { placeId: id }, data: { placeId: null } });
    await prisma.auditLog.updateMany({ where: { placeId: id }, data: { placeId: null } });

    await prisma.place.delete({ where: { id } });

    eventBus.emit(AppEvents.PLACE_DELETED, { placeId: id, actorId, previous });
  },

  async adminDeleteAll(actorId: string) {
    const count = await prisma.place.count();

    await prisma.tripPlanStop.deleteMany({});
    await prisma.collectionPlace.deleteMany({});
    await prisma.placeStat.deleteMany({});
    await prisma.checkIn.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.placeImage.deleteMany({});
    await prisma.placeVideo.deleteMany({});
    await prisma.placeOffer.deleteMany({});
    await prisma.placeEvent.deleteMany({});
    await prisma.reel.updateMany({ data: { placeId: null } });
    await prisma.auditLog.updateMany({ data: { placeId: null } });
    await prisma.place.deleteMany();

    eventBus.emit(AppEvents.PLACE_DELETED, { placeId: 'ALL', actorId, previous: { count } as any });
    return { deletedCount: count };
  },

  async getPendingPlaces(query: { page?: string; limit?: string }) {
    const pagination = getPaginationParams(query);
    const where: Prisma.PlaceWhereInput = { status: 'PENDING' };

    const [data, total] = await Promise.all([
      prisma.place.findMany({
        select: {
          ...placeListSelect,
          description: true,
        },
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.place.count({ where }),
    ]);

    return paginatedResponse(data, total, pagination);
  },

  async getMySubmissions(userId: string, query: { page?: string; limit?: string; status?: string }) {
    const pagination = getPaginationParams(query);
    const where: Prisma.PlaceWhereInput = { submittedById: userId };
    if (query.status) {
      where.status = query.status as any;
    }

    const [data, total] = await Promise.all([
      prisma.place.findMany({
        select: placeListSelect,
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.place.count({ where }),
    ]);

    return paginatedResponse(data, total, pagination);
  },

  async vendorUpdate(idOrSlug: string, input: VendorUpdatePlaceInput, vendorId: string) {
    const { id } = await resolvePlace(idOrSlug);
    const place = await prisma.place.findUnique({ where: { id }, select: { status: true } });
    if (!place) throw new ApiError(404, 'Place not found.');
    if (place.status !== 'APPROVED') {
      throw new ApiError(400, 'Only approved places can be managed by vendors.');
    }
    const user = await prisma.user.findUnique({ where: { id: vendorId }, select: { permission: true } });
    if (!user || (user.permission !== 'VENDOR' && user.permission !== 'ADMIN')) {
      throw new ApiError(403, 'Vendor or admin access required.');
    }

    const data: any = { ...input };
    if (input.openingHours) {
      data.openingHours = JSON.parse(JSON.stringify(input.openingHours));
    }
    if (input.ticketPrice) {
      data.ticketPrice = JSON.parse(JSON.stringify(input.ticketPrice));
    }

    return prisma.place.update({
      select: placeListSelect,
      where: { id },
      data,
    });
  },

  // ── Media ──

  async addImage(placeIdOrSlug: string, input: AddImageInput, userId: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    await verifyAccess(placeId, userId);

    const url = String(input.url || '').trim();
    if (!url) throw new ApiError(400, 'Image URL is required.');

    // Skip duplicate URL for this place
    const existingImg = await prisma.placeImage.findFirst({
      where: { placeId, url },
    });
    if (existingImg) {
      if (input.isPrimary && !existingImg.isPrimary) {
        await prisma.placeImage.updateMany({
          where: { placeId, isPrimary: true },
          data: { isPrimary: false },
        });
        await prisma.placeImage.update({
          where: { id: existingImg.id },
          data: { isPrimary: true },
        });
        await prisma.place.update({
          where: { id: placeId },
          data: { thumbnail: url },
        });
      }
      return existingImg;
    }

    if (input.isPrimary) {
      await prisma.placeImage.updateMany({
        where: { placeId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const created = await prisma.placeImage.create({
      data: {
        placeId,
        url,
        caption: input.caption,
        isPrimary: input.isPrimary || false,
      },
    });

    // Keep Place.images + thumbnail in sync (admin list/map use these)
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { images: true, thumbnail: true },
    });
    const images = dedupeImageUrls([...(place?.images || []), url]);
    await prisma.place.update({
      where: { id: placeId },
      data: {
        images,
        thumbnail: input.isPrimary || !place?.thumbnail ? url : place.thumbnail,
      },
    });

    return created;
  },

  async deleteImage(imageId: string, userId: string) {
    const image = await prisma.placeImage.findUnique({
      where: { id: imageId },
      include: { place: { select: { id: true, submittedById: true, images: true, thumbnail: true } } },
    });
    if (!image) throw new ApiError(404, 'Image not found.');
    await verifyAccess(image.place.id, userId);

    await prisma.placeImage.delete({ where: { id: imageId } });

    const remaining = dedupeImageUrls(
      (image.place.images || []).filter((u) => u !== image.url),
    );
    await prisma.place.update({
      where: { id: image.place.id },
      data: {
        images: remaining,
        thumbnail:
          image.place.thumbnail === image.url
            ? remaining[0] || null
            : image.place.thumbnail,
      },
    });
  },

  async setPrimaryImage(imageId: string, userId: string) {
    const image = await prisma.placeImage.findUnique({
      where: { id: imageId },
      include: { place: { select: { id: true, submittedById: true } } },
    });
    if (!image) throw new ApiError(404, 'Image not found.');
    await verifyAccess(image.place.id, userId);

    await prisma.placeImage.updateMany({
      where: { placeId: image.place.id, isPrimary: true },
      data: { isPrimary: false },
    });

    const updated = await prisma.placeImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });

    await prisma.place.update({
      where: { id: image.place.id },
      data: { thumbnail: image.url },
    });

    return updated;
  },

  async getImages(placeIdOrSlug: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    return prisma.placeImage.findMany({
      where: { placeId },
      orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }],
    });
  },

  async addVideo(placeIdOrSlug: string, input: AddVideoInput, userId: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    await verifyAccess(placeId, userId);

    return prisma.placeVideo.create({
      data: {
        placeId,
        url: input.url,
        thumbnail: input.thumbnail,
        title: input.title,
        duration: input.duration,
      },
    });
  },

  async deleteVideo(videoId: string, userId: string) {
    const video = await prisma.placeVideo.findUnique({
      where: { id: videoId },
      include: { place: { select: { id: true, submittedById: true } } },
    });
    if (!video) throw new ApiError(404, 'Video not found.');
    await verifyAccess(video.place.id, userId);

    await prisma.placeVideo.delete({ where: { id: videoId } });
  },

  async getVideos(placeIdOrSlug: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    return prisma.placeVideo.findMany({
      where: { placeId },
      orderBy: { order: 'asc' },
    });
  },

  async getReels(placeIdOrSlug: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    return prisma.placeVideo.findMany({
      where: { placeId, duration: { lte: 60 } },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ── Offers & Events ──

  async addOffer(placeIdOrSlug: string, input: CreateOfferInput, vendorId: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    await verifyVendorAccess(placeId, vendorId);

    return prisma.placeOffer.create({
      data: {
        placeId,
        title: input.title,
        description: input.description,
        discount: input.discount,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
      },
    });
  },

  async updateOffer(offerId: string, input: UpdateOfferInput, vendorId: string) {
    const offer = await prisma.placeOffer.findUnique({ where: { id: offerId }, include: { place: { select: { id: true } } } });
    if (!offer) throw new ApiError(404, 'Offer not found.');
    await verifyVendorAccess(offer.place.id, vendorId);

    const data: any = { ...input };
    if (input.validFrom) data.validFrom = new Date(input.validFrom);
    if (input.validUntil) data.validUntil = new Date(input.validUntil);

    return prisma.placeOffer.update({ where: { id: offerId }, data });
  },

  async deleteOffer(offerId: string, vendorId: string) {
    const offer = await prisma.placeOffer.findUnique({ where: { id: offerId }, include: { place: { select: { id: true } } } });
    if (!offer) throw new ApiError(404, 'Offer not found.');
    await verifyVendorAccess(offer.place.id, vendorId);

    await prisma.placeOffer.delete({ where: { id: offerId } });
  },

  async getOffers(placeIdOrSlug: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    return prisma.placeOffer.findMany({
      where: { placeId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async addEvent(placeIdOrSlug: string, input: CreateEventInput, vendorId: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    await verifyVendorAccess(placeId, vendorId);

    return prisma.placeEvent.create({
      data: {
        placeId,
        title: input.title,
        description: input.description,
        imageUrl: input.imageUrl,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
    });
  },

  async updateEvent(eventId: string, input: UpdateEventInput, vendorId: string) {
    const event = await prisma.placeEvent.findUnique({ where: { id: eventId }, include: { place: { select: { id: true } } } });
    if (!event) throw new ApiError(404, 'Event not found.');
    await verifyVendorAccess(event.place.id, vendorId);

    const data: any = { ...input };
    if (input.startDate) data.startDate = new Date(input.startDate);
    if (input.endDate) data.endDate = new Date(input.endDate);

    return prisma.placeEvent.update({ where: { id: eventId }, data });
  },

  async deleteEvent(eventId: string, vendorId: string) {
    const event = await prisma.placeEvent.findUnique({ where: { id: eventId }, include: { place: { select: { id: true } } } });
    if (!event) throw new ApiError(404, 'Event not found.');
    await verifyVendorAccess(event.place.id, vendorId);

    await prisma.placeEvent.delete({ where: { id: eventId } });
  },

  async getEvents(placeIdOrSlug: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    return prisma.placeEvent.findMany({
      where: { placeId },
      orderBy: { startDate: 'asc' },
    });
  },

  async getUpcomingEvents(placeIdOrSlug: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    return prisma.placeEvent.findMany({
      where: { placeId, startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
    });
  },

  // ── Social ──

  async savePlace(placeIdOrSlug: string, userId: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);

    await prisma.placeStat.create({
      data: { placeId, userId, action: 'save' },
    });

    eventBus.emit(AppEvents.STAT_RECORDED, { placeId, userId, action: 'save' });
  },

  async unsavePlace(placeIdOrSlug: string, userId: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    await prisma.placeStat.deleteMany({
      where: { placeId, userId, action: 'save' },
    });
  },

  async getSavedPlaces(userId: string, query: { page?: string; limit?: string }) {
    const pagination = getPaginationParams(query);

    // Find all placeIds the user has 'save' stats for (deduplicated)
    const savedStats = await prisma.placeStat.findMany({
      where: { userId, action: 'save' },
      select: { placeId: true, createdAt: true },
      distinct: ['placeId'],
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    });

    const total = await prisma.placeStat.count({
      where: { userId, action: 'save' },
    });

    const placeIds = savedStats.map(s => s.placeId);
    const places = await prisma.place.findMany({
      where: { id: { in: placeIds }, status: 'APPROVED' },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Preserve saved order
    const placeMap = new Map(places.map(p => [p.id, p]));
    const orderedPlaces = placeIds
      .map(id => placeMap.get(id))
      .filter(Boolean)
      .map(p => ({ ...(p as any), savedAt: savedStats.find(s => s.placeId === (p as any).id)?.createdAt }));

    return paginatedResponse(orderedPlaces, total, pagination);
  },

  async checkIn(placeIdOrSlug: string, userId: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);

    const existing = await prisma.checkIn.findUnique({
      where: { placeId_userId: { placeId, userId } },
    });
    if (existing) {
      return existing;
    }

    const checkin = await prisma.checkIn.create({
      data: { placeId, userId },
    });

    await prisma.placeStat.create({
      data: { placeId, userId, action: 'checkin' },
    });

    try {
      const RULE_KEY = 'place_visit';
      const isLimitReached = await pointRulesService.checkDailyLimit(userId, RULE_KEY);
      const onCooldown = await pointRulesService.checkCooldown(userId, RULE_KEY);
      const rule = await pointRulesService.getPointsForAction(RULE_KEY);
      if (!isLimitReached && !onCooldown && rule) {
        await walletService.earn(userId, rule.points, 'place_visit', checkin.id, 'CHECKIN');
      }
    } catch (error) {
      logger.error({ error, userId, placeId }, 'Failed to award place_visit points');
    }

    return checkin;
  },

  async addReview(placeIdOrSlug: string, userId: string, input: ReviewInput) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    const reviewUserSelect = { id: true, name: true, avatarStyle: true, avatar: true } as const;

    const existing = await prisma.review.findUnique({
      where: { placeId_userId: { placeId, userId } },
    });
    if (existing) {
      const review = await prisma.review.update({
        where: { id: existing.id },
        data: { rating: input.rating, content: input.content, photos: input.photos },
        include: { user: { select: reviewUserSelect } },
      });
      await recalculatePlaceRating(placeId);
      return review;
    }

    const review = await prisma.review.create({
      data: {
        placeId,
        userId,
        rating: input.rating,
        content: input.content,
        photos: input.photos,
      },
      include: { user: { select: reviewUserSelect } },
    });

    await recalculatePlaceRating(placeId);

    try {
      const RULE_KEY = 'review_write';
      const isLimitReached = await pointRulesService.checkDailyLimit(userId, RULE_KEY);
      const onCooldown = await pointRulesService.checkCooldown(userId, RULE_KEY);
      const rule = await pointRulesService.getPointsForAction(RULE_KEY);
      if (!isLimitReached && !onCooldown && rule) {
        await walletService.earn(userId, rule.points, 'review_write', review.id, 'REVIEW');
      }

      if (input.photos && input.photos.length > 0) {
        const PHOTO_RULE = 'photo_upload';
        const pIsLimitReached = await pointRulesService.checkDailyLimit(userId, PHOTO_RULE);
        const pOnCooldown = await pointRulesService.checkCooldown(userId, PHOTO_RULE);
        const pRule = await pointRulesService.getPointsForAction(PHOTO_RULE);
        if (!pIsLimitReached && !pOnCooldown && pRule) {
          const totalPhotoPoints = Math.min(pRule.points * input.photos.length, pRule.points * 5); // Max 5 photos points per review
          await walletService.earn(userId, totalPhotoPoints, 'photo_upload', review.id, 'REVIEW_PHOTO');
        }
      }
    } catch (error) {
      logger.error({ error, userId, placeId }, 'Failed to award review/photo points');
    }

    return review;
  },

  async getReviews(placeIdOrSlug: string, query: { page?: string; limit?: string }) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    const pagination = getPaginationParams(query);

    const [data, total] = await Promise.all([
      prisma.review.findMany({
        where: { placeId },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ helpfulVotes: 'desc' }, { createdAt: 'desc' }],
        include: {
          user: { select: { id: true, name: true, avatarStyle: true, avatar: true } },
        },
      }),
      prisma.review.count({ where: { placeId } }),
    ]);

    return paginatedResponse(data, total, pagination);
  },

  async markReviewHelpful(placeIdOrSlug: string, reviewId: string) {
    const { id: placeId } = await resolvePlace(placeIdOrSlug);
    const review = await prisma.review.findUnique({ where: { id: reviewId, placeId } });
    if (!review) throw new ApiError(404, 'Review not found.');
    return prisma.review.update({
      where: { id: reviewId },
      data: { helpfulVotes: { increment: 1 } },
    });
  },
};
