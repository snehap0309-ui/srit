const fs = require('fs');
const https = require('https');
const path = require('path');

const inputPath = path.join(__dirname, '../server/prisma/seed-data/places-wikidata.json');
const outputPath = path.join(__dirname, '../server/prisma/seed-data/places-geocoded.json');

const places = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Take all places
const subset = places;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function geocode(lat, lon) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    https.get(url, { headers: { 'User-Agent': 'PalSafar-Admin-Bot/1.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log(`Starting geocoding for ${subset.length} places...`);
  const results = [];
  
  for (let i = 0; i < subset.length; i++) {
    const place = subset[i];
    try {
      const geo = await geocode(place.latitude, place.longitude);
      if (geo && geo.address) {
        const addr = geo.address;
        place.city = addr.city || addr.town || addr.village || addr.county || addr.state_district || "";
        place.state = addr.state || "";
      }
    } catch (e) {
      console.error(`Error geocoding ${place.name}:`, e.message);
    }
    
    if (place.city && place.state) {
      results.push(place);
    }
    
    process.stdout.write(`\rProgress: ${i + 1}/${subset.length} (${results.length} valid)`);
    await delay(1000); // 1 second delay for Nominatim
  }
  
  console.log(`\nGeocoding complete. Saved ${results.length} valid places.`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
}

main();
