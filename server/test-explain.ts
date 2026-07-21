import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const fromDate = new Date(Date.now() - 30 * 86400000);
  const toDate = new Date();

  console.log('Running EXPLAIN...');
  try {
    const explain = await prisma.$queryRawUnsafe(`
      EXPLAIN ANALYZE
      SELECT
        p.city, p.state,
        COUNT(DISTINCT c.user_id)::int as unique_visitors,
        COUNT(*)::int as visitors,
        COUNT(DISTINCT c.id) as checkins
      FROM check_ins c
      JOIN places p ON c.place_id = p.id
      WHERE c.created_at >= $1 AND c.created_at <= $2
      GROUP BY p.city, p.state
      ORDER BY visitors DESC
    `, fromDate, toDate);
    
    console.log(explain);
  } catch (e) {
    console.error(e);
  }
}

test().finally(() => prisma.$disconnect());
