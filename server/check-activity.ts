import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const activity = await prisma.$queryRawUnsafe(`SELECT pid, state, wait_event_type, wait_event, query::text, (now() - query_start)::text AS duration FROM pg_stat_activity WHERE state != 'idle'`);
  console.log(activity);
}

main().finally(() => prisma.$disconnect());
