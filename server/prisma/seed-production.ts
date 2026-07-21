import { PrismaClient } from '@prisma/client';
import { seedStreetStory } from './seeds/09_street_story';

const prisma = new PrismaClient();

async function main() {
  console.log('=== PalSafar Production Seed Pipeline ===\n');

  try {
    await seedStreetStory(prisma);
    console.log('\n=== Production Seed Completed Successfully ===\n');
  } catch (e) {
    console.error('\nSeed failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
