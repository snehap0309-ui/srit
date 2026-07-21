/**
 * All-India tourist spots from OpenStreetMap (Overpass API).
 * Tourism / heritage / nature only — no hotels, restaurants, shops, or nightlife.
 *
 * Run: node scripts/fetch-all-india-spots.cjs
 *
 * Output: server/prisma/seed-data/osm-places.json
 *         src/data/spots/osmSpots.ts
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

/** Genuine tourist / heritage / nature tags only (no lodging, food, or retail). */
const TOURISM_TAGS = [
  'tourism=attraction', 'tourism=museum', 'tourism=viewpoint',
  'tourism=zoo', 'tourism=theme_park', 'tourism=gallery',
  'tourism=monument', 'tourism=aquarium', 'tourism=artwork',
  'historic=monument', 'historic=castle', 'historic=fort',
  'historic=ruins', 'historic=archaeological_site', 'historic=memorial',
  'historic=temple', 'historic=church', 'historic=mosque',
  'historic=monastery', 'historic=shrine', 'historic=tomb',
  'historic=city_gate', 'historic=citywalls', 'historic=palace',
  'leisure=park', 'leisure=garden', 'leisure=nature_reserve',
  'natural=waterfall', 'natural=beach', 'natural=cave',
  'natural=peak', 'natural=hot_spring',
  'amenity=place_of_worship',
  'waterway=waterfall',
  'man_made=lighthouse', 'man_made=observation_tower',
  'building=temple', 'building=cathedral', 'building=mosque',
];

const SKIP_CATEGORIES = new Set([
  'restaurant', 'hotel', 'shopping', 'nightlife', 'cafe', 'shop',
]);

function buildQuery(state, timeout = 180) {
  const tagFilters = TOURISM_TAGS.map(t => `nwr[${t}](area.IN);`).join('\n');
  return `[out:json][timeout:${timeout}];
area["name"="${state}"]["admin_level"=4]->.IN;
(
${tagFilters}
);
out center 1500;`;
}

const CATEGORY_MAP = {
  museum: 'museum',
  viewpoint: 'adventure',
  zoo: 'wildlife',
  theme_park: 'adventure',
  gallery: 'monument',
  monument: 'monument',
  aquarium: 'wildlife',
  artwork: 'monument',
  fort: 'fort',
  castle: 'fort',
  archaeological_site: 'monument',
  ruins: 'monument',
  memorial: 'monument',
  park: 'park',
  garden: 'park',
  nature_reserve: 'wildlife',
  waterfall: 'waterfall',
  beach: 'beach',
  cave: 'monument',
  peak: 'trek',
  hot_spring: 'park',
  place_of_worship: 'temple',
  lighthouse: 'monument',
  observation_tower: 'adventure',
  temple: 'temple',
  church: 'church',
  mosque: 'mosque',
  monastery: 'temple',
  shrine: 'temple',
  tomb: 'monument',
  city_gate: 'monument',
  citywalls: 'fort',
  palace: 'palace',
  attraction: 'monument',
  cathedral: 'church',
};

function tagCategory(tags) {
  const tagSources = [
    tags.tourism, tags.historic, tags.leisure,
    tags.natural, tags.waterway, tags.amenity, tags.man_made, tags.building,
  ];
  for (const val of tagSources) {
    if (val && CATEGORY_MAP[val]) return CATEGORY_MAP[val];
  }
  if (tags.religion === 'hindu' || tags.religion === 'jain' || tags.religion === 'buddhist') return 'temple';
  if (tags.religion === 'muslim') return 'mosque';
  if (tags.religion === 'christian') return 'church';
  if (tags.religion === 'sikh') return 'gurudwara';
  return 'monument';
}

function fetchState(state, retries = 2) {
  const data = encodeURIComponent(buildQuery(state, 180));
  return new Promise((resolve) => {
    const tryFetch = (attempt) => {
      const req = https.get({
        hostname: 'overpass-api.de',
        path: `/api/interpreter?data=${data}`,
        headers: {
          'User-Agent': 'PalSafar/2.0 (tourism-places-build)',
          Accept: 'application/json',
        },
        timeout: 190000,
      }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.elements || []);
          } catch {
            if (attempt < retries) setTimeout(() => tryFetch(attempt + 1), 8000);
            else resolve([]);
          }
        });
      });
      req.on('error', () => {
        if (attempt < retries) setTimeout(() => tryFetch(attempt + 1), 8000);
        else resolve([]);
      });
      req.on('timeout', () => {
        req.destroy();
        if (attempt < retries) setTimeout(() => tryFetch(attempt + 1), 8000);
        else resolve([]);
      });
    };
    tryFetch(0);
  });
}

