const https = require('https');
const fs = require('fs');

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
];

// Determine category based on title keywords
function categorize(title) {
  const t = title.toLowerCase();
  if (t.includes('temple') || t.includes('mandir') || t.includes('mosque') || t.includes('church') || t.includes('gurudwara') || t.includes('matha') || t.includes('dargah')) return 'spiritual';
  if (t.includes('fort') || t.includes('qila') || t.includes('palace') || t.includes('mahal') || t.includes('haveli')) return 'fort';
  if (t.includes('museum') || t.includes('gallery')) return 'museum';
  if (t.includes('monument') || t.includes('minar') || t.includes('tomb') || t.includes('memorial')) return 'monument';
  if (t.includes('park') || t.includes('garden') || t.includes('bagh') || t.includes('botanical')) return 'park';
  if (t.includes('lake') || t.includes('river') || t.includes('sarovar') || t.includes('waterfall') || t.includes('beach') || t.includes('island') || t.includes('ghat')) return 'nature';
  if (t.includes('sanctuary') || t.includes('national park') || t.includes('zoo') || t.includes('wildlife') || t.includes('tiger reserve')) return 'wildlife';
  if (t.includes('cave') || t.includes('caves')) return 'cave';
  if (t.includes('ruin') || t.includes('archaeological') || t.includes('stupa')) return 'heritage';
  if (t.includes('hill') || t.includes('peak') || t.includes('valley')) return 'nature';
  if (t.includes('mall') || t.includes('market') || t.includes('bazaar')) return 'shopping';
  return 'heritage'; // Default fallback
}

// Generate timings based on category
function getTimings(category) {
  switch (category) {
    case 'spiritual': return { from: '06:00 AM', to: '08:00 PM' }; // Split timings are hard in simple from/to, so keep it broad
    case 'museum': 
    case 'monument': 
    case 'fort':
    case 'heritage': return { from: '09:00 AM', to: '05:30 PM' };
    case 'park': 
    case 'garden': return { from: '05:30 AM', to: '07:30 PM' };
    case 'wildlife': return { from: '06:30 AM', to: '04:30 PM' };
    case 'shopping': return { from: '11:00 AM', to: '10:00 PM' };
    case 'nature':
    case 'waterfall':
    case 'beach':
    case 'cave': return { from: '06:00 AM', to: '06:00 PM' };
    default: return { from: '09:00 AM', to: '06:00 PM' };
  }
}

function fetchStatePlaces(state) {
  return new Promise((resolve, reject) => {
    // Search query for tourist attractions in state
    const query = encodeURIComponent(`tourist attractions in ${state} India`);
    
    // We use the generator to search, and then request props for the generated pages.
    // prop=coordinates|pageimages|extracts
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${query}&gsrlimit=50&prop=coordinates|pageimages|extracts&piprop=thumbnail&pithumbsize=800&exintro=1&explaintext=1&exchars=300`;

    https.get(url, { headers: { 'User-Agent': 'PalSafar-Bot/1.0 (Contact: admin@palsafar.com)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.query || !json.query.pages) return resolve([]);
          
          const pages = Object.values(json.query.pages);
          const places = [];

          for (const page of pages) {
            // Skip pages without coordinates or without a thumbnail to ensure high quality
            if (!page.coordinates || page.coordinates.length === 0) continue;
            if (!page.thumbnail || !page.thumbnail.source) continue;
            if (!page.extract || page.extract.length < 20) continue;

            // Skip disambiguation or list pages
            if (page.title.toLowerCase().includes('list of') || page.title.toLowerCase().includes('disambiguation')) continue;

            const category = categorize(page.title);
            const timings = getTimings(category);

            places.push({
              id: page.pageid.toString(),
              name: page.title,
              category: category,
              description: page.extract.replace(/\n/g, ' ').trim(),
              latitude: page.coordinates[0].lat,
              longitude: page.coordinates[0].lon,
              imageUrl: page.thumbnail.source,
              city: '', // Difficult to get exact city from this endpoint, default to state name or leave blank
              state: state,
              country: 'India',
              rating: parseFloat((4.0 + Math.random()).toFixed(1)), // Random rating between 4.0 and 5.0
              bestTimeFrom: timings.from,
              bestTimeTo: timings.to,
              bestTimeReason: 'Favorable weather and full access to the site.',
              mustVisit: Math.random() > 0.8,
              isHiddenGem: Math.random() > 0.9,
            });
          }
          resolve(places);
        } catch (e) {
          console.error(`Error parsing state ${state}:`, e.message);
          resolve([]);
        }
      });
    }).on('error', (e) => {
      console.error(`Error fetching state ${state}:`, e.message);
      resolve([]);
    });
  });
}

async function main() {
  console.log('Fetching rich tourist place data from Wikipedia...');
  const allPlaces = [];
  
  // We process states sequentially or in small batches to avoid rate limiting
  for (const state of STATES) {
    console.log(`Fetching ${state}...`);
    const places = await fetchStatePlaces(state);
    allPlaces.push(...places);
    console.log(` -> Found ${places.length} high-quality places`);
    
    // Slight delay to be polite to Wikipedia API
    await new Promise(r => setTimeout(r, 500));
  }

  // Deduplicate by ID just in case
  const uniqueMap = new Map();
  for (const p of allPlaces) {
    if (!uniqueMap.has(p.id)) {
      uniqueMap.set(p.id, p);
    }
  }

  const finalPlaces = Array.from(uniqueMap.values());
  console.log(`\nTotal unique places fetched: ${finalPlaces.length}`);

  const outDir = './server/prisma/seed-data';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = `${outDir}/places-wiki.json`;
  fs.writeFileSync(outPath, JSON.stringify(finalPlaces, null, 2));
  console.log(`Saved to ${outPath}`);
}

main();
