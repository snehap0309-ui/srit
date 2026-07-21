import AsyncStorage from '@react-native-async-storage/async-storage';
import { tripsApi, TripPlan } from '../services/api/trips';
import { normalizeTripPlan } from './normalizeTripPlan';
import { placesApi } from '../services/api/places';

/** Offline map pins whose ids differ from the server seed. */
const PLACE_ID_ALIASES: Record<string, string> = {
  'dhuandhar-falls': 'bhedaghat-dhuandhar',
  'marble-rocks-bhedaghat': 'marble-rocks-viewpoint',
  bhedaghat: 'bhedaghat-dhuandhar',
};

export const DRAFT_TRIP_ID_KEY = '@palsafar_draft_trip_id';
const DRAFT_TRIP_SNAPSHOT_KEY = '@palsafar_draft_trip_snapshot';
const MEMORY_TTL_MS = 45_000;

let memoryDraft: { trip: TripPlan; at: number } | null = null;

export function resolvePlaceIdForQuickAdd(placeId: string): string {
  return PLACE_ID_ALIASES[placeId] || placeId;
}

export function invalidateDraftTripCache() {
  memoryDraft = null;
}

export function seedDraftTripCache(trip: TripPlan) {
  const normalized = normalizeTripPlan(trip);
  memoryDraft = { trip: normalized, at: Date.now() };
  saveDraftSnapshot(normalized).catch(() => {});
}

async function saveDraftSnapshot(trip: TripPlan) {
  await AsyncStorage.multiSet([
    [DRAFT_TRIP_ID_KEY, trip.id],
    [DRAFT_TRIP_SNAPSHOT_KEY, JSON.stringify(trip)],
  ]);
}

export async function loadDraftSnapshot(): Promise<TripPlan | null> {
  if (memoryDraft && Date.now() - memoryDraft.at < MEMORY_TTL_MS) {
    return memoryDraft.trip;
  }
  try {
    const raw = await AsyncStorage.getItem(DRAFT_TRIP_SNAPSHOT_KEY);
    if (!raw) return null;
    const trip = JSON.parse(raw) as TripPlan;
    if (trip?.id && countTripStops(trip) > 0) {
      const normalized = normalizeTripPlan(trip);
      memoryDraft = { trip: normalized, at: Date.now() };
      return normalized;
    }
  } catch {
    /* ignore corrupt snapshot */
  }
  return null;
}

async function findServerPlaceId(placeId: string, name?: string, city?: string): Promise<string | null> {
  const alias = resolvePlaceIdForQuickAdd(placeId);
  if (alias !== placeId) return alias;

  if (!name?.trim()) return null;
  try {
    const res = await placesApi.list({
      search: name.trim(),
      city: city?.trim() || undefined,
      limit: 5,
      status: 'APPROVED',
    });
    const hits = res.data || [];
    if (hits.length === 1) return hits[0].id;
    const exact = hits.find(p => p.name.toLowerCase() === name.toLowerCase());
    return exact?.id || hits[0]?.id || null;
  } catch {
    return null;
  }
}

export async function quickAddPlaceToTrip(
  placeId: string,
  options?: { name?: string; city?: string; tripId?: string },
) {
  const candidates = [
    resolvePlaceIdForQuickAdd(placeId),
    placeId,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  let lastError: any;
  for (const candidate of candidates) {
    try {
      const result = await tripsApi.quickAdd(candidate, options?.tripId);
      await AsyncStorage.setItem(DRAFT_TRIP_ID_KEY, result.tripId);
      return result;
    } catch (err) {
      lastError = err;
    }
  }

  const resolved = await findServerPlaceId(placeId, options?.name, options?.city);
  if (resolved) {
    const result = await tripsApi.quickAdd(resolved, options?.tripId);
    await AsyncStorage.setItem(DRAFT_TRIP_ID_KEY, result.tripId);
    return result;
  }

  throw lastError;
}

export function countTripStops(trip: TripPlan | null | undefined): number {
  if (!trip?.tripDays?.length) return 0;
  return trip.tripDays.reduce((n, d) => n + (d.stops?.length || 0), 0);
}

type LoadOptions = {
  /** Skip rebuilding draft from local place ids (slow). */
  skipResync?: boolean;
};

async function fetchDraftById(tripId: string, requireStops = false): Promise<TripPlan | null> {
  try {
    const full = await tripsApi.getById(tripId);
    if (full.status !== 'DRAFT') return null;
    if (requireStops && countTripStops(full) === 0) return null;
    const normalized = normalizeTripPlan(full);
    seedDraftTripCache(normalized);
    return normalized;
  } catch {
    await AsyncStorage.multiRemove([DRAFT_TRIP_ID_KEY, DRAFT_TRIP_SNAPSHOT_KEY]);
  }
  return null;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Create or reuse the active manual (self-build) draft trip. */
export async function ensureManualDraftTrip(): Promise<TripPlan> {
  const cachedId = await AsyncStorage.getItem(DRAFT_TRIP_ID_KEY);
  if (cachedId) {
    const cached = await fetchDraftById(cachedId);
    if (cached) return cached;
  }

  try {
    const list = await tripsApi.list({ status: 'DRAFT', limit: 5 });
    let best: TripPlan | null = null;
    for (const draft of list.data || []) {
      const full = await fetchDraftById(draft.id);
      if (!full) continue;
      if (countTripStops(full) > 0) return full;
      if (!best) best = full;
    }
    if (best) return best;
  } catch {
    /* fall through to create */
  }

  const start = new Date();
  const trip = await tripsApi.create({
    title: 'My Itinerary',
    destination: 'My Trip',
    startDate: isoDate(start),
    endDate: isoDate(start),
  });
  seedDraftTripCache(trip);
  return trip;
}

async function resyncFromLocalItinerary(currentItinerary: string[]): Promise<TripPlan | null> {
  const ids = [...new Set(currentItinerary)].slice(0, 25);
  await Promise.all(ids.map(placeId => quickAddPlaceToTrip(placeId).catch(() => {})));

  const cachedId = await AsyncStorage.getItem(DRAFT_TRIP_ID_KEY);
  if (cachedId) {
    return fetchDraftById(cachedId);
  }

  const list = await tripsApi.list({ status: 'DRAFT', limit: 1 });
  const draftId = list.data?.[0]?.id;
  return draftId ? fetchDraftById(draftId) : null;
}

export async function loadBestDraftTrip(
  currentItinerary?: string[],
  options: LoadOptions = {},
): Promise<TripPlan | null> {
  if (memoryDraft && Date.now() - memoryDraft.at < MEMORY_TTL_MS) {
    return memoryDraft.trip;
  }

  const cachedId = await AsyncStorage.getItem(DRAFT_TRIP_ID_KEY);
  if (cachedId) {
    const withStops = await fetchDraftById(cachedId, true);
    if (withStops) return withStops;
    const cached = await fetchDraftById(cachedId);
    if (cached) return cached;
  }

  const list = await tripsApi.list({ status: 'DRAFT', limit: 3 });
  let emptyDraft: TripPlan | null = null;
  for (const draft of list.data || []) {
    const full = await fetchDraftById(draft.id);
    if (!full) continue;
    if (countTripStops(full) > 0) return full;
    if (!emptyDraft) emptyDraft = full;
  }
  if (emptyDraft) return emptyDraft;

  if (!options.skipResync && currentItinerary?.length) {
    return resyncFromLocalItinerary(currentItinerary);
  }

  return null;
}
