const https = require('https');
const fs = require('fs');
const path = require('path');

const STATES = ['Andaman and Nicobar'];

const TOURISM_TAGS = [
  'tourism=attraction', 'tourism=museum', 'tourism=viewpoint',
  'tourism=zoo', 'tourism=theme_park', 'tourism=gallery',
  'tourism=monument', 'historic=monument', 'historic=fort',
  'historic=ruins', 'historic=archaeological_site', 'historic=memorial',
  'historic=temple', 'leisure=nature_reserve', 'natural=waterfall',
  'natural=beach', 'natural=cave'
];

function buildQuery(state) {
  const tagFilters = TOURISM_TAGS.map(t => {
    const [k, v] = t.split('=');
    return `nwr["${k}"="${v}"](6.75, 92.12, 13.61, 93.82);`;
  }).join('\n');
  return `[out:json][timeout:180];
(
${tagFilters}
);
out center;`;
}

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({ data: query }).toString();
    const options = {
      hostname: 'overpass-api.de',
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'PalSafar/1.0 (contact@palsafar.com)'
      },
    };
    const req = https.request(options, (res) => {
      let result = '';
      res.on('data', (chunk) => { result += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(result)); }
        catch (e) { resolve({ elements: [] }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  let allPlaces = [];
  for (const state of STATES) {
    console.log(`Fetching ${state}...`);
    try {
      const q = buildQuery(state);
      const res = await fetchOverpass(q);
      const elements = res.elements || [];
      console.log(`Fetched ${elements.length} spots for ${state}`);
      for (const el of elements) {
        if (!el.tags || !el.tags.name) continue;
        
        let category = el.tags.tourism || el.tags.historic || el.tags.leisure || el.tags.natural || 'other';
        let categoryMapped = category.includes('=') ? category.split('=')[1] : category;

        allPlaces.push({
          name: el.tags.name,
          city: el.tags['addr:city'] || '',
          state: state,
          latitude: el.lat || el.center?.lat || 0,
          longitude: el.lon || el.center?.lon || 0,
          category: categoryMapped,
          description: el.tags.description || '',
          tags: [categoryMapped, 'tourist_attraction'].filter(Boolean)
        });
      }
    } catch (e) {
      console.log(`Failed for ${state}: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(__dirname, '../server/prisma/seed-data/osm-places.json'), JSON.stringify(allPlaces, null, 2));
  console.log(`Total saved: ${allPlaces.length}`);
}

main();
