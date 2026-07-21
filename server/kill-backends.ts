import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRawUnsafe(`SELECT pg_cancel_backend(1705)`);
  await prisma.$queryRawUnsafe(`SELECT pg_cancel_backend(820)`);
  console.log('Killed backends');
}

main().finally(() => prisma.$disconnect());
