/**
 * Seed genuine OSM places with strong de-duplication.
 * - Uses externalId = osm:* for upsert identity
 * - Skips name+approx-coord duplicates already in DB
 * - Never inserts hotels / restaurants / shops
 *
 * Run: cd server && npx ts-node prisma/seed-osm.ts
 */
import { PrismaClient, PlaceStatus, PlaceSource, PlaceCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const VENDOR_CATEGORIES = new Set(['RESTAURANT', 'HOTEL', 'SHOPPING']);

function mapCategory(cat: string): PlaceCategory {
  const c = (cat || '').toUpperCase();
  const valid = new Set(Object.values(PlaceCategory));
  if (valid.has(c as PlaceCategory)) return c as PlaceCategory;
  const aliases: Record<string, PlaceCategory> = {
    HERITAGE: PlaceCategory.MONUMENT,
    NATURE: PlaceCategory.PARK,
    CAVE: PlaceCategory.MONUMENT,
    SPIRITUAL: PlaceCategory.TEMPLE,
    RELIGIOUS: PlaceCategory.TEMPLE,
    GARDEN: PlaceCategory.PARK,
    VIEWPOINT: PlaceCategory.OTHER,
    ADVENTURE: PlaceCategory.TREKKING,
    TREK: PlaceCategory.TREKKING,
    CHURCH: PlaceCategory.OTHER,
    MOSQUE: PlaceCategory.OTHER,
    GURUDWARA: PlaceCategory.OTHER,
    WILDLIFE: PlaceCategory.WILDLIFE,
  };
  return aliases[c] || PlaceCategory.OTHER;
}

function normName(name: string) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function coordKey(lat: number, lng: number) {
  return `${Math.round(lat * 1000)},${Math.round(lng * 1000)}`;
}

function placeKey(name: string, lat: number, lng: number) {
  return `${normName(name)}|${coordKey(lat, lng)}`;
}

function locKey(name: string, city: string, state: string) {
  return `${normName(name)}|${String(city || '').toLowerCase().trim()}|${String(state || '').toLowerCase().trim()}`;
}

async function main() {
  const existing = await prisma.place.findMany({
    select: {
      name: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      externalId: true,
      slug: true,
    },
  });

  const existingExt = new Set(existing.map((p) => p.externalId).filter(Boolean) as string[]);
  const existingCoord = new Set(
    existing.map((p) => placeKey(p.name, Number(p.latitude), Number(p.longitude))),
  );
  const existingLoc = new Set(
    existing
      .filter((p) => p.city && String(p.city).trim())
      .map((p) => locKey(p.name, p.city, p.state)),
  );
  const usedSlugs = new Set(existing.map((p) => p.slug));

  console.log(`Existing places: ${existing.length} (extIds=${existingExt.size})`);

  const deletedRefs = await prisma.deletedPlaceRef.findMany({
    select: { slug: true, externalId: true, name: true, city: true, state: true },
  });
  const deletedExt = new Set(deletedRefs.map((d) => d.externalId).filter(Boolean) as string[]);
  const deletedLoc = new Set(
    deletedRefs.map(
      (d) => `${normName(d.name)}|${String(d.city || '').toLowerCase().trim()}|${String(d.state || '').toLowerCase().trim()}`,
    ),
  );

  const dir = path.join(__dirname, 'seed-data');
  const files = [
    path.join(dir, 'osm-places.json'),
    path.join(dir, 'osm-places-retry.json'),
    path.join(dir, 'osm-places-extra.json'),
  ];

  let allOsm: any[] = [];
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const chunk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(chunk) && chunk.length) {
      console.log(`Loaded ${chunk.length} from ${path.basename(filePath)}`);
      allOsm = allOsm.concat(chunk);
    }
  }

  const admin = await prisma.user.findFirst({ where: { permission: 'ADMIN' } });
  if (!admin) {
    console.error('No admin found — run npm run db:seed first');
    process.exit(1);
  }

  const seenFile = new Set<string>();
  const toInsert: any[] = [];
  let skippedDup = 0;
  let skippedVendor = 0;
  let skippedInvalid = 0;

  for (const p of allOsm) {
    const name = String(p.name || '').trim();
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (!name || name.length < 2 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skippedInvalid++;
      continue;
    }
    if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
      skippedInvalid++;
      continue;
    }

    const category = mapCategory(p.category || 'monument');
    if (VENDOR_CATEGORIES.has(category)) {
      skippedVendor++;
      continue;
    }

    const externalId = String(p.id || '').startsWith('osm:')
      ? String(p.id)
      : p.id
        ? `osm:${p.id}`
        : null;

    if (externalId && (existingExt.has(externalId) || deletedExt.has(externalId))) {
      skippedDup++;
      continue;
    }

    const ck = placeKey(name, lat, lng);
    if (existingCoord.has(ck) || seenFile.has(ck)) {
      skippedDup++;
      continue;
    }

    const city = String(p.city || '').trim();
    const state = String(p.state || '').trim();
    if (city) {
      const lk = locKey(name, city, state);
      if (existingLoc.has(lk) || deletedLoc.has(lk)) {
        skippedDup++;
        continue;
      }
      existingLoc.add(lk);
    }

    seenFile.add(ck);
    if (externalId) existingExt.add(externalId);
    existingCoord.add(ck);

    let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50) || 'place';
    let slug = `osm-${base}`;
    let n = 1;
    while (usedSlugs.has(slug)) {
      slug = `osm-${base}-${n++}`;
    }
    usedSlugs.add(slug);

    toInsert.push({
      name,
      slug,
      externalId,
      description:
        p.shortDescription ||
        p.description ||
        `${name} is a tourist attraction in ${city || state || 'India'}.`,
      shortDescription: String(p.shortDescription || '').substring(0, 200) || null,
      latitude: lat,
      longitude: lng,
      category,
      tags: Array.isArray(p.tags) ? p.tags : [String(category).toLowerCase()],
      images: p.imageUrl ? [p.imageUrl] : [],
      status: PlaceStatus.APPROVED,
      source: PlaceSource.OSM,
      city: city || '',
      state: state || '',
      country: 'India',
      submittedById: admin.id,
      approvedById: admin.id,
      reviewedAt: new Date(),
    });
  }

  console.log(`To insert: ${toInsert.length}`);
  console.log(`Skipped duplicates: ${skippedDup}, vendor: ${skippedVendor}, invalid: ${skippedInvalid}`);

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const res = await prisma.place.createMany({ data: batch, skipDuplicates: true });
    inserted += res.count;
    if (i % 1000 === 0 || i + BATCH >= toInsert.length) {
      console.log(`  Inserted ${inserted}/${toInsert.length}`);
    }
  }

  const total = await prisma.place.count();
  console.log(`\nDone. Newly inserted: ${inserted}. Total places: ${total}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
