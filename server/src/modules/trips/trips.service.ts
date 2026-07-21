import { Prisma, TravelPace, TimePreference, AvoidOption } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { paginatedResponse, getPaginationParams } from '../../shared/utils/pagination';
import { resolvePlace } from '../places/services/places.helpers';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  generateItineraryPlan, estimateDurationMinutes, parseEntryFee, isPlaceOpenAt,
  nearestNeighborOrder, twoOptImprove, TimeSlotKey,
} from './itineraryEngine';
import { canonicalizeDestination, formatDestinationLabel } from '../../shared/utils/destination';

const prismaTrip = prisma.tripPlan;
const prismaDay = prisma.tripPlanDay;
const prismaStop = prisma.tripPlanStop;
const prismaCollab = prisma.tripCollaborator;

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function minutesToTimeStr(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
}

function minutesToTimeSlot(minutes: number): TimeSlotKey {
  const m = minutes % 1440;
  if (m < 720) return 'MORNING';
  if (m < 1020) return 'AFTERNOON';
  return 'EVENING';
}

/** Assign start/end times for every stop in the given order. Never drops stops. */
function scheduleOrderedStopsForDay(
  day: { stops: Array<{ id: string; place: { latitude: number | null; longitude: number | null; ticketPrice: unknown } & Record<string, unknown> }> },
  orderedStopIds: string[],
  _pace: string,
  startLocation?: { latitude: number; longitude: number },
): { id: string; data: Record<string, unknown> }[] {
  let currentMinutes = 480; // 08:00
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  let prevLat: number | null = null;
  let prevLng: number | null = null;

  orderedStopIds.forEach((stopId, idx) => {
    const stop = day.stops.find((s) => s.id === stopId);
    if (!stop?.place) return;

    const place = stop.place;
    const duration = Math.max(30, estimateDurationMinutes(place as any));

    let distFromPrev: number | undefined;
    if (prevLat != null && prevLng != null && place.latitude != null && place.longitude != null) {
      distFromPrev = calcDistance(prevLat, prevLng, place.latitude, place.longitude);
    } else if (idx === 0 && startLocation && place.latitude != null && place.longitude != null) {
      distFromPrev = calcDistance(startLocation.latitude, startLocation.longitude, place.latitude, place.longitude);
    }

    const endMinutes = currentMinutes + duration;
    updates.push({
      id: stop.id,
      data: {
        order: idx,
        startTime: minutesToTimeStr(currentMinutes),
        endTime: minutesToTimeStr(endMinutes),
        duration,
        distanceFromPrev: distFromPrev,
        timeSlot: minutesToTimeSlot(currentMinutes),
        entryFee: parseEntryFee(place.ticketPrice) ?? undefined,
      },
    });

    currentMinutes = endMinutes + 10;
    if (place.latitude != null && place.longitude != null) {
      prevLat = place.latitude;
      prevLng = place.longitude;
    }
  });

  return updates;
}

/** Pack an ordered route into day buckets by daily time budget — never drops a stop. */
function packStopsIntoDayBuckets(
  orderedStopIds: string[],
  durationByStopId: Map<string, number>,
  pace: string,
): string[][] {
  const maxMinPerDay = pace === 'relaxed' ? 480 : pace === 'fast' ? 360 : 420;
  const buckets: string[][] = [];
  let current: string[] = [];
  let dayMinutes = 0;

  for (const stopId of orderedStopIds) {
    const duration = durationByStopId.get(stopId) ?? 60;
    if (current.length > 0 && dayMinutes + duration > maxMinPerDay) {
      buckets.push(current);
      current = [];
      dayMinutes = 0;
    }
    current.push(stopId);
    dayMinutes += duration + 10;
  }
  if (current.length > 0) buckets.push(current);
  return buckets.length > 0 ? buckets : [[]];
}

/** Manual quick-add targets Day 1, or the earliest day that already has stops. */
async function resolveQuickAddDay(
  tx: Prisma.TransactionClient,
  tripPlanId: string,
): Promise<{ id: string }> {
  const withStops = await tx.tripPlanDay.findFirst({
    where: { tripPlanId, stops: { some: {} } },
    orderBy: { dayNumber: 'asc' },
    select: { id: true },
  });
  if (withStops) return withStops;

  const firstDay = await tx.tripPlanDay.findFirst({
    where: { tripPlanId },
    orderBy: { dayNumber: 'asc' },
    select: { id: true },
  });
  if (firstDay) return firstDay;

  return tx.tripPlanDay.create({
    data: { tripPlanId, dayNumber: 1 },
    select: { id: true },
  });
}

async function maybeConsolidateManualDraftStops(tripId: string): Promise<boolean> {
  const trip = await prismaTrip.findUnique({
    where: { id: tripId },
    include: {
      tripDays: {
        orderBy: { dayNumber: 'asc' },
        include: { stops: { orderBy: { order: 'asc' } } },
      },
    },
  });
  if (!trip || trip.status !== 'DRAFT' || !trip.tripDays.length) return false;

  const day1 = trip.tripDays[0];
  if (day1.stops.length > 0) return false;

  const misplaced = trip.tripDays.slice(1).flatMap((d) => d.stops);
  if (misplaced.length === 0) return false;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < misplaced.length; i++) {
      await tx.tripPlanStop.update({
        where: { id: misplaced[i].id },
        data: { tripPlanDayId: day1.id, order: i },
      });
    }
    for (const d of trip.tripDays.slice(1)) {
      const count = await tx.tripPlanStop.count({ where: { tripPlanDayId: d.id } });
      if (count === 0) await tx.tripPlanDay.delete({ where: { id: d.id } });
    }
    const remainingDays = await tx.tripPlanDay.count({ where: { tripPlanId: tripId } });
    await tx.tripPlan.update({ where: { id: tripId }, data: { days: remainingDays } });
  });
  return true;
}

const NON_FAMILY_FRIENDLY_KEYWORDS = ['bar', 'pub', 'nightclub', 'nightlife', 'casino'];
const FOOD_KEYWORDS = ['restaurant', 'market', 'street food', 'cafe', 'food'];
const NATURE_KEYWORDS = ['waterfall', 'lake', 'park', 'wildlife', 'beach', 'garden'];
const HERITAGE_KEYWORDS = ['fort', 'palace', 'monument', 'museum', 'temple'];

