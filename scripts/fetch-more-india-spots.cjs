/**
 * Fetch additional Indian tourism spots using broader/extra OSM tags
 * to supplement the existing ~40K dataset.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya',
  'Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim',
  'Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
  'West Bengal','Andaman and Nicobar','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi',
  'Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

// Additional tags not covered in the first pass
const EXTRA_TAGS = [
  'tourism=yes', 'tourism=caravan_site', 'tourism=camp_site', 'tourism=chalet',
  'tourism=motel', 'tourism=picnic_site', 'tourism=wilderness_hut',
  'tourism=apartment', 'tourism=resort',
  'historic=yes', 'historic=city_gate', 'historic=citywalls',
  'historic=farm', 'historic=fortifications', 'historic=manor',
  'historic=monastery', 'historic=shrine', 'historic=tomb', 'historic=tower',
  'historic=wayside_cross', 'historic=wayside_shrine', 'historic=well',
  'leisure=yes', 'leisure=adventure', 'leisure=amusement_arcade',
  'leisure=bird_hide', 'leisure=bowling_alley', 'leisure=common',
  'leisure=disc_golf', 'leisure=dog_park', 'leisure=escape_game',
  'leisure=fishing', 'leisure=fitness_centre', 'leisure=fitness_station',
  'leisure=forest', 'leisure=golf_course', 'leisure=hackerspace',
  'leisure=horse_riding', 'leisure=ice_rink', 'leisure=marina',
  'leisure=miniature_golf', 'leisure=outdoor_seating',
  'leisure=picnic_table', 'leisure=pitch', 'leisure=resort',
  'leisure=sauna', 'leisure=slipway', 'leisure=swimming_area',
  'lewisure=swimming_pool', 'leisure=table_tennis',
  'natural=yes', 'natural=arch', 'natural=blowhole', 'natural=cape',
  'natural=cliff', 'natural=coastline', 'natural=coral_reef',
  'natural=dune', 'natural=fell', 'natural=geological',
  'natural=glacier', 'natural=grassland', 'natural=gully',
  'natural=heath', 'natural=hill', 'natural=island', 'natural=isthmus',
  'natural=land', 'natural=mound', 'natural=mud',
  'natural=peninsula', 'natural=reef', 'natural=ridge',
  'natural=rock', 'natural=sand', 'natural=scree', 'natural=sinkhole',
  'natural=spring', 'natural=stone', 'natural=strait',
  'natural=tree', 'natural=tree_row', 'natural=volcano',
  'amenity=arts_centre', 'amenity=bench', 'amenity=bbq',
  'amenity=clock', 'amenity=community_centre', 'amenity=conference_centre',
  'amenity=drinking_water', 'amenity=events_venue',
  'amenity=food_court', 'amenity=gambling', 'amenity=ice_cream',
  'amenity=internet_cafe', 'amenity=lounger', 'amenity=parking',
  'amenity=photo_booth', 'amenity=picnic_table',
  'amenity=public_bookcase', 'amenity=shower', 'amenity=social_centre',
  'amenity=stripclub', 'amenity=swingerclub', 'amenity=taxi',
  'amenity=toilets', 'amenity=watering_place', 'amenity=water_point',
  'shop=yes', 'shop=antiques', 'shop=books', 'shop=brewing_supplies',
  'shop=cheese', 'shop=chocolate', 'shop=coffee', 'shop=confectionery',
  'shop=convenience', 'shop=department_store', 'shop=electronics',
  'shop=fabric', 'shop=florist', 'shop=food', 'shop=gift',
  'shop=greengrocer', 'shop=health_food', 'shop=jewelry',
  'shop=kitchen', 'shop=mall', 'shop=music', 'shop=organic',
  'shop=outdoor', 'shop=perfumery', 'shop=photo', 'shop=second_hand',
  'shop=shoes', 'shop=souvenir', 'shop=sports', 'shop=tea',
  'shop=ticket', 'shop=toys', 'shop=travel_agency', 'shop=wine',
  'building=cathedral', 'building=chapel', 'building=church',
  'building=mosque', 'building=shrine', 'building=stadium',
  'building=temple', 'building=yes',
  'railway=station', 'railway=halt', 'railway=historic_station',
  'aeroway=aerodrome', 'aeroway=terminal',
  'waterway=dam', 'waterway=canal', 'waterway=river',
  'man_made=bell_tower', 'man_made=bridge', 'man_made=cairn',
  'man_made=chimney', 'man_made=cross', 'man_made=flagpole',
  'man_made=gazebo', 'man_made=monitoring_station', 'man_made=obelisk',
  'man_made=observatory', 'man_made=petroleum_well',
  'man_made=planetary_garden', 'man_made=reservoir',
  'man_made=silo', 'man_made=statue', 'man_made=stele',
  'man_made=storage_tank', 'man_made=survey_point', 'man_made=telescope',
  'man_made=utility_pole', 'man_made=water_tap', 'man_made=water_tower',
  'man_made=water_well', 'man_made=watermill', 'man_made=windmill',
  'man_made=works',
];

function buildQuery(state, tags, timeout = 300) {
  const tagFilters = tags.map(t => `nwr[${t}](area.IN);`).join('\n');
  return `[out:json][timeout:${timeout}];
area["name"="${state}"]["admin_level"=4]->.IN;
(
${tagFilters}
);
out center 2000;`;
}

const CATEGORY_MAP = {
  'yes': 'heritage', 'caravan_site': 'adventure', 'camp_site': 'adventure',
  'chalet': 'hotel', 'motel': 'hotel', 'picnic_site': 'park',
  'wilderness_hut': 'adventure', 'apartment': 'hotel', 'resort': 'hotel',
  'city_gate': 'monument', 'citywalls': 'fort', 'farm': 'heritage',
  'fortifications': 'fort', 'manor': 'palace', 'monastery': 'spiritual',
  'shrine': 'temple', 'tomb': 'monument', 'tower': 'monument',
  'wayside_cross': 'spiritual', 'wayside_shrine': 'spiritual', 'well': 'heritage',
  'adventure': 'adventure', 'amusement_arcade': 'adventure',
  'bird_hide': 'wildlife', 'bowling_alley': 'adventure',
  'common': 'park', 'dog_park': 'park', 'escape_game': 'adventure',
  'fishing': 'adventure', 'fitness_centre': 'adventure',
  'fitness_station': 'adventure', 'forest': 'wildlife',
  'golf_course': 'adventure', 'horse_riding': 'adventure',
  'ice_rink': 'adventure', 'marina': 'adventure',
  'miniature_golf': 'adventure', 'outdoor_seating': 'restaurant',
  'picnic_table': 'park', 'pitch': 'sports', 'resort': 'hotel',
  'sauna': 'adventure', 'slipway': 'adventure', 'swimming_area': 'beach',
  'swimming_pool': 'adventure', 'table_tennis': 'adventure',
  'arch': 'nature', 'blowhole': 'nature', 'cape': 'nature',
  'cliff': 'nature', 'coastline': 'beach', 'coral_reef': 'beach',
  'dune': 'nature', 'fell': 'nature', 'geological': 'nature',
  'glacier': 'nature', 'grassland': 'park', 'gully': 'nature',
  'heath': 'nature', 'hill': 'nature', 'island': 'beach',
  'isthmus': 'nature', 'land': 'nature', 'mound': 'nature',
  'mud': 'nature', 'peninsula': 'nature', 'reef': 'beach',
  'ridge': 'nature', 'rock': 'nature', 'sand': 'beach',
  'scree': 'nature', 'sinkhole': 'nature', 'spring': 'nature',
  'stone': 'nature', 'strait': 'nature', 'tree': 'park',
  'tree_row': 'park', 'volcano': 'nature',
  'arts_centre': 'cultural', 'bench': 'park', 'bbq': 'park',
  'clock': 'monument', 'community_centre': 'cultural',
  'conference_centre': 'cultural', 'drinking_water': 'park',
  'events_venue': 'cultural', 'food_court': 'restaurant',
  'gambling': 'nightlife', 'ice_cream': 'restaurant',
  'internet_cafe': 'cultural', 'parking': 'other',
  'photo_booth': 'cultural', 'public_bookcase': 'cultural',
  'shower': 'other', 'social_centre': 'cultural',
  'stripclub': 'nightlife', 'taxi': 'other',
  'toilets': 'other', 'watering_place': 'other',
  'antiques': 'shopping', 'books': 'shopping',
  'brewing_supplies': 'shopping', 'cheese': 'shopping',
  'chocolate': 'shopping', 'coffee': 'shopping',
  'confectionery': 'shopping', 'convenience': 'shopping',
  'department_store': 'shopping', 'electronics': 'shopping',
  'fabric': 'shopping', 'florist': 'shopping', 'food': 'shopping',
  'greengrocer': 'shopping', 'health_food': 'shopping',
  'jewelry': 'shopping', 'kitchen': 'shopping', 'mall': 'shopping',
  'music': 'shopping', 'organic': 'shopping', 'outdoor': 'shopping',
  'perfumery': 'shopping', 'photo': 'shopping', 'second_hand': 'shopping',
  'shoes': 'shopping', 'sports': 'shopping', 'tea': 'shopping',
  'ticket': 'shopping', 'toys': 'shopping', 'travel_agency': 'shopping',
  'wine': 'shopping', 'cathedral': 'temple', 'chapel': 'temple',
  'station': 'other', 'halt': 'other', 'historic_station': 'heritage',
  'aerodrome': 'other', 'terminal': 'other',
  'dam': 'waterfall', 'canal': 'lake', 'river': 'lake',
  'bell_tower': 'monument', 'bridge': 'monument', 'cairn': 'monument',
  'chimney': 'monument', 'cross': 'monument', 'flagpole': 'monument',
  'gazebo': 'park', 'monitoring_station': 'other',
  'obelisk': 'monument', 'observatory': 'museum',
  'petroleum_well': 'other', 'planetary_garden': 'park',
  'reservoir': 'lake', 'silo': 'other', 'statue': 'monument',
  'stele': 'monument', 'storage_tank': 'other',
  'survey_point': 'other', 'telescope': 'museum',
  'utility_pole': 'other', 'water_tap': 'other',
  'water_tower': 'monument', 'water_well': 'other',
  'watermill': 'heritage', 'windmill': 'heritage', 'works': 'other',
};

function tagCategory(tags) {
  const sources = ['tourism', 'historic', 'leisure', 'natural', 'amenity', 'shop', 'building', 'railway', 'aeroway', 'waterway', 'man_made'];
  for (const src of sources) {
    const val = tags[src];
    if (val && CATEGORY_MAP[val]) return CATEGORY_MAP[val];
  }
  return 'heritage';
}

function fetchState(state, tags, retries = 3) {
  const data = encodeURIComponent(buildQuery(state, tags, 300));
  return new Promise((resolve) => {
    const tryFetch = (attempt) => {
      const req = https.get({
        hostname: 'overpass-api.de',
        path: `/api/interpreter?data=${data}`,
        headers: { 'User-Agent': 'PalSaSafar/3.0 (extra)', 'Accept': 'application/json' },
        timeout: 310000,
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.elements || []);
          } catch {
            if (attempt < retries) setTimeout(() => tryFetch(attempt + 1), 10000);
            else resolve([]);
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
  const category = tagCategory(t);
  return {
    id: `osm:${el.type}/${el.id}`,
    name,
    city: t.addr_city || t.town || t.village || t.city || state.split(' ').pop(),
    state,
    country: 'India',
    latitude: Math.round(lat * 10000) / 10000,
    longitude: Math.round(lon * 10000) / 10000,
    category,
    difficulty: 'easy',
    source: 'overpass',
    tags: [category, state.toLowerCase().replace(/\s+/g, '-')],
  };
}

async function main() {
  const OUTPUT_JSON = path.join(__dirname, '..', 'server', 'prisma', 'seed-data', 'osm-places-extra.json');

  // Split extra tags into batches of 20 to avoid overloading Overpass
  let allSpots = [];
  for (let s = 0; s < STATES.length; s++) {
    process.stdout.write(`[${s+1}/${STATES.length}] ${STATES[s].padEnd(50)}`);
    let stateSpots = [];
    for (let t = 0; t < EXTRA_TAGS.length; t += 20) {
      const tagBatch = EXTRA_TAGS.slice(t, t + 20);
      const els = await fetchState(STATES[s], tagBatch);
      const spots = els.map(e => toSpot(e, STATES[s])).filter(Boolean);
      stateSpots.push(...spots);
    }
    // Deduplicate within state
    const seen = new Set();
    const unique = stateSpots.filter(p => {
      const key = `${p.name.toLowerCase()}|${p.latitude}|${p.longitude}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    allSpots.push(...unique);
    console.log(`${unique.length} extra spots (total: ${allSpots.length})`);
    if (s < STATES.length - 1) await new Promise(r => setTimeout(r, 3000));
  }

  // Final dedup across all states
  const seen = new Set();
  const unique = allSpots.filter(p => {
    const key = `${p.name.toLowerCase()}|${p.state}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n=== Complete ===`);
  console.log(`Total extra spots: ${unique.length}`);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(unique, null, 2));
  console.log(`Saved to ${OUTPUT_JSON}`);
}

main().catch(console.error);
