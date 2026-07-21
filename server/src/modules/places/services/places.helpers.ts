import { Prisma, Role, PlaceCategory } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ApiError } from '../../../shared/utils/ApiError';

/** Shops / cafés / hotels belong to vendors, not tourist places. */
export const COMMERCIAL_PLACE_CATEGORIES: PlaceCategory[] = [
  PlaceCategory.SHOPPING,
  PlaceCategory.RESTAURANT,
  PlaceCategory.HOTEL,
];

export const excludeCommercialPlacesSql = Prisma.sql`
  p.category::text NOT IN ('SHOPPING', 'RESTAURANT', 'HOTEL')
`;

export const excludeCommercialPlacesWhere: Prisma.PlaceWhereInput = {
  category: { notIn: COMMERCIAL_PLACE_CATEGORIES },
};

export const placeListSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  latitude: true,
  longitude: true,
  category: true,
  images: true,
  thumbnail: true,
  tags: true,
  status: true,
  source: true,
  city: true,
  state: true,
  country: true,
  rating: true,
  reviewCount: true,
  hiddenGemScore: true,
  popularityScore: true,
  verificationLevel: true,
  bestTimeToVisit: true,
  bestTimeReason: true,
  ticketPrice: true,
  recommendedDuration: true,
  estimatedDurationMinutes: true,
  submittedBy: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlaceSelect;

export const placeDetailSelect = {
  ...placeListSelect,
  history: true,
  recommendedDuration: true,
  hasParking: true,
  parkingDetails: true,
  isAccessible: true,
  accessibilityDetails: true,
  hasWashroom: true,
  isPetFriendly: true,
  website: true,
  emergencyContact: true,
  openingHours: true,
  ticketPrice: true,
  approvedBy: { select: { id: true, name: true } },
  reviewedAt: true,
} satisfies Prisma.PlaceSelect;

export const placeApproved = Prisma.sql`'APPROVED'`;

export async function generateSlug(name: string, existingId?: string): Promise<string> {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
  if (!slug) slug = 'place';

  let counter = 0;
  let candidate = slug;
  while (true) {
    const existing = await prisma.place.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || (existingId && existing.id === existingId)) break;
    counter++;
    candidate = `${slug}-${counter}`;
  }
  return candidate;
}

export async function resolvePlace(identifier: string): Promise<{ id: string }> {
  const place = await prisma.place.findUnique({
    where: { id: identifier },
    select: { id: true },
  });
  if (place) return place;

  const placeBySlug = await prisma.place.findUnique({
    where: { slug: identifier },
    select: { id: true },
  });
  if (placeBySlug) return placeBySlug;

  throw new ApiError(404, 'Place not found.');
}

export async function verifyVendorAccess(placeId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { permission: true, vendor: { select: { status: true, id: true, linkedSpotIds: true } } },
  });
  if (!user || (user.permission !== Role.VENDOR && user.permission !== Role.ADMIN)) {
    throw new ApiError(403, 'Vendor or admin access required.');
  }
  if (user.permission !== Role.ADMIN) {
    if (!user.vendor || user.vendor.status !== 'APPROVED') {
      throw new ApiError(403, 'Your vendor account must be approved to manage places.');
    }
    // Vendor can only manage places linked to their profile
    if (!user.vendor.linkedSpotIds.includes(placeId)) {
      throw new ApiError(403, 'You can only manage places linked to your vendor profile.');
    }
  }
  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) throw new ApiError(404, 'Place not found.');
  if (place.status !== 'APPROVED') {
    throw new ApiError(400, 'Only approved places can be managed.');
  }
}

export async function verifyAccess(placeId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { permission: true, vendor: { select: { id: true, linkedSpotIds: true, status: true } } },
  });
  if (!user) throw new ApiError(401, 'Authentication required.');

  if (user.permission === Role.ADMIN) return;

  const place = await prisma.place.findUnique({ where: { id: placeId }, select: { submittedById: true } });
  if (!place) throw new ApiError(404, 'Place not found.');

  // Owner of the place can access
  if (place.submittedById === userId) return;

  // Vendor can only access places linked to their vendor profile
  if (user.permission === Role.VENDOR && user.vendor && user.vendor.status === 'APPROVED') {
    if (user.vendor.linkedSpotIds.includes(placeId)) return;
  }

  throw new ApiError(403, 'Access denied.');
}

export async function recalculatePlaceRating(placeId: string) {
  const result = await prisma.review.aggregate({
    where: { placeId },
    _avg: { rating: true },
    _count: true,
  });

  await prisma.place.update({
    where: { id: placeId },
    data: {
      rating: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : null,
      reviewCount: result._count,
    },
  });
}

export function mapPlaceRow(r: any) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    shortDescription: r.short_description,
    description: r.description,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    category: r.category,
    images: r.images || [],
    thumbnail: r.thumbnail,
    tags: r.tags || [],
    city: r.city || '',
    state: r.state || '',
    country: r.country || 'India',
    rating: r.rating ? Number(r.rating) : null,
    reviewCount: Number(r.review_count || 0),
    hiddenGemScore: r.hidden_gem_score ? Number(r.hidden_gem_score) : null,
    popularityScore: r.popularity_score ? Number(r.popularity_score) : null,
    verificationLevel: Number(r.verification_level || 0),
    bestTimeToVisit: r.best_time_to_visit ?? null,
    bestTimeReason: r.best_time_reason ?? null,
    distance: r.distance ? Math.round(Number(r.distance)) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapViewportRow(r: any) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    shortDescription: r.short_description,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    category: r.category,
    images: r.images || [],
    thumbnail: r.thumbnail,
    tags: r.tags || [],
    city: r.city || '',
    state: r.state || '',
    country: r.country || 'India',
    rating: r.rating ? Number(r.rating) : null,
    reviewCount: Number(r.review_count || 0),
    hiddenGemScore: r.hidden_gem_score ? Number(r.hidden_gem_score) : null,
    popularityScore: r.popularity_score ? Number(r.popularity_score) : null,
    verificationLevel: Number(r.verification_level || 0),
    bestTimeToVisit: r.best_time_to_visit ?? null,
    bestTimeReason: r.best_time_reason ?? null,
    createdAt: r.created_at,
  };
}

/** Deduplicate image URLs (case-sensitive, preserve first occurrence order). */
export function dedupeImageUrls(urls: string[] | undefined | null): string[] {
  if (!urls?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