function strategyMultiplier(strategy: string, place: { category: string; tags: string[]; rating: number | null; popularityScore: number | null; ticketPrice: unknown }): number {
  const cat = (place.category || '').toLowerCase();
  const tags = (place.tags || []).map((t) => t.toLowerCase());
  const hasAny = (keywords: string[]) => keywords.some((k) => cat.includes(k) || tags.some((t) => t.includes(k)));

  switch (strategy) {
    case 'budget': {
      const fee = parseEntryFee(place.ticketPrice);
      return fee && fee > 200 ? 1.5 : 0.85;
    }
    case 'family':
      return hasAny(NON_FAMILY_FRIENDLY_KEYWORDS) ? 1.6 : 0.9;
    case 'food':
      return hasAny(FOOD_KEYWORDS) ? 0.7 : 1.1;
    case 'heritage':
      return hasAny(HERITAGE_KEYWORDS) ? 0.7 : 1.15;
    case 'nature':
      return hasAny(NATURE_KEYWORDS) ? 0.7 : 1.15;
    case 'instagram':
      return (place.popularityScore ?? 0) > 60 ? 0.7 : 1.1;
    case 'scenic':
      return hasAny(NATURE_KEYWORDS) ? 0.8 : 1.15;
    case 'fastest':
      return 0.8;
    case 'shortest':
    default:
      return 1;
  }
}

type AccessLevel = 'view' | 'edit' | 'owner';

async function assertTripAccess(tripId: string, userId: string, level: AccessLevel = 'edit') {
  const trip = await prismaTrip.findUnique({
    where: { id: tripId },
    include: { collaborators: { where: { userId } } },
  });
  if (!trip) throw new ApiError(404, 'Trip not found');

  const isOwner = trip.userId === userId;
  const collab = trip.collaborators[0];

  if (!isOwner && !collab) throw new ApiError(403, 'You do not have access to this trip');
  if (level === 'owner' && !isOwner) throw new ApiError(403, 'Only the trip owner can perform this action');
  if (level === 'edit' && !isOwner && collab?.role === 'VIEWER') throw new ApiError(403, 'Viewers cannot modify this trip');

  return trip;
}

async function getTripIdForDay(dayId: string): Promise<string> {
  const day = await prismaDay.findUnique({ where: { id: dayId }, select: { tripPlanId: true } });
  if (!day) throw new ApiError(404, 'Trip day not found');
  return day.tripPlanId;
}

async function getTripIdForStop(stopId: string): Promise<{ tripId: string; dayId: string; order: number }> {
  const stop = await prismaStop.findUnique({ where: { id: stopId }, select: { tripPlanDayId: true, order: true, tripPlanDay: { select: { tripPlanId: true } } } });
  if (!stop) throw new ApiError(404, 'Stop not found');
  return { tripId: stop.tripPlanDay.tripPlanId, dayId: stop.tripPlanDayId, order: stop.order };
}

const TRIP_INCLUDE = {
  tripDays: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      stops: {
        orderBy: { order: 'asc' as const },
        include: {
          place: {
            select: {
              id: true, name: true, slug: true, description: true,
              latitude: true, longitude: true, category: true, tags: true,
              images: true, thumbnail: true, city: true, state: true,
              rating: true, reviewCount: true, openingHours: true,
              ticketPrice: true, bestTimeToVisit: true, estimatedDurationMinutes: true,
              recommendedDuration: true,
            },
          },
        },
      },
    },
  },
  collaborators: {
    include: {
      user: { select: { id: true, name: true, avatar: true, avatarStyle: true } },
    },
  },
  user: { select: { id: true, name: true, avatar: true, avatarStyle: true } },
};

export interface AiGenerateInput {
  tripId?: string;
  destination: string;
  days: number;
  pace: TravelPace;
  travelers: string;
  budget: 'LOW' | 'MEDIUM' | 'HIGH' | 'CUSTOM';
  customBudgetAmount?: number;
  interests: string[];
  timePreference?: TimePreference;
  avoid: AvoidOption[];
  prompt?: string;
  manualPlaceIds: string[];
  fillWithAi?: boolean;
  startDate?: string;
}

