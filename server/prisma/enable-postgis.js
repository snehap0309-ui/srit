const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('Connecting to database to enable PostGIS extension...');
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('PostGIS extension enabled successfully!');
  } catch (error) {
    console.error('Failed to enable PostGIS extension:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
