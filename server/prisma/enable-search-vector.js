const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('Connecting to database to configure full-text search vector trigger...');
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
    `);
    console.log('1. search_vector column checked/added.');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "places_search_idx" ON "places" USING GIN ("search_vector");
    `);
    console.log('2. GIN index checked/created.');

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION places_search_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english',
          COALESCE(NEW.name, '') || ' ' ||
          COALESCE(NEW.description, '') || ' ' ||
          COALESCE(NEW.category, '') || ' ' ||
          COALESCE(NEW.city, '') || ' ' ||
          COALESCE(NEW.state, '') || ' ' ||
          COALESCE(array_to_string(NEW.tags, ' '), '')
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('3. Trigger function created/updated.');

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS trg_places_search ON "places";
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_places_search
        BEFORE INSERT OR UPDATE ON "places"
        FOR EACH ROW EXECUTE FUNCTION places_search_update();
    `);
    console.log('4. Trigger bound to places table.');

    await prisma.$executeRawUnsafe(`
      UPDATE "places" SET "name" = "name" WHERE "search_vector" IS NULL;
    `);
    console.log('5. Backfilled search_vector for existing records.');

    console.log('Full-text search trigger configured successfully!');
  } catch (error) {
    console.error('Failed to configure search trigger:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
