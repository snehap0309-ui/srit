const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT = path.join(__dirname, '../logo.jpeg');
const RES_DIR = path.join(__dirname, '../android/app/src/main/res');

const SIZES = {
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
};

async function generate() {
  console.log('Generating launcher icons from logo.jpeg...');

  for (const [dir, size] of Object.entries(SIZES)) {
    const outDir = path.join(RES_DIR, dir);
    fs.mkdirSync(outDir, { recursive: true });

    // Square icon (ic_launcher.png)
    await sharp(INPUT)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'));

    // Round icon (ic_launcher_round.png) - same image, Android clips it
    await sharp(INPUT)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'));

    console.log(`✅ ${dir}: ${size}x${size}px`);
  }

  console.log('\n🎉 All launcher icons generated successfully!');
}

generate().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
