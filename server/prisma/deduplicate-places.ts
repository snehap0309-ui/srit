import { PrismaClient, PlaceStatus } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an|of|in|and|temple|fort|palace|lake|park|heritage|monument|museum|garden|waterfall|viewpoint|trekking|adventure|spiritual|cultural|hidden|gem|church|mosque|ghat|river|beach|nature|wildlife|shopping|restaurant|cafe|hotel|resort|street|food|point|view|old|new)\b/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface PlaceRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  status: PlaceStatus;
  description: string;
  images: string[];
  verificationLevel: number;
  source: string;
  createdAt: Date;
}

function scorePlace(p: PlaceRow): number {
  let score = 0;
  const statusRank: Record<string, number> = { APPROVED: 100, PENDING: 50, REJECTED: 0 };
  score += statusRank[p.status] || 0;
  score += p.verificationLevel * 10;
  score += p.description ? Math.min(p.description.length / 10, 30) : 0;
  score += Math.min((p.images?.length || 0) * 5, 20);
  score += p.latitude != null && p.longitude != null ? 15 : 0;
  return score;
}

function pickWinner(group: PlaceRow[]): { winner: PlaceRow; losers: PlaceRow[] } {
  const sorted = [...group].sort((a, b) => {
    const scoreDiff = scorePlace(b) - scorePlace(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return { winner: sorted[0], losers: sorted.slice(1) };
}

function sameLocation(a: PlaceRow, b: PlaceRow): boolean {
  return (a.city || '').toLowerCase() === (b.city || '').toLowerCase() &&
    (a.state || '').toLowerCase() === (b.state || '').toLowerCase();
}

function sharesCommonWord(nameA: string, nameB: string): boolean {
  const wordsA = nameA.toLowerCase().split(/\s+/);
  const wordsB = new Set(nameB.toLowerCase().split(/\s+/));
  for (const w of wordsA) {
    if (w.length > 2 && wordsB.has(w)) return true;
  }
  return false;
}

function isSubstringMatch(nameA: string, nameB: string): boolean {
  const a = nameA.toLowerCase();
  const b = nameB.toLowerCase();
  return a.includes(b) || b.includes(a);
}

function isDuplicatePair(a: PlaceRow, b: PlaceRow): boolean {
  // Strategy 1: Exact name + same city+state
  if (a.name.toLowerCase() === b.name.toLowerCase() && sameLocation(a, b)) {
    return true;
  }

  const aNorm = normalize(a.name);
  const bNorm = normalize(b.name);

  // Strategy 2: Normalized name match + same city+state
  if (aNorm.length > 0 && aNorm === bNorm && sameLocation(a, b)) {
    return true;
  }

  // Strategy 3: Close fuzzy match + same city+state + common word
  const dist = levenshtein(aNorm, bNorm);
  if (sameLocation(a, b) && dist <= 2 && sharesCommonWord(a.name, b.name)) {
    return true;
  }

  if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
    const geoDist = haversine(a.latitude, a.longitude, b.latitude, b.longitude);

    // Strategy 4: Very close coordinates + substring name match
    if (geoDist <= 50 && isSubstringMatch(a.name, b.name)) {
      return true;
    }

    // Strategy 5: Same coordinates + same normalized name
    if (geoDist <= 30 && aNorm === bNorm && aNorm.length > 0) {
      return true;
    }
  }

  return false;
}

async function deduplicate() {
  const mode = DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE';
  console.log(`=== PalSafar Place Deduplication [${mode}] ===\n`);

  const all = await prisma.place.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      status: true,
      description: true,
      images: true,
      verificationLevel: true,
      source: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  }) as unknown as PlaceRow[];

  console.log(`Total places: ${all.length}\n`);

  const used = new Set<string>();
  const groups: PlaceRow[][] = [];

  for (const a of all) {
    if (used.has(a.id)) continue;
    const group: PlaceRow[] = [a];
    used.add(a.id);

    for (const b of all) {
      if (used.has(b.id)) continue;
      if (isDuplicatePair(a, b)) {
        group.push(b);
        used.add(b.id);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  if (groups.length === 0) {
    console.log('No duplicates found.');
    return;
  }

  console.log(`Found ${groups.length} duplicate groups:\n`);

  let totalDeleted = 0;
  for (const group of groups) {
    const { winner, losers } = pickWinner(group);
    const loserIds = losers.map(l => l.id);

    console.log(`  [KEEP]  "${winner.name}" (${winner.city}, ${winner.state}) [${winner.source}]`);
    for (const l of losers) {
      console.log(`  [DEL]   "${l.name}" (${l.city}, ${l.state}) [${l.source}] — score=${scorePlace(l).toFixed(0)}`);
    }

    if (!DRY_RUN) {
      await prisma.place.deleteMany({ where: { id: { in: loserIds } } });
    }
    totalDeleted += loserIds.length;
  }

  console.log(`\n${DRY_RUN ? 'Would delete' : 'Deleted'} ${totalDeleted} duplicate places.`);
  console.log(`Remaining: ${await prisma.place.count()}`);

  const bySource = await prisma.$queryRawUnsafe<{ source: string; c: number }[]>(
    "SELECT source, COUNT(*)::int as c FROM places GROUP BY source ORDER BY source"
  );
  console.table(bySource);
}

deduplicate()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
