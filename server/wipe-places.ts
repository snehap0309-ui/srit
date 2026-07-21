import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_WIPE !== 'true') {
    console.log('[SAFEGUARD] Please run with CONFIRM_WIPE=true env variable to wipe all places.');
    return;
  }
  await p.placeStat.deleteMany({});
  await p.checkIn.deleteMany({});
  await p.review.deleteMany({});
  await p.collectionPlace.deleteMany({});
  await p.vendorOffer.deleteMany({});
  await p.vendor.deleteMany({});
  
  // Trips and Quests might be dependent too
  await p.tripPlanStop.deleteMany({});
  await p.quest.deleteMany({});
  
  await p.place.deleteMany({});
  console.log('All places and dependent data wiped.');
}

main().catch(console.error).finally(() => p.$disconnect());
