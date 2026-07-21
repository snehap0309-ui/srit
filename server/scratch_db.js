const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const places = await prisma.place.findMany();
  console.log('Total places:', places.length);
  const approved = await prisma.place.findMany({ where: { status: 'APPROVED' } });
  console.log('Approved places:', approved.length);
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
