import { PrismaClient } from '@prisma/client';
import { seedSystem } from './seeds/01_system';
import { seedUsers } from './seeds/02_users';
import { seedPlaces } from './seeds/03_places';
import { seedVendors } from './seeds/04_vendors';
import { seedSocial } from './seeds/05_social';
import { seedCampaigns } from './seeds/07_campaigns';
import { seedTrips } from './seeds/08_trips';

const prisma = new PrismaClient();

async function cleanDatabase(prisma: PrismaClient) {
  console.log('--- Cleaning Database ---');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed script cannot run in production — it would delete all data.');
  }

  // Safety check: if there are already places in the database, do NOT wipe the database to protect user data
  const placeCount = await prisma.place.count();
  if (placeCount > 50) {
    console.log(`[SAFEGUARD] Database contains ${placeCount} existing places. Skipping database wipe to protect live data.`);
    return;
  }

  // Delete in reverse dependency order
  await prisma.auditLog.deleteMany({});
  await prisma.redemption.deleteMany({});
  await prisma.rewardClaim.deleteMany({});
  await prisma.rewardCampaign.deleteMany({});
  await prisma.quest.deleteMany({});
  await prisma.pointTransaction.deleteMany({});
  await prisma.tripPlanStop.deleteMany({});
  await prisma.tripPlan.deleteMany({});
  await prisma.collectionPlace.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.reelLike.deleteMany({});
  await prisma.reelComment.deleteMany({});
  await prisma.reel.deleteMany({});
  await prisma.placeStat.deleteMany({});
  await prisma.checkIn.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.vendorOffer.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.place.deleteMany({});
  await prisma.creatorProfile.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.pointRule.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  console.log('Database wiped successfully.');
}

async function main() {
  console.log('=== PalSafar Master Seed Pipeline ===\n');

  try {
    await cleanDatabase(prisma);

    // 01. System
    await seedSystem(prisma);

    // 02. Users
    const { admin, standardUser, creators, vendors } = await seedUsers(prisma);

    // 03. Places
    const places = await seedPlaces(prisma, admin.id, standardUser.id);

    // 04. Vendors
    const vendorsResult = await seedVendors(prisma, admin.id, vendors, places);
    const vendorOffers = vendorsResult?.vendorOffers || [];

    // 05. Social
    const allUsers = [admin, standardUser, ...creators, ...vendors];
    await seedSocial(prisma, allUsers, places);

      // 07. Campaigns
    await seedCampaigns(prisma, allUsers, vendorOffers);

    // 08. Trips
    await seedTrips(prisma, allUsers, places);

    console.log('\n=== Seed Completed Successfully ===\n');

  } catch (e) {
    console.error('\nSeed failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
