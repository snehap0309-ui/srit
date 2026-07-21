import { PrismaClient, User, Place } from '@prisma/client';

export async function seedGamification(prisma: PrismaClient, users: User[], places: Place[]) {
  console.log('--- Seeding 06_gamification.ts ---');

  if (users.length === 0) return;

  const BATCH_SIZE = 500;

  // 1. Transactions (Points)
  const pointTransactions = [];

  for (const u of users) {
    const txCount = Math.floor(Math.random() * 10) + 5;
    for (let i = 0; i < txCount; i++) {
      const date = new Date(Date.now() - Math.floor(Math.random() * 30 * 86400000));
      const amount = Math.floor(Math.random() * 50) + 10;

      pointTransactions.push({
        userId: u.id,
        amount,
        type: 'EARN',
        reason: 'check_in',
        createdAt: date,
      });
    }
  }

  for (let i = 0; i < pointTransactions.length; i += BATCH_SIZE) {
    await prisma.pointTransaction.createMany({ data: pointTransactions.slice(i, i + BATCH_SIZE) as any });
  }
  console.log(`Seeded ${pointTransactions.length} Point Transactions`);

  // 2. Quests
  const questsData = [
    {
      title: 'Golden Triangle Explorer',
      description: 'Visit 3 places across Delhi, Agra, and Jaipur.',
      type: 'scavenger_hunt',
      rewardPoints: 200,
      placeIds: places.slice(0, 3).map(p => p.id),
      startsAt: new Date(Date.now()),
      endsAt: new Date(Date.now() + 60 * 86400000),
      isActive: true,
    },
    {
      title: 'Foodie Trail',
      description: 'Check in at 5 top-rated restaurants.',
      type: 'scavenger_hunt',
      rewardPoints: 100,
      placeIds: places.slice(3, 8).map(p => p.id),
      startsAt: new Date(Date.now()),
      endsAt: new Date(Date.now() + 30 * 86400000),
      isActive: true,
    }
  ];

  const createdQuests = [];
  for (const q of questsData) {
    const quest = await prisma.quest.create({ data: q });
    createdQuests.push(quest);
  }
  console.log(`Seeded ${createdQuests.length} Quests`);

  // 3. Quest Completions
  const completions = [];
  for (const u of users) {
    if (Math.random() > 0.7) {
      completions.push({
        userId: u.id,
        questId: createdQuests[0].id,
        completedAt: new Date(Date.now() - Math.floor(Math.random() * 10 * 86400000)),
      });
    }
  }

  if (completions.length > 0) {
    await prisma.questCompletion.createMany({ data: completions as any });
  }
  console.log(`Seeded ${completions.length} Quest Completions`);
}
