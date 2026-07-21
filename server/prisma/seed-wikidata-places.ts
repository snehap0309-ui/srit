/**
 * Seed genuine Wikidata / Wikimedia places (from places-geocoded.json).
 * Upserts on externalId — no synthetic coordinates or fake names.
 *
 * Run: cd server && npm run db:seed:wikidata
 */
import { Prisma, PrismaClient, PlaceStatus, PlaceSource } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const COMMERCIAL = new Set([
  'shopping', 'restaurant', 'hotel', 'cafe', 'shop', 'market',
  'SHOPPING', 'RESTAURANT', 'HOTEL',
]);

function bestTimeJson(from: unknown, to: unknown): Prisma.InputJsonValue | undefined {
  if (!from || !to) return undefined;
  return { from, to, label: 'Daytime' } as Prisma.InputJsonValue;
}

function mapCategory(raw: string): string {
  const c = (raw || '').toLowerCase().trim();
  const map: Record<string, string> = {
    temple: 'TEMPLE',
    fort: 'FORT',
    palace: 'PALACE',
    monument: 'MONUMENT',
    museum: 'MUSEUM',
    park: 'PARK',
    nature: 'PARK',
    wildlife: 'WILDLIFE',
    waterfall: 'WATERFALL',
    beach: 'BEACH',
    lake: 'LAKE',
    ghat: 'GHAT',
    trek: 'TREKKING',
    trekking: 'TREKKING',
    adventure: 'TREKKING',
    church: 'OTHER',
    mosque: 'OTHER',
    gurudwara: 'OTHER',
    heritage: 'MONUMENT',
    history: 'MONUMENT',
    spiritual: 'TEMPLE',
    religious: 'TEMPLE',
    cave: 'MONUMENT',
    garden: 'PARK',
  };
  return map[c] || 'MONUMENT';
}

function generateSlug(name: string, used: Set<string>): string {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'place';
  let slug = `wd-${base}`;
  let n = 1;
  while (used.has(slug)) {
    slug = `wd-${base}-${n++}`;
  }
  used.add(slug);
  return slug;
}

async function main() {
  const candidates = [
    path.join(__dirname, 'seed-data', 'places-wikidata.json'),
    path.join(__dirname, 'seed-data', 'places-geocoded.json'),
  ].filter((f) => fs.existsSync(f));

  if (!candidates.length) {
    console.error('No Wikidata JSON found. Run: node scripts/fetch-wikidata-places.cjs');
    process.exit(1);
  }

  // Prefer the larger genuine dump (newer expand fetches usually land in places-wikidata.json)
  let filePath = candidates[0];
  let places: any[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const f of candidates.slice(1)) {
    const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (Array.isArray(arr) && arr.length > places.length) {
      filePath = f;
      places = arr;
    }
  }
  console.log(`Loaded ${places.length} genuine places from ${path.basename(filePath)}`);

  const admin = await prisma.user.findFirst({ where: { permission: 'ADMIN' } });
  const tourist = await prisma.user.findFirst({ where: { permission: 'USER' } });
  if (!admin || !tourist) {
    console.error('Admin/USER missing. Run npm run db:seed first.');
    process.exit(1);
  }

  const existingSlugs = new Set(
    (await prisma.place.findMany({ select: { slug: true } })).map(p => p.slug),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of places) {
    const name = String(p.name || '').trim();
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }
    if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
      skipped++;
      continue;
    }

    const category = mapCategory(p.category || 'monument');
    if (COMMERCIAL.has(category)) {
      skipped++;
      continue;
    }

    const externalId = `wikidata:${p.id || p.wikidataId || name}`;
    const description =
      (p.description && String(p.description).trim()) ||
      `${name} is a notable place in ${p.city || p.state || 'India'}.`;
    const images = p.imageUrl ? [String(p.imageUrl).replace(/^http:/, 'https:')] : [];
    const city = String(p.city || '').trim();
    const state = String(p.state || '').trim();

    const existing = await prisma.place.findUnique({ where: { externalId } });
    if (existing) {
      await prisma.place.update({
        where: { id: existing.id },
        data: {
          name,
          description,
          shortDescription: description.slice(0, 180),
          latitude: lat,
          longitude: lng,
          category,
          city,
          state,
          country: p.country || 'India',
          images: images.length ? images : existing.images,
          thumbnail: images[0] || existing.thumbnail || undefined,
          rating: p.rating ?? existing.rating,
          status: PlaceStatus.APPROVED,
          source: PlaceSource.WIKIMEDIA,
          hiddenGemScore: p.isHiddenGem ? 5 : existing.hiddenGemScore,
          popularityScore: p.mustVisit ? 50 : (existing.popularityScore ?? 30),
          ...( (() => { const bt = bestTimeJson(p.bestTimeFrom, p.bestTimeTo); return bt ? { bestTimeToVisit: bt } : {}; })() ),
          bestTimeReason: p.bestTimeReason || existing.bestTimeReason || undefined,
          approvedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      updated++;
      continue;
    }

    // Soft dedupe by name+city+state (when city known) OR same name near same coords
    if (city) {
      const dup = await prisma.place.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
          state: { equals: state, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (dup) {
        skipped++;
        continue;
      }
    }
    const nearDup = await prisma.place.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        latitude: { gte: lat - 0.001, lte: lat + 0.001 },
        longitude: { gte: lng - 0.001, lte: lng + 0.001 },
      },
      select: { id: true },
    });
    if (nearDup) {
      skipped++;
      continue;
    }

    const slug = generateSlug(name, existingSlugs);
    await prisma.place.create({
      data: {
        name,
        slug,
        description,
        shortDescription: description.slice(0, 180),
        latitude: lat,
        longitude: lng,
        category,
        tags: [category, state.toLowerCase().replace(/\s+/g, '-')].filter(Boolean),
        images,
        thumbnail: images[0] || null,
        city,
        state,
        country: p.country || 'India',
        rating: typeof p.rating === 'number' ? p.rating : 4.2,
        status: PlaceStatus.APPROVED,
        source: PlaceSource.WIKIMEDIA,
        externalId,
        hiddenGemScore: p.isHiddenGem ? 5 : 0,
        popularityScore: p.mustVisit ? 50 : 30,
        verificationLevel: 2,
        ...( (() => { const bt = bestTimeJson(p.bestTimeFrom, p.bestTimeTo); return bt ? { bestTimeToVisit: bt } : {}; })() ),
        bestTimeReason: p.bestTimeReason || 'Favorable weather and full access to the site.',
        submittedById: tourist.id,
        approvedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    created++;
  }

  console.log(`Wikidata seed done. created=${created} updated=${updated} skipped=${skipped}`);
  const bySource = await prisma.place.groupBy({
    by: ['source'],
    _count: { _all: true },
    where: { status: 'APPROVED' },
  });
  console.log('Approved places by source:', bySource.map(r => `${r.source}:${r._count._all}`).join(', '));
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
