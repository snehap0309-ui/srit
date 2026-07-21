/**
 * Convert all low-resolution Wikimedia Commons thumbnail URLs in places-curated.json
 * to their original, full-resolution HD image URLs automatically.
 *
 * Run: node scripts/convert-seed-images-to-hd.cjs
 */

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'server', 'prisma', 'seed-data', 'places-curated.json');

if (!fs.existsSync(FILE_PATH)) {
  console.error(`[Error] Seed data file not found at: ${FILE_PATH}`);
  process.exit(1);
}

try {
  const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  let convertCount = 0;

  const updatedData = data.map((place) => {
    let url = place.imageUrl;
    if (url && url.includes('upload.wikimedia.org') && url.includes('/thumb/')) {
      const parts = url.split('/');
      const indexThumb = parts.indexOf('thumb');
      if (indexThumb !== -1) {
        parts.splice(indexThumb, 1);
        parts.pop();
        const hdUrl = parts.join('/');
        place.imageUrl = hdUrl;
        convertCount++;
      }
    }
    return place;
  });

  fs.writeFileSync(FILE_PATH, JSON.stringify(updatedData, null, 2), 'utf-8');
  console.log(`[Success] Successfully converted ${convertCount} places to original HD images!`);
} catch (err) {
  console.error('[Error] Failed to process seed file:', err);
}
