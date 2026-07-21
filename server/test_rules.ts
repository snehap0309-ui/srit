import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rules = await prisma.pointRule.findMany();
  console.log(`Found ${rules.length} rules.`);
  for (const r of rules) {
    console.log(`- ${r.key}: ${r.points} points (${r.category})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
