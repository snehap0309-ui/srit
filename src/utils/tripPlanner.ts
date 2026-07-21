import type { Dispatch, SetStateAction } from 'react';
import type { TripPlanResult, TripPlanDay, TripPlanStop } from '../services/api/ai';
import type { TouristSpot, UserProfile } from '../types';
import { cacheItineraryPlace } from './itineraryPlacesCache';
import { JABALPUR_MAP_PLACES } from '../data/jabalpurMapPlaces';
import { canonicalizeDestination, formatDestinationLabel, placeBelongsToDestination } from './destination';
import { INDIA_CANONICAL_DESTINATIONS, INDIA_DESTINATION_ALIASES } from '../../shared/indiaDestinationAliases';

/** Major India destinations for prompt/city inference — aliases + canonical cities. */
export const INDIA_DESTINATIONS = [
  ...new Set([
    ...Object.keys(INDIA_DESTINATION_ALIASES).map((k) => formatDestinationLabel(k)),
    ...INDIA_CANONICAL_DESTINATIONS.map((k) => formatDestinationLabel(k)),
  ]),
].sort((a, b) => b.length - a.length);

const INTEREST_CATEGORY_MAP: Record<string, string[]> = {
  temples: ['temple', 'church', 'mosque', 'gurudwara', 'spiritual', 'ghat'],
  heritage: ['heritage', 'fort', 'palace', 'museum', 'history', 'monument', 'cultural'],
  waterfalls: ['waterfall'],
  nature: ['nature', 'park', 'garden', 'wildlife', 'lake', 'viewpoint', 'river', 'waterfall'],
  food: ['food', 'market', 'local_experience', 'restaurant', 'cafe'],
  adventure: ['adventure', 'waterfall', 'wildlife', 'trek', 'viewpoint'],
  shopping: ['market', 'shopping', 'bazaar', 'local_experience'],
  'hidden gems': [],
  'local culture': ['cultural', 'museum', 'heritage', 'palace', 'local_experience', 'market'],
  // Legacy UI labels kept for backwards-compat with older suggested-trip presets.
  spiritual: ['spiritual', 'temple', 'church', 'ghat', 'mosque'],
  beaches: ['beach', 'nature', 'lake'],
  culture: ['cultural', 'museum', 'heritage', 'palace', 'local_experience'],
};

function normalizeInterestKey(label: string): string {
  return label.trim().toLowerCase();
}