export const tripsService = {
  async create(data: any, userId: string) {
    const days = data.startDate && data.endDate
      ? Math.max(1, Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 1;

    const trip = await prismaTrip.create({
      data: {
        title: data.title,
        description: data.description,
        destination: data.destination,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        userId,
        days,
        travelers: data.travelers || 'SOLO',
        transportation: data.transportation || [],
        budget: data.budget || 'MEDIUM',
        accommodation: data.accommodation,
        interests: data.interests || [],
        coverImage: data.coverImage,
        status: 'DRAFT',
        pace: data.pace || 'BALANCED',
        timePreference: data.timePreference,
        avoid: data.avoid || [],
        tripDays: {
          create: Array.from({ length: days }, (_, i) => ({
            dayNumber: i + 1,
            date: data.startDate ? new Date(new Date(data.startDate).getTime() + i * 86400000) : undefined,
          })),
        },
      },
      include: TRIP_INCLUDE,
    });

    return trip;
  },

  async list(userId: string, query: any) {
    const { status } = query;
    const params = getPaginationParams(query);

    const where: any = {
      userId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      prismaTrip.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: params.skip,
        take: params.limit,
        include: {
          tripDays: {
            take: 1,
            include: { stops: { take: 1, include: { place: { select: { images: true, thumbnail: true } } } } },
          },
          _count: { select: { tripDays: true, collaborators: true } },
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prismaTrip.count({ where }),
    ]);

    return paginatedResponse(data, total, params);
  },

  async getById(id: string, userId: string): Promise<any> {
    const trip = await prismaTrip.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
        ],
      },
      include: TRIP_INCLUDE,
    });

    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }

    if (trip.status === 'DRAFT') {
      const consolidated = await maybeConsolidateManualDraftStops(trip.id);
      if (consolidated) {
        return this.getById(id, userId);
      }
    }

    return trip;
  },

  async update(id: string, data: any, userId: string) {
    const trip = await assertTripAccess(id, userId, 'edit');

    const updateData: any = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    let newDays: number | undefined = data.days;
    if (data.startDate || data.endDate) {
      const start = data.startDate ? new Date(data.startDate) : trip.startDate;
      const end = data.endDate ? new Date(data.endDate) : trip.endDate;
      if (start && end) {
        newDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      }
    }

    return prisma.$transaction(async (tx) => {
      if (typeof newDays === 'number') {
        const existingDays = await tx.tripPlanDay.findMany({
          where: { tripPlanId: id },
          include: { _count: { select: { stops: true } } },
          orderBy: { dayNumber: 'asc' },
        });

        if (newDays > existingDays.length) {
          const startBase = updateData.startDate ?? trip.startDate;
          await tx.tripPlanDay.createMany({
            data: Array.from({ length: newDays - existingDays.length }, (_, i) => ({
              tripPlanId: id,
              dayNumber: existingDays.length + i + 1,
              date: startBase ? new Date(new Date(startBase).getTime() + (existingDays.length + i) * 86400000) : undefined,
            })),
          });
          updateData.days = newDays;
        } else if (newDays < existingDays.length) {
          const trailing = existingDays.filter((d) => d.dayNumber > newDays!);
          const deletable = trailing.filter((d) => d._count.stops === 0);
          if (deletable.length > 0) {
            await tx.tripPlanDay.deleteMany({ where: { id: { in: deletable.map((d) => d.id) } } });
          }
          // Days with stops are never silently dropped — final count reflects what actually remains.
          updateData.days = Math.max(newDays, existingDays.length - deletable.length);
        } else {
          updateData.days = newDays;
        }
      }

      return tx.tripPlan.update({
        where: { id },
        data: updateData,
        include: TRIP_INCLUDE,
      });
    });
  },

  async delete(id: string, userId: string) {
    const trip = await prismaTrip.findFirst({ where: { id, userId } });
    if (!trip) throw new ApiError(404, 'Trip not found or unauthorized');

    await prismaTrip.delete({ where: { id } });
  },

  async duplicate(id: string, userId: string) {
    const trip = await prismaTrip.findFirst({
      where: { id, userId },
      include: { tripDays: { include: { stops: true } } },
    });
    if (!trip) throw new ApiError(404, 'Trip not found or unauthorized');

    const { id: _id, createdAt: _c, updatedAt: _u, aiPreferences, ...tripData } = trip || {};

    const newTrip = await prismaTrip.create({
      data: {
        ...tripData,
        aiPreferences: aiPreferences ?? undefined,
        title: `${trip.title} (Copy)`,
        status: 'DRAFT',
        tripDays: {
          create: trip.tripDays.map(day => ({
            dayNumber: day.dayNumber,
            date: day.date,
            theme: day.theme,
            stops: {
              create: day.stops.map(stop => ({
                placeId: stop.placeId,
                order: stop.order,
                startTime: stop.startTime,
                endTime: stop.endTime,
                duration: stop.duration,
                cost: stop.cost,
                entryFee: stop.entryFee,
                distanceFromPrev: stop.distanceFromPrev,
                transportMode: stop.transportMode,
                timeSlot: stop.timeSlot,
                notes: stop.notes,
                reason: stop.reason,
                isPinned: stop.isPinned,
              })),
            },
          })),
        },
      },
      include: TRIP_INCLUDE,
    });

    return newTrip;
  },

  async addStop(dayId: string, data: any, userId: string) {
    const tripId = await getTripIdForDay(dayId);
    await assertTripAccess(tripId, userId, 'edit');

    const resolved = await resolvePlace(data.placeId);

    const existing = await prismaStop.findFirst({ where: { tripPlanDayId: dayId, placeId: resolved.id } });
    if (existing) throw new ApiError(409, 'This place is already added to that day');

    const maxOrder = await prismaStop.findFirst({
      where: { tripPlanDayId: dayId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const stop = await prismaStop.create({
      data: {
        tripPlanDayId: dayId,
        placeId: resolved.id,
        order: data.order ?? (maxOrder ? maxOrder.order + 1 : 0),
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        cost: data.cost,
        entryFee: data.entryFee,
        distanceFromPrev: data.distanceFromPrev,
        transportMode: data.transportMode,
        timeSlot: data.timeSlot,
        notes: data.notes,
        reason: data.reason,
        isPinned: data.isPinned ?? true,
      },
      include: {
        place: {
          select: {
            id: true, name: true, slug: true, latitude: true, longitude: true,
            category: true, images: true, thumbnail: true, city: true, state: true,
            rating: true, reviewCount: true, openingHours: true, ticketPrice: true,
          },
        },
      },
    });

    return stop;
  },

  async updateStop(id: string, data: any, userId: string) {
    const { tripId } = await getTripIdForStop(id);
    await assertTripAccess(tripId, userId, 'edit');

    return prismaStop.update({
      where: { id },
      data,
      include: {
        place: {
          select: {
            id: true, name: true, slug: true, latitude: true, longitude: true,
            category: true, images: true, thumbnail: true, city: true, state: true,
            rating: true, reviewCount: true,
          },
        },
      },
    });
  },

  async deleteStop(id: string, userId: string) {
    const { tripId, dayId, order } = await getTripIdForStop(id);
    await assertTripAccess(tripId, userId, 'edit');

    await prisma.$transaction([
      prismaStop.delete({ where: { id } }),
      prismaStop.updateMany({
        where: { tripPlanDayId: dayId, order: { gt: order } },
        data: { order: { decrement: 1 } },
      }),
    ]);
  },

  async reorderStops(dayId: string, stopIds: string[], userId: string) {
    const tripId = await getTripIdForDay(dayId);
    await assertTripAccess(tripId, userId, 'edit');

    return prisma.$transaction(
      stopIds.map((id, index) => prismaStop.update({ where: { id }, data: { order: index } }))
    );
  },

  async generateItinerary(tripId: string, pace: string, userId: string, startLocation?: { latitude: number; longitude: number }) {
    await assertTripAccess(tripId, userId, 'edit');

    const trip = await prismaTrip.findUnique({
      where: { id: tripId },
      include: {
        tripDays: {
          orderBy: { dayNumber: 'asc' },
          include: { stops: { orderBy: { order: 'asc' }, include: { place: true } } },
        },
      },
    });
    if (!trip) throw new ApiError(404, 'Trip not found');

    const maxMinPerDay = pace === 'relaxed' ? 480 : pace === 'fast' ? 360 : 420;
    const baseTimes: Record<string, number> = {
      sunrise: 330, morning: 480, afternoon: 780, evening: 1020, sunset: 1050, night: 1140,
    };
    const timeSlotOrder = ['sunrise', 'morning', 'afternoon', 'evening', 'sunset', 'night'];

    const updates: { id: string; data: any }[] = [];

    for (const day of trip.tripDays) {
      const places = day.stops.map(s => s.place).filter(p => p.latitude && p.longitude);
      if (places.length === 0) continue;

      const timeSlots: Record<string, typeof places> = {};
      places.forEach(p => {
        const slot = (p.bestTimeToVisit as any)?.timeOfDay || 'morning';
        if (!timeSlots[slot]) timeSlots[slot] = [];
        timeSlots[slot].push(p);
      });

      let currentOrder = 0;
      let dayMinutes = 0;

      for (const slot of timeSlotOrder) {
        const slotPlaces = timeSlots[slot];
        if (!slotPlaces?.length) continue;

        let currentMinutes = baseTimes[slot] || 480;

        for (const place of slotPlaces) {
          const duration = estimateDurationMinutes(place);
          if (dayMinutes + duration > maxMinPerDay) break;

          const stop = day.stops.find(s => s.placeId === place.id);
          if (!stop) continue;

          const prevPlace = currentOrder > 0
            ? day.stops.find(s => s.order === currentOrder - 1)?.place
            : null;

          let distFromPrev: number | null = null;
          if (prevPlace && prevPlace.latitude && prevPlace.longitude && place.latitude && place.longitude) {
            distFromPrev = calcDistance(prevPlace.latitude, prevPlace.longitude, place.latitude, place.longitude);
          } else if (currentOrder === 0 && startLocation && place.latitude && place.longitude) {
            distFromPrev = calcDistance(startLocation.latitude, startLocation.longitude, place.latitude, place.longitude);
          }

          const openState = isPlaceOpenAt(place.openingHours, day.date, currentMinutes % 1440);
          const effectiveSlot = openState === false ? slot : slot; // unknown/open -> keep; closed -> flagged below but never dropped

          const endMinutes = currentMinutes + duration;
          const startTimeStr = `${Math.floor(currentMinutes / 60).toString().padStart(2, '0')}:${(currentMinutes % 60).toString().padStart(2, '0')}`;
          const endTimeStr = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

          updates.push({
            id: stop.id,
            data: {
              order: currentOrder,
              startTime: startTimeStr,
              endTime: endTimeStr,
              duration,
              distanceFromPrev: distFromPrev ?? undefined,
              timeSlot: effectiveSlot.toUpperCase(),
              entryFee: parseEntryFee(place.ticketPrice) ?? undefined,
            },
          });

          currentMinutes = endMinutes + 10;
          currentOrder++;
          dayMinutes += duration + 10;
        }
      }
    }

    await prisma.$transaction([
      ...updates.map((u) => prismaStop.update({ where: { id: u.id }, data: u.data })),
      prismaTrip.update({ where: { id: tripId }, data: { status: 'UPCOMING' } }),
    ]);

    const totalDistance = await this.calculateTotalDistance(tripId);
    const totalTime = await this.calculateTotalTime(tripId);
    await prismaTrip.update({ where: { id: tripId }, data: { totalDistance, totalTravelTime: totalTime } });

    return this.getById(tripId, trip.userId);
  },

  async optimizeRoute(tripId: string, strategy: string, userId: string, startLocation?: { latitude: number; longitude: number }) {
    await assertTripAccess(tripId, userId, 'edit');

    const trip = await prismaTrip.findUnique({
      where: { id: tripId },
      include: {
        tripDays: {
          orderBy: { dayNumber: 'asc' },
          include: { stops: { orderBy: { order: 'asc' }, include: { place: true } } },
        },
      },
    });
    if (!trip) throw new ApiError(404, 'Trip not found');

    // Flatten every stop the user saved from the map — self-build and AI both need a full timed plan.
    const allStops = trip.tripDays.flatMap((d) => d.stops);
    if (allStops.length === 0) {
      throw new ApiError(422, 'Add at least one place from the map before optimizing.');
    }

    const stopsWithCoords = allStops.filter((s) => s.place?.latitude && s.place?.longitude);
    const withoutCoords = allStops.filter((s) => !s.place?.latitude || !s.place?.longitude);

    let orderedStopIds: string[];
    if (stopsWithCoords.length >= 2) {
      const start = startLocation
        ? { latitude: startLocation.latitude, longitude: startLocation.longitude }
        : { latitude: stopsWithCoords[0].place.latitude!, longitude: stopsWithCoords[0].place.longitude! };

      const remaining = stopsWithCoords.map((s) => ({
        id: s.id,
        latitude: s.place.latitude!,
        longitude: s.place.longitude!,
        weight: strategyMultiplier(strategy, s.place),
      }));
      const ordered: typeof remaining = [];
      let curLat = start.latitude;
      let curLng = start.longitude;
      while (remaining.length > 0) {
        let bestIdx = 0;
        let bestScore = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const dist = calcDistance(curLat, curLng, remaining[i].latitude, remaining[i].longitude);
          const score = dist * remaining[i].weight;
          if (score < bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        const [chosen] = remaining.splice(bestIdx, 1);
        ordered.push(chosen);
        curLat = chosen.latitude;
        curLng = chosen.longitude;
      }

      const improved = twoOptImprove(nearestNeighborOrder(ordered, start), start);
      orderedStopIds = [...improved.map((s) => s.id), ...withoutCoords.map((s) => s.id)];
    } else {
      orderedStopIds = allStops.map((s) => s.id);
    }

    const durationByStopId = new Map(
      allStops.map((s) => [s.id, Math.max(30, estimateDurationMinutes(s.place as any))]),
    );
    const dayBuckets = packStopsIntoDayBuckets(orderedStopIds, durationByStopId, 'moderate');
    const stopById = new Map(allStops.map((s) => [s.id, s]));

    await prisma.$transaction(async (tx) => {
      // Ensure we have one day row per packed bucket.
      const existingDays = [...trip.tripDays].sort((a, b) => a.dayNumber - b.dayNumber);
      const dayRows: { id: string; dayNumber: number }[] = [];

      for (let i = 0; i < dayBuckets.length; i++) {
        const dayNumber = i + 1;
        if (existingDays[i]) {
          dayRows.push({ id: existingDays[i].id, dayNumber });
          if (existingDays[i].dayNumber !== dayNumber) {
            await tx.tripPlanDay.update({ where: { id: existingDays[i].id }, data: { dayNumber } });
          }
        } else {
          const created = await tx.tripPlanDay.create({
            data: { tripPlanId: tripId, dayNumber },
          });
          dayRows.push({ id: created.id, dayNumber });
        }
      }

      const stopUpdates: { id: string; data: Record<string, unknown> }[] = [];

      for (let dayIdx = 0; dayIdx < dayBuckets.length; dayIdx++) {
        const bucketIds = dayBuckets[dayIdx];
        const dayRow = dayRows[dayIdx];
        const syntheticDay = {
          stops: bucketIds.map((id) => stopById.get(id)!).filter(Boolean),
        };
        const scheduled = scheduleOrderedStopsForDay(syntheticDay, bucketIds, 'moderate', startLocation);

        for (const u of scheduled) {
          stopUpdates.push({
            id: u.id,
            data: {
              ...u.data,
              tripPlanDayId: dayRow.id,
            },
          });
        }
      }

      // Move + schedule every stop first, then remove days that no longer hold stops.
      for (const u of stopUpdates) {
        await tx.tripPlanStop.update({ where: { id: u.id }, data: u.data as any });
      }

      for (let i = dayBuckets.length; i < existingDays.length; i++) {
        const leftover = existingDays[i];
        const remaining = await tx.tripPlanStop.count({ where: { tripPlanDayId: leftover.id } });
        if (remaining === 0) {
          await tx.tripPlanDay.delete({ where: { id: leftover.id } });
        }
      }

      await tx.tripPlan.update({
        where: { id: tripId },
        data: {
          status: 'UPCOMING',
          days: dayBuckets.length,
          generationSource: trip.generationSource === 'AI_PROMPT' ? trip.generationSource : 'MANUAL',
        },
      });
    });

    const totalDistance = await this.calculateTotalDistance(tripId);
    const totalTime = await this.calculateTotalTime(tripId);
    await prismaTrip.update({ where: { id: tripId }, data: { totalDistance, totalTravelTime: totalTime } });

    return this.getById(tripId, trip.userId);
  },

  async aiGenerate(userId: string, input: AiGenerateInput) {
    const startDate = input.startDate ? new Date(input.startDate) : null;
    const budgetTier = input.budget === 'CUSTOM' ? null : input.budget;
    const provider = env.geminiApiKey && process.env.ENABLE_GEMINI_ITINERARY_POLISH === 'true'
      ? 'gemini+algorithmic'
      : 'algorithmic';

    // Defensive defaults — never let null/undefined arrays crash generation.
    const interests = Array.isArray(input.interests) ? input.interests : [];
    const avoid = Array.isArray(input.avoid) ? input.avoid : [];
    const manualPlaceIds = Array.isArray(input.manualPlaceIds) ? input.manualPlaceIds : [];

    let existingTrip: { id: string } | null = null;
    let pinnedPlaceIds = [...manualPlaceIds];

    if (input.tripId) {
      existingTrip = await assertTripAccess(input.tripId, userId, 'edit');
      const existingPinned = await prismaStop.findMany({
        where: { tripPlanDay: { tripPlanId: input.tripId }, isPinned: true },
        select: { placeId: true },
      });
      pinnedPlaceIds = Array.from(new Set([...pinnedPlaceIds, ...existingPinned.map((s) => s.placeId)]));
    }

    const resolvedPinned: string[] = [];
    for (const idOrSlug of pinnedPlaceIds) {
      try {
        const resolved = await resolvePlace(idOrSlug);
        resolvedPinned.push(resolved.id);
      } catch {
        // Unknown place id/slug — skip gracefully, never fail the whole generation.
      }
    }

    // Canonicalize so "Bangalore" / "New Delhi" resolve to the same place catalog.
    const destination = formatDestinationLabel(
      canonicalizeDestination(input.destination) || input.destination,
    );

    // If the user selected many places, expand days so every pick can fit
    // without silently dropping pins under the pace cap.
    const paceStops = ({ QUICK: 6, BALANCED: 4, RELAXED: 3, VERY_RELAXED: 2 } as Record<string, number>)[input.pace] || 4;
    const daysNeeded = resolvedPinned.length > 0
      ? Math.max(input.days, Math.ceil(resolvedPinned.length / paceStops))
      : input.days;
    const effectiveDays = Math.min(21, daysNeeded);

    let plan;
    try {
      plan = await generateItineraryPlan({
        destination,
        days: effectiveDays,
        pace: input.pace,
        travelers: input.travelers,
        budgetTier,
        customBudgetAmount: input.budget === 'CUSTOM' ? input.customBudgetAmount ?? null : null,
        interests,
        timePreference: input.timePreference,
        avoid,
        manualPlaceIds: resolvedPinned,
        fillWithAi: !!input.fillWithAi,
        prompt: input.prompt,
        startDate,
      });
    } catch (err: any) {
      try {
        await prisma.aiGenerationLog.create({
          data: {
            userId, tripPlanId: existingTrip?.id, prompt: input as unknown as Prisma.InputJsonValue,
            rawPromptText: input.prompt, provider, success: false,
            errorMessage: err?.message || 'Unknown generation error',
          },
        });
      } catch (logErr) {
        logger.error({ err: logErr }, 'Failed to write AI generation failure log');
      }
      logger.error({ err, destination: input.destination, days: input.days }, 'Itinerary engine failed');
      const detail = typeof err?.message === 'string' && err.message.trim() ? err.message.trim() : '';
      throw new ApiError(
        502,
        detail && detail.length < 200
          ? `Failed to generate itinerary: ${detail}`
          : 'Failed to generate itinerary. Please try again.',
      );
    }

    if (plan.stops.length === 0) {
      try {
        await prisma.aiGenerationLog.create({
          data: {
            userId, tripPlanId: existingTrip?.id, prompt: input as unknown as Prisma.InputJsonValue,
            rawPromptText: input.prompt, provider, success: false,
            errorMessage: plan.note,
          },
        });
      } catch (logErr) {
        logger.error({ err: logErr }, 'Failed to write empty-plan AI generation log');
      }
      throw new ApiError(422, plan.note || `We couldn't find enough places for "${destination}". Try a different destination or broaden your interests.`);
    }

    let tripId: string;
    try {
      tripId = await prisma.$transaction(async (tx) => {
      let trip: { id: string };

      if (existingTrip) {
        await tx.tripPlan.update({
          where: { id: existingTrip.id },
          data: {
            destination,
            days: effectiveDays,
            pace: input.pace,
            timePreference: input.timePreference,
            avoid,
            estimatedBudget: plan.estimatedBudget,
            customBudgetAmount: input.budget === 'CUSTOM' ? input.customBudgetAmount ?? null : null,
            generationSource: resolvedPinned.length > 0 ? 'HYBRID' : 'AI_PROMPT',
            aiPrompt: input.prompt,
            aiPreferences: input as unknown as Prisma.InputJsonValue,
            generatedAt: new Date(),
            startDate: startDate ?? undefined,
            status: 'UPCOMING',
          },
        });
        trip = existingTrip;

        const existingDays = await tx.tripPlanDay.findMany({ where: { tripPlanId: trip.id }, orderBy: { dayNumber: 'asc' } });
        if (existingDays.length < effectiveDays) {
          await tx.tripPlanDay.createMany({
            data: Array.from({ length: effectiveDays - existingDays.length }, (_, i) => ({
              tripPlanId: trip.id,
              dayNumber: existingDays.length + i + 1,
              date: startDate ? new Date(startDate.getTime() + (existingDays.length + i) * 86400000) : undefined,
            })),
          });
        }

        await tx.tripPlanStop.deleteMany({ where: { tripPlanDay: { tripPlanId: trip.id }, isPinned: false } });
      } else {
        trip = await tx.tripPlan.create({
          data: {
            title: `${destination} Trip`,
            destination,
            userId,
            days: effectiveDays,
            travelers: input.travelers,
            interests,
            budget: input.budget,
            pace: input.pace,
            timePreference: input.timePreference,
            avoid,
            estimatedBudget: plan.estimatedBudget,
            customBudgetAmount: input.budget === 'CUSTOM' ? input.customBudgetAmount ?? null : null,
            generationSource: resolvedPinned.length > 0 ? 'HYBRID' : 'AI_PROMPT',
            aiPrompt: input.prompt,
            aiPreferences: input as unknown as Prisma.InputJsonValue,
            generatedAt: new Date(),
            startDate,
            status: 'UPCOMING',
            tripDays: {
              create: Array.from({ length: effectiveDays }, (_, i) => ({
                dayNumber: i + 1,
                date: startDate ? new Date(startDate.getTime() + i * 86400000) : undefined,
              })),
            },
          },
        });
      }

      const days = await tx.tripPlanDay.findMany({ where: { tripPlanId: trip.id }, orderBy: { dayNumber: 'asc' } });
      const dayByNumber = new Map(days.map((d) => [d.dayNumber, d]));

      for (const stop of plan.stops) {
        const day = dayByNumber.get(stop.dayNumber);
        if (!day) continue;

        await tx.tripPlanStop.upsert({
          where: { tripPlanDayId_placeId: { tripPlanDayId: day.id, placeId: stop.placeId } },
          create: {
            tripPlanDayId: day.id,
            placeId: stop.placeId,
            order: stop.order,
            timeSlot: stop.timeSlot as TimeSlotKey,
            startTime: stop.startTime,
            endTime: stop.endTime,
            duration: stop.duration,
            cost: stop.cost ?? undefined,
            entryFee: stop.entryFee ?? undefined,
            distanceFromPrev: stop.distanceFromPrev ?? undefined,
            reason: stop.reason,
            isPinned: stop.isPinned,
          },
          update: {
            order: stop.order,
            timeSlot: stop.timeSlot as TimeSlotKey,
            startTime: stop.startTime,
            endTime: stop.endTime,
            duration: stop.duration,
            distanceFromPrev: stop.distanceFromPrev ?? undefined,
            reason: stop.reason,
          },
        });
      }

      return trip.id;
    }, { maxWait: 15_000, timeout: 30_000 });
    } catch (err: any) {
      logger.error({ err, destination: input.destination }, 'Failed to persist generated itinerary');
      throw new ApiError(502, 'Trip was planned but could not be saved. Please try again.');
    }

    try {
      const totalDistance = await this.calculateTotalDistance(tripId);
      await prismaTrip.update({ where: { id: tripId }, data: { totalDistance } });
    } catch (err) {
      logger.warn({ err, tripId }, 'Failed to update totalDistance after AI generate');
    }

    try {
      await prisma.aiGenerationLog.create({
        data: {
          userId, tripPlanId: tripId, prompt: input as unknown as Prisma.InputJsonValue,
          rawPromptText: input.prompt ?? null, provider, success: true,
        },
      });
    } catch (err) {
      logger.warn({ err, tripId }, 'Failed to write AI generation success log');
    }

    const trip = await this.getById(tripId, userId);
    return { trip, dayInfo: plan.dayInfo, warnings: plan.warnings, note: plan.note };
  },

  async quickAdd(userId: string, placeIdOrSlug: string, explicitTripId?: string) {
    const place = await prisma.place.findFirst({
      where: { OR: [{ id: placeIdOrSlug }, { slug: placeIdOrSlug }] },
      select: {
        id: true,
        city: true,
        name: true,
        estimatedDurationMinutes: true,
        recommendedDuration: true,
        category: true,
        ticketPrice: true,
      },
    });
    if (!place) throw new ApiError(404, 'Place not found.');

    return prisma.$transaction(async (tx) => {
      let trip = explicitTripId
        ? await tx.tripPlan.findFirst({
            where: {
              id: explicitTripId,
              OR: [{ userId }, { collaborators: { some: { userId, role: { not: 'VIEWER' } } } }],
            },
            select: { id: true },
          })
        : await tx.tripPlan.findFirst({
            where: { userId, status: 'DRAFT' },
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          });

      if (explicitTripId && !trip) throw new ApiError(404, 'Trip not found or unauthorized');

      if (!trip) {
        trip = await tx.tripPlan.create({
          data: {
            title: place.city ? `Trip to ${place.city}` : 'My Itinerary',
            destination: place.city || place.name || 'My Trip',
            userId,
            days: 1,
            status: 'DRAFT',
            generationSource: 'MANUAL',
            tripDays: { create: [{ dayNumber: 1 }] },
          },
          select: { id: true },
        });
      }

      let day = await resolveQuickAddDay(tx, trip.id);

      const existingStop = await tx.tripPlanStop.findFirst({
        where: { tripPlanDay: { tripPlanId: trip.id }, placeId: place.id },
        select: { id: true },
      });
      if (existingStop) {
        return { tripId: trip.id, stopId: existingStop.id, alreadyExists: true };
      }

      const maxOrder = await tx.tripPlanStop.findFirst({
        where: { tripPlanDayId: day.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const stop = await tx.tripPlanStop.create({
        data: {
          tripPlanDayId: day.id,
          placeId: place.id,
          order: maxOrder ? maxOrder.order + 1 : 0,
          duration: estimateDurationMinutes(place),
          entryFee: parseEntryFee(place.ticketPrice),
          isPinned: true,
        },
        select: { id: true },
      });

      return { tripId: trip.id, stopId: stop.id, alreadyExists: false };
    }, { maxWait: 5_000, timeout: 10_000 });
  },

  async calculateTotalDistance(tripId: string): Promise<number> {
    const stops = await prismaStop.findMany({
      where: { tripPlanDay: { tripPlanId: tripId } },
      include: { place: true },
      orderBy: [{ tripPlanDay: { dayNumber: 'asc' } }, { order: 'asc' }],
    });

    let total = 0;
    for (let i = 1; i < stops.length; i++) {
      const prev = stops[i - 1].place;
      const curr = stops[i].place;
      if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
        total += calcDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      }
    }
    return Math.round(total * 10) / 10;
  },

  async calculateTotalTime(tripId: string): Promise<number> {
    const stops = await prismaStop.findMany({
      where: { tripPlanDay: { tripPlanId: tripId } },
      select: { duration: true, place: { select: { category: true, recommendedDuration: true, estimatedDurationMinutes: true } } },
    });

    return stops.reduce((sum, s) => sum + (s.duration || estimateDurationMinutes(s.place)), 0);
  },

  async startTrip(tripId: string, userId: string) {
    const trip = await prismaTrip.findFirst({ where: { id: tripId, userId } });
    if (!trip) throw new ApiError(404, 'Trip not found or unauthorized');
    if (trip.status === 'ACTIVE') throw new ApiError(400, 'Trip is already active');
    if (trip.status === 'COMPLETED') throw new ApiError(400, 'Trip is already completed');

    const stops = await prismaStop.findMany({
      where: { tripPlanDay: { tripPlanId: tripId } },
      orderBy: [{ tripPlanDay: { dayNumber: 'asc' } }, { order: 'asc' }],
    });
    if (stops.length === 0) throw new ApiError(400, 'Cannot start a trip with no stops');

    return prismaTrip.update({
      where: { id: tripId },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
        currentDayIndex: 0,
        currentStopIndex: 0,
      },
      include: TRIP_INCLUDE,
    });
  },

  async completeTrip(tripId: string, userId: string) {
    const trip = await prismaTrip.findFirst({ where: { id: tripId, userId } });
    if (!trip) throw new ApiError(404, 'Trip not found or unauthorized');
    if (trip.status !== 'ACTIVE') throw new ApiError(400, 'Trip is not active');

    return prismaTrip.update({
      where: { id: tripId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        currentDayIndex: null,
        currentStopIndex: null,
      },
      include: TRIP_INCLUDE,
    });
  },

  async getProgress(tripId: string, userId: string) {
    const trip = await prismaTrip.findFirst({
      where: {
        id: tripId,
        OR: [{ userId }, { collaborators: { some: { userId } } }],
      },
      include: {
        tripDays: {
          orderBy: { dayNumber: 'asc' },
          include: {
            stops: {
              orderBy: { order: 'asc' },
              include: {
                place: {
                  select: {
                    id: true, name: true, slug: true, latitude: true, longitude: true,
                    category: true, images: true, thumbnail: true, city: true, state: true,
                    rating: true, reviewCount: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!trip) throw new ApiError(404, 'Trip not found');

    const allStops = trip.tripDays.flatMap(d => d.stops);
    const totalStops = allStops.length;
    const visitedStops = allStops.filter(s => s.visitedAt);
    const skippedStops = allStops.filter(s => s.skippedAt);

    return {
      tripId: trip.id,
      title: trip.title,
      status: trip.status,
      currentDayIndex: trip.currentDayIndex ?? 0,
      currentStopIndex: trip.currentStopIndex ?? 0,
      totalDays: trip.tripDays.length,
      totalStops,
      visitedCount: visitedStops.length,
      skippedCount: skippedStops.length,
      remainingCount: totalStops - visitedStops.length - skippedStops.length,
      completionPercent: totalStops > 0 ? Math.round(((visitedStops.length + skippedStops.length) / totalStops) * 100) : 0,
      startedAt: trip.startedAt,
      completedAt: trip.completedAt,
      currentDay: trip.tripDays[trip.currentDayIndex ?? 0] ? {
        dayNumber: trip.tripDays[trip.currentDayIndex ?? 0].dayNumber,
        theme: trip.tripDays[trip.currentDayIndex ?? 0].theme,
      } : null,
      currentStop: (trip.currentDayIndex != null && trip.currentStopIndex != null)
        ? (trip.tripDays[trip.currentDayIndex]?.stops[trip.currentStopIndex] ?? null)
        : null,
      nextStop: this.getNextUnvisitedStop(trip.tripDays, trip.currentDayIndex ?? 0, trip.currentStopIndex ?? 0),
      tripDays: trip.tripDays,
    };
  },

  getNextUnvisitedStop(tripDays: any[], currentDayIdx: number, currentStopIdx: number) {
    for (let d = currentDayIdx; d < tripDays.length; d++) {
      const stops = tripDays[d].stops;
      const startIdx = d === currentDayIdx ? currentStopIdx + 1 : 0;
      for (let s = startIdx; s < stops.length; s++) {
        if (!stops[s].visitedAt && !stops[s].skippedAt) return stops[s];
      }
    }
    return null;
  },

  async markStopVisited(stopId: string, userId: string) {
    const stop = await prismaStop.findUnique({
      where: { id: stopId },
      include: { tripPlanDay: true },
    });
    if (!stop) throw new ApiError(404, 'Stop not found');

    const trip = await prismaTrip.findFirst({
      where: { id: stop.tripPlanDay.tripPlanId, userId },
    });
    if (!trip) throw new ApiError(403, 'Not authorized');
    if (stop.visitedAt) throw new ApiError(400, 'Stop already marked as visited');
    if (stop.skippedAt) throw new ApiError(400, 'Stop was skipped');

    const updatedStop = await prismaStop.update({
      where: { id: stopId },
      data: { visitedAt: new Date() },
      include: {
        place: {
          select: {
            id: true, name: true, slug: true, latitude: true, longitude: true,
            category: true, images: true, thumbnail: true, city: true, state: true,
            rating: true, reviewCount: true,
          },
        },
      },
    });

    await this.advanceToNextStop(trip.id, stop.tripPlanDayId, stop.order);
    return updatedStop;
  },

  async skipStop(stopId: string, userId: string) {
    const stop = await prismaStop.findUnique({
      where: { id: stopId },
      include: { tripPlanDay: true },
    });
    if (!stop) throw new ApiError(404, 'Stop not found');

    const trip = await prismaTrip.findFirst({
      where: { id: stop.tripPlanDay.tripPlanId, userId },
    });
    if (!trip) throw new ApiError(403, 'Not authorized');
    if (stop.visitedAt) throw new ApiError(400, 'Stop already visited, cannot skip');
    if (stop.skippedAt) throw new ApiError(400, 'Stop already skipped');

    const updatedStop = await prismaStop.update({
      where: { id: stopId },
      data: { skippedAt: new Date() },
      include: {
        place: {
          select: {
            id: true, name: true, slug: true, latitude: true, longitude: true,
            category: true, images: true, thumbnail: true, city: true, state: true,
            rating: true, reviewCount: true,
          },
        },
      },
    });

    await this.advanceToNextStop(trip.id, stop.tripPlanDayId, stop.order);
    return updatedStop;
  },

  async advanceToNextStop(tripId: string, currentDayId: string, currentOrder: number) {
    const tripDays = await prismaDay.findMany({
      where: { tripPlanId: tripId },
      orderBy: { dayNumber: 'asc' },
      include: {
        stops: { orderBy: { order: 'asc' }, where: { visitedAt: null, skippedAt: null } },
      },
    });

    const currentDayIdx = tripDays.findIndex(d => d.id === currentDayId);
    if (currentDayIdx === -1) return;

    const remainingInDay = tripDays[currentDayIdx].stops.filter(
      s => s.order > currentOrder && !s.visitedAt && !s.skippedAt
    );

    if (remainingInDay.length > 0) {
      const nextOrder = remainingInDay[0].order;
      const nextIndex = tripDays[currentDayIdx].stops.findIndex(s => s.order === nextOrder);
      await prismaTrip.update({
        where: { id: tripId },
        data: { currentDayIndex: currentDayIdx, currentStopIndex: nextIndex },
      });
      return;
    }

    if (currentDayIdx + 1 < tripDays.length) {
      const nextDay = tripDays[currentDayIdx + 1];
      if (nextDay.stops.length > 0) {
        const nextStopIdx = nextDay.stops.findIndex(s => !s.visitedAt && !s.skippedAt);
        await prismaTrip.update({
          where: { id: tripId },
          data: { currentDayIndex: currentDayIdx + 1, currentStopIndex: Math.max(0, nextStopIdx) },
        });
        return;
      }
    }

    await prismaTrip.update({
      where: { id: tripId },
      data: { status: 'COMPLETED', completedAt: new Date(), currentDayIndex: null, currentStopIndex: null },
    });
  },

  async getAllTrips(query: any) {
    const params = getPaginationParams(query);
    const { status, search } = query;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prismaTrip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.limit,
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          _count: { select: { tripDays: true, collaborators: true } },
          tripDays: {
            include: { _count: { select: { stops: true } } },
          },
        },
      }),
      prismaTrip.count({ where }),
    ]);

    const enriched = data.map((trip: any) => {
      const { tripDays, ...rest } = trip;
      const stopsCount = tripDays.reduce((sum: number, d: any) => sum + (d._count?.stops || 0), 0);
      return { ...rest, stopsCount };
    });

    return paginatedResponse(enriched, total, params);
  },

  async getTripsStats() {
    const [totalTrips, activeTrips, completedToday, totalStops] = await Promise.all([
      prismaTrip.count(),
      prismaTrip.count({ where: { status: 'ACTIVE' } }),
      prismaTrip.count({
        where: {
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prismaStop.count(),
    ]);

    return { totalTrips, activeTrips, completedToday, totalStops };
  },

  async adminDelete(id: string) {
    const trip = await prismaTrip.findUnique({ where: { id } });
    if (!trip) throw new ApiError(404, 'Trip not found');
    await prismaTrip.delete({ where: { id } });
  },

  async getHistory(userId: string, query: any) {
    const params = getPaginationParams(query);

    const [data, total] = await Promise.all([
      prismaTrip.findMany({
        where: {
          userId,
          status: { in: ['COMPLETED', 'ARCHIVED'] },
        },
        orderBy: { completedAt: 'desc' },
        skip: params.skip,
        take: params.limit,
        include: {
          tripDays: {
            take: 1,
            include: {
              stops: {
                take: 1,
                include: { place: { select: { images: true, thumbnail: true } } },
              },
            },
          },
          _count: { select: { tripDays: true, collaborators: true } },
        },
      }),
      prismaTrip.count({ where: { userId, status: { in: ['COMPLETED', 'ARCHIVED'] } } }),
    ]);

    return paginatedResponse(data, total, params);
  },

  async addCollaborator(tripPlanId: string, userId: string, role: string, requesterId: string) {
    await assertTripAccess(tripPlanId, requesterId, 'owner');

    const existing = await prismaCollab.findUnique({
      where: { tripPlanId_userId: { tripPlanId, userId } },
    });
    if (existing) throw new ApiError(409, 'User is already a collaborator');

    return prismaCollab.create({
      data: { tripPlanId, userId, role },
      include: {
        user: { select: { id: true, name: true, avatar: true, avatarStyle: true } },
      },
    });
  },

  async removeCollaborator(tripPlanId: string, userId: string, requesterId: string) {
    await assertTripAccess(tripPlanId, requesterId, 'owner');

    const collab = await prismaCollab.findUnique({
      where: { tripPlanId_userId: { tripPlanId, userId } },
    });
    if (!collab) throw new ApiError(404, 'Collaborator not found');

    await prismaCollab.delete({ where: { id: collab.id } });
  },

  async updateCollaboratorRole(tripPlanId: string, userId: string, role: string, requesterId: string) {
    await assertTripAccess(tripPlanId, requesterId, 'owner');

    const collab = await prismaCollab.findUnique({
      where: { tripPlanId_userId: { tripPlanId, userId } },
    });
    if (!collab) throw new ApiError(404, 'Collaborator not found');

    return prismaCollab.update({
      where: { id: collab.id },
      data: { role },
      include: {
        user: { select: { id: true, name: true, avatar: true, avatarStyle: true } },
      },
    });
  },
};
