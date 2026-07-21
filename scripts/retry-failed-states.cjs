const https = require('https');
const fs = require('fs');
const path = require('path');

const FAILED = ['Meghalaya', 'West Bengal', 'Andaman and Nicobar'];

const TOURISM_TAGS = [
  'tourism=attraction', 'tourism=museum', 'tourism=viewpoint',
  'tourism=zoo', 'tourism=theme_park', 'tourism=gallery',
  'tourism=monument', 'tourism=aquarium', 'tourism=artwork',
  'tourism=hotel', 'tourism=guest_house', 'tourism=hostel',
  'tourism=information',
  'historic=monument', 'historic=castle', 'historic=fort',
  'historic=ruins', 'historic=archaeological_site', 'historic=memorial',
  'historic=temple', 'historic=church', 'historic=mosque',
  'leisure=park', 'leisure=garden', 'leisure=nature_reserve',
  'leisure=water_park', 'leisure=playground', 'leisure=sports_centre',
  'leisure=stadium', 'leisure=track',
  'natural=waterfall', 'natural=beach', 'natural=cave',
  'natural=peak', 'natural=valley', 'natural=bay',
  'natural=hot_spring', 'natural=geyser',
  'amenity=fountain', 'amenity=public_bath', 'amenity=restaurant',
  'amenity=fast_food', 'amenity=cafe', 'amenity=pub',
  'amenity=nightclub', 'amenity=theatre', 'amenity=cinema',
  'amenity=marketplace', 'amenity=library', 'amenity=place_of_worship',
  'shop=gift', 'shop=souvenir', 'shop=craft', 'shop=art',
  'waterway=waterfall',
  'man_made=lighthouse', 'man_made=observation_tower', 'man_made=pier',
  'landuse=religious',
];

function buildQuery(state, timeout = 300) {
  const tagFilters = TOURISM_TAGS.map(t => `nwr[${t}](area.IN);`).join('\n');
  return `[out:json][timeout:${timeout}];
area["name"="${state}"]["admin_level"=4]->.IN;
(
${tagFilters}
);
out center 2000;`;
}

const CATEGORY_MAP = {
  'museum': 'museum', 'viewpoint': 'viewpoint', 'zoo': 'wildlife',
  'theme_park': 'adventure', 'gallery': 'cultural', 'monument': 'monument',
  'aquarium': 'wildlife', 'artwork': 'cultural', 'fort': 'fort',
  'archaeological_site': 'heritage', 'ruins': 'heritage', 'memorial': 'monument',
  'park': 'park', 'garden': 'garden', 'nature_reserve': 'wildlife',
  'water_park': 'adventure', 'playground': 'park', 'sports_centre': 'adventure',
  'stadium': 'sports', 'track': 'sports', 'waterfall': 'waterfall',
  'beach': 'beach', 'cave': 'cave', 'peak': 'nature', 'valley': 'nature',
  'bay': 'nature', 'hot_spring': 'nature', 'geyser': 'nature',
  'fountain': 'cultural', 'public_bath': 'spiritual', 'restaurant': 'restaurant',
  'fast_food': 'restaurant', 'cafe': 'restaurant', 'pub': 'nightlife',
  'nightclub': 'nightlife', 'theatre': 'cultural', 'cinema': 'cultural',
  'marketplace': 'shopping', 'library': 'cultural', 'place_of_worship': 'temple',
  'hotel': 'hotel', 'guest_house': 'hotel', 'hostel': 'hotel',
  'information': 'heritage', 'lighthouse': 'heritage', 'observation_tower': 'viewpoint',
  'pier': 'adventure', 'castle': 'fort', 'temple': 'temple', 'church': 'temple',
  'mosque': 'temple', 'attraction': 'heritage', 'religious': 'temple',
  'gift': 'shopping', 'souvenir': 'shopping', 'craft': 'shopping', 'art': 'shopping',
};

function tagCategory(tags) {
  for (const val of [tags.tourism, tags.historic, tags.leisure, tags.natural, tags.waterway, tags.amenity, tags.man_made]) {
    if (val && CATEGORY_MAP[val]) return CATEGORY_MAP[val];
  }
  return 'heritage';
}

function fetchState(state, retries = 3) {
  const data = encodeURIComponent(buildQuery(state, 300));
  return new Promise((resolve) => {
    const tryFetch = (attempt) => {
      const req = https.get({
        hostname: 'overpass-api.de',
        path: `/api/interpreter?data=${data}`,
        headers: { 'User-Agent': 'PalSaSafar/2.0 (retry)', 'Accept': 'application/json' },
        timeout: 310000,
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.elements || []);
          } catch {
            if (attempt < retries) {
              setTimeout(() => tryFetch(attempt + 1), 10000);
            } else { resolve([]); }
          }
        });
      });
      req.on('error', () => {
        if (attempt < retries) setTimeout(() => tryFetch(attempt + 1), 10000);
        else resolve([]);
      });
      req.on('timeout', () => {
        req.destroy();
        if (attempt < retries) setTimeout(() => tryFetch(attempt + 1), 10000);
        else resolve([]);
      });
    };
    tryFetch(0);
  });
}

function toSpot(el, state) {
  if (!el.tags?.name) return null;
  let lat, lon;
  if (el.type === 'node') { lat = el.lat; lon = el.lon; }
  else if (el.center) { lat = el.center.lat; lon = el.center.lon; }
  else return null;
  if (lat < 6 || lat > 38 || lon < 68 || lon > 98) return null;
  const t = el.tags || {};
  const name = t.name.trim();
  if (!name || name.length < 2) return null;
  const generic = ['parking', 'entrance', 'exit', 'gate', 'road', 'street', 'area'];
  if (generic.includes(name.toLowerCase())) return null;
  return {
    id: `osm:${el.type}/${el.id}`,
    name,
    city: t.addr_city || t.town || t.village || t.city || state.split(' ').pop(),
    state,
    country: 'India',
    latitude: Math.round(lat * 10000) / 10000,
    longitude: Math.round(lon * 10000) / 10000,
    category: tagCategory(t),
    difficulty: 'easy',
    source: 'overpass',
    tags: [tagCategory(t), state.toLowerCase().replace(/\s+/g, '-')],
  };
}

async function main() {
  const OUTPUT_JSON = path.join(__dirname, '..', 'server', 'prisma', 'seed-data', 'osm-places-retry.json');
  let all = [];
  for (let i = 0; i < FAILED.length; i++) {
    process.stdout.write(`[${i+1}/${FAILED.length}] ${FAILED[i].padEnd(50)}`);
    const els = await fetchState(FAILED[i]);
    const spots = els.map(e => toSpot(e, FAILED[i])).filter(Boolean);
    all.push(...spots);
    console.log(`${spots.length} spots`);
    if (i < FAILED.length - 1) await new Promise(r => setTimeout(r, 5000));
  }
  console.log(`\nRetry complete: ${all.length} new spots`);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(all, null, 2));
  console.log(`Saved to ${OUTPUT_JSON}`);
}

main().catch(console.error);
