/**
 * Remove duplicate places from the database (SQL-assisted).
 * Keeps highest-quality row per group; reassigns trip/collection refs before delete.
 *
 * Usage:
 *   node server/scripts/remove-place-duplicates.cjs --dry-run
 *   node server/scripts/remove-place-duplicates.cjs
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

const SOURCE_RANK = {
  CURATED: 500,
  WIKIMEDIA: 200,
  ADMIN: 180,
  HIDDEN_GEM: 150,
  VENDOR: 100,
  OSM: 50,
};

function score(p) {
  let s = SOURCE_RANK[p.source] || 0;
  s += (p.verificationLevel || 0) * 10;
  s += Math.min(String(p.description || '').length / 10, 40);
  s += Math.min((p.images?.length || 0) * 8, 40);
  if (p.thumbnail) s += 10;
  if (p.hiddenGemScore && p.hiddenGemScore > 0) s += 5;
  if (p.popularityScore && p.popularityScore > 0) s += 5;
  if (p.rating && p.rating > 0) s += Math.min(p.rating * 4, 20);
  if (p.status === 'APPROVED') s += 20;
  if (p.status === 'REJECTED') s -= 50;
  return s;
}

function pickWinner(group) {
  return [...group].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return new Date(a.createdAt) - new Date(b.createdAt);
  })[0];
}

function normName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function reassignReferences(loserToWinner) {
  if (DRY || loserToWinner.size === 0) return;
  for (const [loserId, winnerId] of loserToWinner.entries()) {
    const stops = await prisma.tripPlanStop.findMany({ where: { placeId: loserId } });
    for (const stop of stops) {
      const clash = await prisma.tripPlanStop.findFirst({
        where: { tripPlanDayId: stop.tripPlanDayId, placeId: winnerId },
      });
      if (clash) {
        await prisma.tripPlanStop.delete({ where: { id: stop.id } });
      } else {
        await prisma.tripPlanStop.update({ where: { id: stop.id }, data: { placeId: winnerId } });
      }
    }

    const collections = await prisma.collectionPlace.findMany({ where: { placeId: loserId } });
    for (const row of collections) {
      const clash = await prisma.collectionPlace.findFirst({
        where: { collectionId: row.collectionId, placeId: winnerId },
      });
      if (clash) {
        await prisma.collectionPlace.delete({ where: { id: row.id } });
      } else {
        await prisma.collectionPlace.update({ where: { id: row.id }, data: { placeId: winnerId } });
      }
    }
  }
}

async function deleteLosers(loserIds, label) {
  if (!loserIds.length) return 0;
  if (DRY) {
    console.log(`[dry-run] ${label}: would delete ${loserIds.length}`);
    return loserIds.length;
  }
  const chunk = 200;
  let deleted = 0;
  for (let i = 0; i < loserIds.length; i += chunk) {
    const ids = loserIds.slice(i, i + chunk);
    await prisma.$transaction([
      prisma.placeStat.deleteMany({ where: { placeId: { in: ids } } }),
      prisma.checkIn.deleteMany({ where: { placeId: { in: ids } } }),
      prisma.review.deleteMany({ where: { placeId: { in: ids } } }),
      prisma.placeImage.deleteMany({ where: { placeId: { in: ids } } }),
      prisma.placeVideo.deleteMany({ where: { placeId: { in: ids } } }),
      prisma.placeOffer.deleteMany({ where: { placeId: { in: ids } } }),
      prisma.placeEvent.deleteMany({ where: { placeId: { in: ids } } }),
      prisma.reel.updateMany({ where: { placeId: { in: ids } }, data: { placeId: null } }),
      prisma.auditLog.updateMany({ where: { placeId: { in: ids } }, data: { placeId: null } }),
      prisma.place.deleteMany({ where: { id: { in: ids } } }),
    ]);
    deleted += ids.length;
    process.stdout.write(`\r  deleted ${deleted}/${loserIds.length} (${label})`);
  }
  console.log('');
  return deleted;
}

async function loadGroupMembers(ids) {
  return prisma.place.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      source: true,
      status: true,
      description: true,
      images: true,
      thumbnail: true,
      verificationLevel: true,
      hiddenGemScore: true,
      popularityScore: true,
      rating: true,
      createdAt: true,
    },
  });
}

async function processSqlGroups(sql, label, loserToWinnerGlobal) {
  const groups = await prisma.$queryRawUnsafe(sql);
  const allLoserIds = [];
  const localMap = new Map();

  for (const g of groups) {
    const ids = g.ids;
    if (!ids || ids.length < 2) continue;
    const members = await loadGroupMembers(ids);
    if (members.length < 2) continue;
    const winner = pickWinner(members);
    for (const m of members) {
      if (m.id === winner.id) continue;
      if (loserToWinnerGlobal.has(m.id)) continue;
      localMap.set(m.id, winner.id);
      loserToWinnerGlobal.set(m.id, winner.id);
      allLoserIds.push(m.id);
    }
  }

  await reassignReferences(localMap);
  const unique = [...new Set(allLoserIds)];
  const removed = await deleteLosers(unique, label);
  console.log(`${label}: groups=${groups.length}, removed=${removed}`);
  return removed;
}

function dedupeCuratedJson(filePath, dryRun) {
  const fs = require('fs');
  const curatedJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const groups = [];
  for (const p of curatedJson) {
    if (p.latitude == null || p.longitude == null) continue;
    const key = normName(p.name);
    const match = groups.find(
      (g) => g.key === key
        && Math.abs(g.lat - p.latitude) < 0.003
        && Math.abs(g.lng - p.longitude) < 0.003,
    );
    if (match) {
      match.items.push(p);
    } else {
      groups.push({ key, lat: p.latitude, lng: p.longitude, items: [p] });
    }
  }

  const dropIds = new Set();
  for (const g of groups) {
    if (g.items.length < 2) continue;
    const sorted = [...g.items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    for (const loser of sorted.slice(1)) dropIds.add(loser.id);
  }

  const clean = curatedJson.filter((p) => !dropIds.has(p.id));
  const jsonRemoved = curatedJson.length - clean.length;
  if (jsonRemoved && !dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(clean, null, 2), 'utf8');
  }
  return { jsonRemoved, count: clean.length };
}

async function main() {
  const before = await prisma.place.count();
  console.log(`Places before: ${before} ${DRY ? '(DRY RUN)' : '(LIVE)'}`);

  const loserToWinner = new Map();
  let removed = 0;

  removed += await processSqlGroups(
    `
    SELECT array_agg(id) AS ids, COUNT(*)::int AS cnt
    FROM places
    WHERE trim(city) <> ''
    GROUP BY lower(trim(name)), lower(trim(city)), lower(trim(state))
    HAVING COUNT(*) > 1
    `,
    'exact-name-city-state',
    loserToWinner,
  );

  removed += await processSqlGroups(
    `
    SELECT array_agg(id) AS ids, COUNT(*)::int AS cnt
    FROM places
    WHERE trim(city) <> ''
    GROUP BY regexp_replace(lower(trim(name)), '[^a-z0-9]+', ' ', 'g'), lower(trim(city)), lower(trim(state))
    HAVING COUNT(*) > 1
    `,
    'normalized-name-city-state',
    loserToWinner,
  );

  removed += await processSqlGroups(
    `
    SELECT array_agg(id) AS ids, COUNT(*)::int AS cnt
    FROM places
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    GROUP BY regexp_replace(lower(trim(name)), '[^a-z0-9]+', ' ', 'g'),
             round(latitude::numeric, 3),
             round(longitude::numeric, 3)
    HAVING COUNT(*) > 1
    `,
    'normalized-name-coord-grid',
    loserToWinner,
  );

  removed += await processSqlGroups(
    `
    SELECT array_agg(id) AS ids, COUNT(*)::int AS cnt
    FROM places
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    GROUP BY lower(trim(name)),
             round(latitude::numeric, 3),
             round(longitude::numeric, 3)
    HAVING COUNT(*) > 1
    `,
    'exact-name-coord-grid',
    loserToWinner,
  );

  const after = await prisma.place.count();
  console.log(
    JSON.stringify({ before, after, removed: before - after, dryRun: DRY, reportedRemoved: removed }, null, 2),
  );

  const path = require('path');
  const file = path.join(__dirname, '../prisma/seed-data/places-curated.json');
  const { jsonRemoved, count } = dedupeCuratedJson(file, DRY);
  console.log(`curated.json dups removed: ${jsonRemoved} (now ${count})`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
