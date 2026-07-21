/**
 * Fetch genuine India places from Wikidata in small type batches (avoids query timeouts).
 * Output: server/prisma/seed-data/places-wikidata.json
 *
 * Run: node scripts/fetch-wikidata-places.cjs
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const TYPE_BATCHES = [
  // Tourist attraction, monument, archaeological site
  ['wd:Q570116', 'wd:Q1497444', 'wd:Q839954'],
  // Fort/castle, palace
  ['wd:Q23413', 'wd:Q16560'],
  // Museum, garden
  ['wd:Q33506', 'wd:Q1107656'],
  // Hindu temple, church, mosque, gurdwara
  ['wd:Q849706', 'wd:Q16970', 'wd:Q32815', 'wd:Q337986'],
  // National park, wildlife sanctuary, cave
  ['wd:Q46446', 'wd:Q1128213', 'wd:Q35509'],
  // Beach, waterfall, lake, hill station
  ['wd:Q40080', 'wd:Q34486', 'wd:Q23397', 'wd:Q299832'],
];

function buildQuery(types) {
  return `
SELECT DISTINCT ?place ?placeLabel ?desc ?coord ?image ?article WHERE {
  VALUES ?type { ${types.join(' ')} }
  ?place wdt:P31/wdt:P279* ?type.
  ?place wdt:P17 wd:Q668.
  ?place wdt:P625 ?coord.
  OPTIONAL { ?place wdt:P18 ?image. }
  OPTIONAL {
    ?article schema:about ?place.
    ?article schema:isPartOf <https://en.wikipedia.org/>.
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
    ?place rdfs:label ?placeLabel.
    ?place schema:description ?desc
  }
}
LIMIT 2500
`;
}

function queryWikidata(sparql) {
  return new Promise((resolve, reject) => {
    const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql) + '&format=json';
    const req = https.get(url, {
      headers: {
        'User-Agent': 'PalSafar-Bot/1.1 (Contact: admin@palsafar.com)',
        Accept: 'application/sparql-results+json',
      },
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.results?.bindings || []);
        } catch (e) {
          reject(new Error(`Wikidata parse failed: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Wikidata request timed out'));
    });
  });
}

function parseCoord(pointStr) {
  const match = String(pointStr || '').match(/Point\(([-\d.]+) ([-\d.]+)\)/);
  if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return { lat: 0, lng: 0 };
}

function categorize(title, desc) {
  const t = `${title} ${desc || ''}`.toLowerCase();
  if (t.includes('temple') || t.includes('mandir') || t.includes('mosque') || t.includes('church') || t.includes('gurdwara') || t.includes('gurudwara')) return 'spiritual';
  if (t.includes('fort') || t.includes('qila') || t.includes('palace') || t.includes('mahal')) return 'fort';
  if (t.includes('museum') || t.includes('gallery')) return 'museum';
  if (t.includes('monument') || t.includes('memorial') || t.includes('tomb')) return 'monument';
  if (t.includes('park') || t.includes('garden')) return 'park';
  if (t.includes('sanctuary') || t.includes('tiger') || t.includes('wildlife') || t.includes('zoo')) return 'wildlife';
  if (t.includes('waterfall')) return 'waterfall';
  if (t.includes('beach')) return 'beach';
  if (t.includes('lake') || t.includes('cave') || t.includes('hill')) return 'nature';
  return 'heritage';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const byId = new Map();

  for (let i = 0; i < TYPE_BATCHES.length; i++) {
    const types = TYPE_BATCHES[i];
    process.stdout.write(`[${i + 1}/${TYPE_BATCHES.length}] types ${types.length}… `);
    try {
      const bindings = await queryWikidata(buildQuery(types));
      let added = 0;
      for (const b of bindings) {
        if (!b.placeLabel || String(b.placeLabel.value).startsWith('Q')) continue;
        const { lat, lng } = parseCoord(b.coord?.value);
        if (!lat && !lng) continue;
        if (lat < 6 || lat > 38 || lng < 68 || lng > 98) continue;
        const id = b.place.value.split('/').pop();
        if (byId.has(id)) continue;
        byId.set(id, {
          id,
          name: b.placeLabel.value,
          shortDesc: b.desc ? b.desc.value : '',
          latitude: lat,
          longitude: lng,
          imageUrl: b.image ? b.image.value : null,
          articleTitle: b.article?.value
            ? decodeURIComponent(b.article.value.split('/wiki/')[1] || '').replace(/_/g, ' ')
            : null,
        });
        added++;
      }
      console.log(`+${added} (unique ${byId.size})`);
    } catch (err) {
      console.log(`failed: ${err.message}`);
    }
    await sleep(1500);
  }

  const finalPlaces = [];
  for (const p of byId.values()) {
    const category = categorize(p.name, p.shortDesc);
    finalPlaces.push({
      id: p.id,
      name: p.name,
      category,
      description: p.shortDesc || `${p.name} is a notable place in India.`,
      latitude: p.latitude,
      longitude: p.longitude,
      imageUrl: p.imageUrl,
      city: '',
      state: '',
      country: 'India',
      rating: 4.2,
      bestTimeFrom: '09:00 AM',
      bestTimeTo: '06:00 PM',
      bestTimeReason: 'Favorable weather and full access to the site.',
      mustVisit: false,
      isHiddenGem: false,
    });
  }

  const outDir = path.join(__dirname, '..', 'server', 'prisma', 'seed-data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'places-wikidata.json');
  fs.writeFileSync(outPath, JSON.stringify(finalPlaces, null, 2));
  console.log(`\nSaved ${finalPlaces.length} genuine Wikidata places → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
