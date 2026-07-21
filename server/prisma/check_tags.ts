import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const places = await p.place.findMany({ select: { name: true, tags: true } });
  let dupes = 0;
  for (const pl of places) {
    const t = pl.tags as string[];
    if (t && t.length !== new Set(t).size) {
      console.log('DUPES:', pl.name, JSON.stringify(t));
      dupes++;
    }
  }
  console.log('Total places:', places.length);
  console.log('With duplicate tags:', dupes);
  await p.$disconnect();
})();
