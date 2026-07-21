import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function toSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

async function main() {
  const filePath = path.join(__dirname, 'seed-data', 'places-curated.json');
  if (!fs.existsSync(filePath)) {
    console.error('Error: places-curated.json not found at', filePath);
    process.exit(1);
  }

  const places = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Loaded ${places.length} curated places from JSON.`);

  const admin = await prisma.user.findFirst({ where: { permission: 'ADMIN' } });
  const tourist = await prisma.user.findFirst({ where: { permission: 'USER' } });

  if (!admin || !tourist) {
    console.error('Admin or tourist user not found. Run db:seed first.');
    process.exit(1);
  }

  console.log(`Using admin: ${admin.email}, tourist: ${tourist.email}`);

  const deletedRefs = await prisma.deletedPlaceRef.findMany({
    select: { slug: true, curatedId: true, name: true, city: true, state: true },
  });
  const deletedSlugs = new Set(deletedRefs.map((d) => d.slug));
  const deletedCuratedIds = new Set(
    deletedRefs.map((d) => d.curatedId).filter(Boolean) as string[],
  );
  const deletedLoc = new Set(
    deletedRefs.map(
      (d) =>
        `${normName(d.name)}|${String(d.city || '').toLowerCase()}|${String(d.state || '').toLowerCase()}`,
    ),
  );

  const existingPlaces = await prisma.place.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      images: true,
      thumbnail: true,
      externalId: true,
    },
  });
  const slugToPlace = new Map(existingPlaces.map((p) => [p.slug, p]));
  const usedSlugs = new Set(existingPlaces.map((p) => p.slug));
  const existingByLoc = new Map(
    existingPlaces.map((p) => [
      `${normName(p.name)}|${String(p.city || '').toLowerCase()}|${String(p.state || '').toLowerCase()}`,
      p,
    ]),
  );
  const existingByExternal = new Map(
    existingPlaces
      .filter((p) => p.externalId)
      .map((p) => [p.externalId as string, p]),
  );

  const validCats: Record<string, string> = {
    ghat: 'ghat',
    temple: 'temple',
    waterfall: 'waterfall',
    mosque: 'mosque',
    church: 'church',
    gurudwara: 'gurudwara',
    monument: 'monument',
    museum: 'museum',
    park: 'park',
    lake: 'lake',
    fort: 'fort',
    beach: 'beach',
    market: 'market',
    trek: 'trek',
    palace: 'palace',
    adventure: 'adventure',
    religious: 'temple',
    spiritual: 'temple',
    nature: 'park',
    wildlife: 'park',
    history: 'monument',
    heritage: 'monument',
    trekking: 'trek',
    shopping: 'market',
    food: 'market',
    entertainment: 'market',
  };

  let created = 0;
  let updated = 0;
  let skippedDeleted = 0;
  let skippedDup = 0;
  let skippedError = 0;

  for (const p of places) {
    const curatedId = String(p.id || '').trim();
    const stableSlug = curatedId ? toSlug(curatedId) : toSlug(p.name);
    const locKey = `${normName(p.name)}|${String(p.city || '').toLowerCase()}|${String(p.state || '').toLowerCase()}`;
    const externalId = curatedId ? `curated:${curatedId}` : null;

    if (
      deletedSlugs.has(stableSlug) ||
      (curatedId && deletedCuratedIds.has(curatedId)) ||
      deletedLoc.has(locKey)
    ) {
      skippedDeleted++;
      continue;
    }

    // Prefer matching existing place by externalId / slug / name+city+state (no duplicate)
    let target =
      (externalId && existingByExternal.get(externalId)) ||
      slugToPlace.get(stableSlug) ||
      existingByLoc.get(locKey) ||
      null;

    let slug = target?.slug || stableSlug;
    if (!target && usedSlugs.has(slug)) {
      // Collision with unrelated place — skip rather than invent -1 duplicates
      skippedDup++;
      continue;
    }

    const rawCat = String(p.category || '').toLowerCase().trim();
    const category = validCats[rawCat] || 'monument';
    const tags = [category, p.state?.toLowerCase().replace(/\s+/g, '-')].filter(Boolean);
    if (p.mustVisit) tags.push('must-visit');
    if (p.isHiddenGem) tags.push('hidden-gem');

    const shortDescription = p.description
      ? p.description.slice(0, 120) + (p.description.length > 120 ? '...' : '')
      : p.name;

    const hasAdminImages = !!(target?.images && target.images.length > 0);

    try {
      if (target) {
        await prisma.place.update({
          where: { id: target.id },
          data: {
            name: p.name,
            description: p.description || p.name,
            shortDescription,
            latitude: p.latitude,
            longitude: p.longitude,
            category,
            tags: [...new Set(tags)],
            city: p.city || 'India',
            state: p.state || 'India',
            country: p.country || 'India',
            rating: p.rating || 4.5,
            // Never overwrite admin-uploaded Cloudinary images
            ...(hasAdminImages
              ? {}
              : { thumbnail: p.imageUrl || target.thumbnail || null }),
            hiddenGemScore: p.isHiddenGem ? 5 : 0,
            popularityScore: p.mustVisit ? 50 : 30,
            verificationLevel: 2,
            status: 'APPROVED',
            source: 'CURATED',
            externalId: externalId || target.externalId,
            approvedById: admin.id,
            reviewedAt: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.place.create({
          data: {
            slug,
            name: p.name,
            description: p.description || p.name,
            shortDescription,
            latitude: p.latitude,
            longitude: p.longitude,
            category,
            tags: [...new Set(tags)],
            city: p.city || 'India',
            state: p.state || 'India',
            country: p.country || 'India',
            rating: p.rating || 4.5,
            thumbnail: p.imageUrl || null,
            images: [],
            hiddenGemScore: p.isHiddenGem ? 5 : 0,
            popularityScore: p.mustVisit ? 50 : 30,
            verificationLevel: 2,
            status: 'APPROVED',
            source: 'CURATED',
            externalId,
            submittedById: tourist.id,
            approvedById: admin.id,
            reviewedAt: new Date(),
          },
        });
        usedSlugs.add(slug);
        created++;
      }
    } catch (err: any) {
      console.error(`Error upserting ${p.id} (${p.name}): ${err.message}`);
      skippedError++;
    }
  }

  console.log(
    `\nDone. Created ${created}, updated ${updated}. ` +
      `Skipped deleted=${skippedDeleted}, dup=${skippedDup}, error=${skippedError}.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
