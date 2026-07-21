/**
 * Retry Overpass fetch for states that returned empty in the main run.
 * Merges into server/prisma/seed-data/osm-places.json
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Reuse logic by requiring the main script's approach inline (minimal duplicate)
const FAILED = [
  'Jharkhand', 'Meghalaya', 'Odisha', 'Tamil Nadu',
  'Uttar Pradesh', 'Chandigarh', 'Jammu and Kashmir', 'Puducherry',
];

// Alternate Overpass endpoints for retries
const ENDPOINTS = [
  'overpass-api.de',
  'lz4.overpass-api.de',
  'z.overpass-api.de',
];

const TOURISM_TAGS = [
  'tourism=attraction', 'tourism=museum', 'tourism=viewpoint',
  'tourism=zoo', 'tourism=monument', 'tourism=artwork',
  'historic=monument', 'historic=castle', 'historic=fort',
  'historic=ruins', 'historic=archaeological_site', 'historic=memorial',
  'historic=temple', 'historic=church', 'historic=mosque',
  'historic=monastery', 'historic=shrine', 'historic=tomb',
  'leisure=park', 'leisure=garden', 'leisure=nature_reserve',
  'natural=waterfall', 'natural=beach', 'natural=cave', 'natural=peak',
  'amenity=place_of_worship', 'waterway=waterfall',
  'building=temple', 'building=cathedral', 'building=mosque',
];

const CATEGORY_MAP = {
  museum: 'museum', viewpoint: 'adventure', zoo: 'wildlife', monument: 'monument',
  artwork: 'monument', fort: 'fort', castle: 'fort', archaeological_site: 'monument',
  ruins: 'monument', memorial: 'monument', park: 'park', garden: 'park',
  nature_reserve: 'wildlife', waterfall: 'waterfall', beach: 'beach', cave: 'monument',
  peak: 'trek', place_of_worship: 'temple', temple: 'temple', church: 'church',
  mosque: 'mosque', monastery: 'temple', shrine: 'temple', tomb: 'monument',
  attraction: 'monument', cathedral: 'church',
};

function buildQuery(state) {
  const tagFilters = TOURISM_TAGS.map(t => `nwr[${t}](area.IN);`).join('\n');
  return `[out:json][timeout:240];
area["name"="${state}"]["admin_level"=4]->.IN;
(
${tagFilters}
);
out center 1500;`;
}

function tagCategory(tags) {
  for (const key of ['tourism', 'historic', 'leisure', 'natural', 'waterway', 'amenity', 'building']) {
    if (tags[key] && CATEGORY_MAP[tags[key]]) return CATEGORY_MAP[tags[key]];
  }
  if (tags.religion === 'sikh') return 'gurudwara';
  if (tags.religion === 'muslim') return 'mosque';
  if (tags.religion === 'christian') return 'church';
  return 'temple';
}

function fetchState(state, host) {
  const data = encodeURIComponent(buildQuery(state));
  return new Promise((resolve) => {
    const req = https.get({
      hostname: host,
      path: `/api/interpreter?data=${data}`,
      headers: { 'User-Agent': 'PalSafar/2.0 (retry)', Accept: 'application/json' },
      timeout: 250000,
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body).elements || []); }
        catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

function toSpot(el, state) {
  if (!el.tags?.name) return null;
  let lat, lon;
  if (el.type === 'node') { lat = el.lat; lon = el.lon; }
  else if (el.center) { lat = el.center.lat; lon = el.center.lon; }
  else return null;
  if (lat < 6 || lat > 38 || lon < 68 || lon > 98) return null;
  const name = el.tags.name.trim();
  if (name.length < 2) return null;
  const category = tagCategory(el.tags);
  return {
    id: `osm:${el.type}/${el.id}`,
    name,
    city: el.tags['addr:city'] || el.tags.town || el.tags.village || '',
    state,
    country: 'India',
    latitude: Math.round(lat * 10000) / 10000,
    longitude: Math.round(lon * 10000) / 10000,
    category,
    source: 'overpass',
    tags: [category, state.toLowerCase().replace(/\s+/g, '-')],
  };
}

async function main() {
  const outPath = path.join(__dirname, '..', 'server', 'prisma', 'seed-data', 'osm-places.json');
  const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : [];
  const seen = new Set(existing.map(p => `${p.name.toLowerCase()}|${p.state}|${p.latitude}|${p.longitude}`));
  let added = 0;

  for (const state of FAILED) {
    let spots = [];
    for (const host of ENDPOINTS) {
      process.stdout.write(`Retry ${state} via ${host}... `);
      const els = await fetchState(state, host);
      spots = els.map(e => toSpot(e, state)).filter(Boolean);
      console.log(`${spots.length} spots`);
      if (spots.length > 0) break;
      await new Promise(r => setTimeout(r, 3000));
    }
    for (const p of spots) {
      const key = `${p.name.toLowerCase()}|${p.state}|${p.latitude}|${p.longitude}`;
      if (seen.has(key)) continue;
      seen.add(key);
      existing.push(p);
      added++;
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
  console.log(`Merged +${added}. Total unique: ${existing.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