function toSpot(el, state) {
  if (!el.tags?.name) return null;
  let lat;
  let lon;
  if (el.type === 'node') { lat = el.lat; lon = el.lon; }
  else if (el.center) { lat = el.center.lat; lon = el.center.lon; }
  else return null;

  if (lat < 6 || lat > 38 || lon < 68 || lon > 98) return null;

  const t = el.tags || {};
  const category = tagCategory(t);
  if (SKIP_CATEGORIES.has(category)) return null;

  const name = t.name.trim();
  if (!name || name.length < 2) return null;

  const generic = ['parking', 'entrance', 'exit', 'gate', 'road', 'street', 'area', 'toilet', 'toilets'];
  if (generic.includes(name.toLowerCase())) return null;

  const descParts = [];
  if (t.description) descParts.push(t.description);
  if (t.wikidata) descParts.push(`wikidata:${t.wikidata}`);

  const spot = {
    id: `osm:${el.type}/${el.id}`,
    name,
    city: t['addr:city'] || t.addr_city || t.town || t.village || t.city || '',
    state,
    country: 'India',
    latitude: Math.round(lat * 10000) / 10000,
    longitude: Math.round(lon * 10000) / 10000,
    category,
    difficulty: 'easy',
    source: 'overpass',
    tags: [category, state.toLowerCase().replace(/\s+/g, '-')],
  };

  if (descParts.length) spot.shortDescription = descParts.join(' | ').substring(0, 200);
  if (t.image) spot.imageUrl = t.image;
  if (t.wikimedia_commons) spot.imageUrl = spot.imageUrl || `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(t.wikimedia_commons)}`;

  return spot;
}

async function main() {
  const OUTPUT_JSON = path.join(__dirname, '..', 'server', 'prisma', 'seed-data', 'osm-places.json');
  const OUTPUT_TS = path.join(__dirname, '..', 'src', 'data', 'spots', 'osmSpots.ts');
  const OUTPUT_DIR = path.dirname(OUTPUT_JSON);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const all = [];
  const failed = [];

  console.log('=== PalSafar all-India tourist OSM extraction ===\n');
  console.log(`States: ${STATES.length} | Tags: tourist/heritage/nature only\n`);

  for (let i = 0; i < STATES.length; i++) {
    process.stdout.write(`[${i + 1}/${STATES.length}] ${STATES[i].padEnd(48)}`);
    const els = await fetchState(STATES[i]);
    const spots = els.map(e => toSpot(e, STATES[i])).filter(Boolean);
    all.push(...spots);
    console.log(`${spots.length} spots`);
    if (spots.length === 0) failed.push(STATES[i]);

    if ((i + 1) % 5 === 0) {
      fs.writeFileSync(OUTPUT_JSON, JSON.stringify(all, null, 2));
      console.log(`  → checkpoint saved (${all.length} total)\n`);
    }

    // Be kind to Overpass
    await new Promise(r => setTimeout(r, 2500));
  }

  // Dedupe by name+state+rounded coords
  const seen = new Set();
  const unique = all.filter(p => {
    const key = `${p.name.toLowerCase()}|${p.state}|${p.latitude}|${p.longitude}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(unique, null, 2));

  const ts = `/** Auto-generated OSM tourist places — ${new Date().toISOString().slice(0, 10)} */\n` +
    `export const OSM_SPOTS = ${JSON.stringify(unique, null, 2)} as const;\n`;
  fs.mkdirSync(path.dirname(OUTPUT_TS), { recursive: true });
  fs.writeFileSync(OUTPUT_TS, ts);

  console.log(`\nDone. ${unique.length} unique tourist places → ${OUTPUT_JSON}`);
  if (failed.length) console.log('Empty/failed states:', failed.join(', '));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
