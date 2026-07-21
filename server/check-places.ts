import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const places = await p.place.findMany({ select: { name: true, tags: true, bestTimeToVisit: true, description: true } });
  console.log('Total places:', places.length);
  console.log('Places without bestTimeToVisit:', places.filter(pl => !pl.bestTimeToVisit || Object.keys(pl.bestTimeToVisit as any).length === 0).length);
  console.log('Places with short descriptions (<50 chars):', places.filter(pl => !pl.description || pl.description.length < 50).length);
  console.log('Places without tags:', places.filter(pl => !pl.tags || pl.tags.length === 0).length);
}

main()
  .then(() => p.$disconnect())
  .catch((e) => {
    console.error(e);
    p.$disconnect();
    process.exit(1);
  });