export function inferTripDestination(prompt: string, selectedInterests: string[] = []): string {
  const lower = `${prompt || ''}`.toLowerCase();

  // Prefer longer names first (e.g. "Mahabalipuram" before "a")
  const ranked = [...INDIA_DESTINATIONS].sort((a, b) => b.length - a.length);
  for (const city of ranked) {
    if (lower.includes(city.toLowerCase())) {
      return formatDestinationLabel(canonicalizeDestination(city) || city);
    }
  }

  // "trip to X" / "visit X" / "in X"
  const patterns = [
    /(?:trip|travel|visit|tour|explore|itinerary|holiday|vacation)\s+(?:to|in|around|for)\s+([a-zA-Z\s]{3,30})/i,
    /(?:to|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  ];
  for (const re of patterns) {
    const m = prompt.match(re);
    if (m?.[1]) {
      const candidate = m[1].trim().replace(/[.!,].*$/, '');
      const known = INDIA_DESTINATIONS.find(c => c.toLowerCase() === candidate.toLowerCase());
      if (known) return formatDestinationLabel(canonicalizeDestination(known) || known);
      if (candidate.length >= 3 && candidate.length <= 24) {
        return formatDestinationLabel(candidate);
      }
    }
  }

  if (selectedInterests.includes('Beaches') || selectedInterests.includes('beaches')) return 'Goa';
  if (selectedInterests.includes('Spiritual') || selectedInterests.includes('temples')) return 'Varanasi';
  if (selectedInterests.includes('Heritage') || selectedInterests.includes('heritage')) return 'Jaipur';
  // Empty string forces the UI to ask for a city — never invent the wrong destination.
  return '';
}

export function buildTripPrompt(options: {
  prompt?: string;
  location: string;
  days: number;
  pace: string;
  interests?: string[];
}): string {
  const { prompt, location, days, pace, interests = [] } = options;
  const interestText = interests.length ? interests.join(', ') : 'top attractions, local experiences';
  const base = `Plan a complete ${days}-day ${pace} trip to ${location}, India. Focus on: ${interestText}. Include morning, afternoon and evening stops each day with realistic travel flow across the destination.`;
  if (prompt?.trim()) {
    return `${prompt.trim()}\n\nAlso follow these parameters: destination=${location}, days=${days}, pace=${pace}, interests=${interestText}.`;
  }
  return base;
}

export function extractPlaceIdsFromAiPlan(aiPlan: TripPlanResult): string[] {
  const placeIds: string[] = [];
  const sortedDays = [...(aiPlan.days || [])].sort((a, b) => a.day - b.day);
  for (const day of sortedDays) {
    const sortedStops = [...(day.stops || [])].sort((a, b) => a.order - b.order);
    for (const stop of sortedStops) {
      if (stop.placeId) placeIds.push(stop.placeId);
    }
  }
  return placeIds;
}

function stopToSpot(stop: TripPlanStop, locationHint?: string): TouristSpot {
  return {
    id: stop.placeId,
    name: stop.name,
    city: locationHint || '',
    state: '',
    latitude: stop.latitude,
    longitude: stop.longitude,
    category: (stop.category as TouristSpot['category']) || 'heritage',
    difficulty: 'easy',
    description: stop.description || '',
    shortDescription: stop.description || '',
    imageUri: null,
    points: 50,
  };
}

/** Persist AI/local plan stops so ItineraryScreen can resolve them by id. */
export function applyAiPlanToLocalItinerary(
  aiPlan: TripPlanResult,
  setUser: Dispatch<SetStateAction<UserProfile>>,
  locationHint?: string,
) {
  const placeIds: string[] = [];
  const sortedDays = [...(aiPlan.days || [])].sort((a, b) => a.day - b.day);
  for (const day of sortedDays) {
    const sortedStops = [...(day.stops || [])].sort((a, b) => a.order - b.order);
    for (const stop of sortedStops) {
      if (!stop?.placeId) continue;
      placeIds.push(stop.placeId);
      cacheItineraryPlace(stopToSpot(stop, locationHint));
    }
  }

  setUser(prev => ({
    ...prev,
    currentItinerary: placeIds,
    completedItineraryStops: [],
  }));
}

function interestMatchesPlace(place: TouristSpot, interests: string[]): boolean {
  if (!interests.length) return true;
  const cat = (place.category || '').toLowerCase();
  const tags = (place.tags || []).map(t => t.toLowerCase());
  const blob = `${place.name} ${place.description || ''} ${place.shortDescription || ''}`.toLowerCase();

  return interests.some(label => {
    const key = normalizeInterestKey(label);
    const mapped = INTEREST_CATEGORY_MAP[key] || [key];
    return mapped.some(token =>
      cat.includes(token) ||
      tags.some(t => t.includes(token)) ||
      blob.includes(token)
    );
  });
}

function matchesDestination(place: TouristSpot, location: string): boolean {
  return placeBelongsToDestination(
    { city: place.city, state: place.state, name: place.name },
    location,
  );
}

function stopsPerDayForPace(pace: string): number {
  const key = (pace || '').toUpperCase();
  if (key === 'VERY_RELAXED') return 2;
  if (key === 'RELAXED') return 3;
  if (key === 'QUICK' || key === 'INTENSIVE') return 7;
  return 5;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Offline / fallback full itinerary for any India city using available places.
 * Uses destination + interests + days + pace — no pre-selected places required.
 */
export function buildLocalTripPlan(options: {
  location: string;
  days: number;
  pace: string;
  interests?: string[];
  places?: TouristSpot[];
}): TripPlanResult {
  const days = Math.min(14, Math.max(1, options.days || 3));
  const pace = options.pace || 'moderate';
  const interests = options.interests || [];
  const location = options.location || 'Jabalpur';
  const pool = [...(options.places || []), ...JABALPUR_MAP_PLACES];

  // Deduplicate by id
  const byId = new Map<string, TouristSpot>();
  pool.forEach(p => {
    if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
  });
  const allPlaces = Array.from(byId.values()).filter(
    p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  );

  let cityPlaces = allPlaces.filter(p => matchesDestination(p, location));
  if (cityPlaces.length < 4) {
    // Fuzzy: match city words
    const token = location.split(/\s+/)[0].toLowerCase();
    cityPlaces = allPlaces.filter(p =>
      (p.city || '').toLowerCase().includes(token) ||
      (p.state || '').toLowerCase().includes(token)
    );
  }

  let eligible = cityPlaces.filter(p => interestMatchesPlace(p, interests));
  if (eligible.length < Math.min(days * 2, 6)) {
    // Prefer destination matches only — never silently fill with another city's map pack.
    eligible = cityPlaces;
  }

  if (eligible.length === 0) {
    return {
      title: `${days}-Day Trip in ${location}`,
      days: Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        theme: 'No places available',
        stops: [],
      })),
      totalPlaces: 0,
      totalDistance: 0,
      note: `We don't have offline places for "${location}". Connect to the server or try another city.`,
    };
  }

  // Prefer higher rated / must-visit
  eligible = [...eligible].sort((a, b) => {
    const score = (s: TouristSpot) => (s.rating || 0) * 10 + (s.mustVisit ? 5 : 0) + (s.points || 0) / 20;
    return score(b) - score(a);
  });

  const perDay = stopsPerDayForPace(pace);
  const needed = days * perDay;
  const selected = eligible.slice(0, Math.max(needed, Math.min(eligible.length, needed)));

  // Greedy nearest-neighbour order within destination cluster
  const ordered: TouristSpot[] = [];
  const remaining = [...selected];
  if (remaining.length) {
    remaining.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    let current = remaining.shift()!;
    ordered.push(current);
    while (remaining.length) {
      remaining.sort(
        (a, b) =>
          haversineKm(current.latitude, current.longitude, a.latitude, a.longitude) -
          haversineKm(current.latitude, current.longitude, b.latitude, b.longitude)
      );
      current = remaining.shift()!;
      ordered.push(current);
    }
  }

  const dayPlans: TripPlanDay[] = [];
  let totalDistance = 0;

  for (let d = 0; d < days; d++) {
    const dayStops = ordered.slice(d * perDay, (d + 1) * perDay);
    if (!dayStops.length && d > 0) break;

    const stops: TripPlanStop[] = dayStops.map((p, i) => {
      const distKm =
        i === 0
          ? 0
          : haversineKm(
              dayStops[i - 1].latitude,
              dayStops[i - 1].longitude,
              p.latitude,
              p.longitude
            );
      const distM = Math.round(distKm * 1000);
      totalDistance += distM;
      const slot: TripPlanStop['timeSlot'] =
        i < Math.ceil(dayStops.length / 3)
          ? 'morning'
          : i < Math.ceil((2 * dayStops.length) / 3)
            ? 'afternoon'
            : 'evening';

      return {
        placeId: p.id,
        name: p.name,
        category: String(p.category || 'heritage'),
        latitude: p.latitude,
        longitude: p.longitude,
        timeSlot: slot,
        order: i + 1,
        distanceFromPrev: distM,
        description: p.shortDescription || p.description || `${p.name} in ${p.city || location}`,
      };
    });

    const themeCat = dayStops[0]?.category || 'heritage';
    dayPlans.push({
      day: d + 1,
      theme: `Day ${d + 1} · ${String(themeCat).charAt(0).toUpperCase()}${String(themeCat).slice(1)} in ${location}`,
      stops,
    });
  }

  // Ensure at least one day exists
  if (!dayPlans.length) {
    dayPlans.push({
      day: 1,
      theme: `Explore ${location}`,
      stops: [],
    });
  }

  const totalPlaces = dayPlans.reduce((n, d) => n + d.stops.length, 0);
  const interestNote = interests.length ? `Focused on ${interests.join(', ')}.` : 'Balanced mix of top attractions.';

  return {
    title: `${days}-Day ${pace.charAt(0).toUpperCase()}${pace.slice(1)} Trip to ${location}`,
    days: dayPlans,
    totalPlaces,
    totalDistance,
    note: `${interestNote} Pace: ${pace}. Generated for ${location}, India.`,
  };
}

export function isTripPlanEmpty(plan: TripPlanResult | null | undefined): boolean {
  if (!plan?.days?.length) return true;
  return plan.days.every(d => !d.stops?.length);
}
