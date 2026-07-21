import { prisma } from './database';
import { logger } from './logger';

const EXTENSIONS_SQL_STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS postgis;`,
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
  // Speeds up fuzzy name matching (word_similarity / %)
  `CREATE INDEX IF NOT EXISTS places_name_trgm_idx ON places USING GIN (name gin_trgm_ops);`,

  `CREATE OR REPLACE FUNCTION places_search_update() RETURNS trigger AS $$
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
  $$ LANGUAGE plpgsql;`,

  `DROP TRIGGER IF EXISTS trg_places_search ON "places";`,

  `CREATE TRIGGER trg_places_search
    BEFORE INSERT OR UPDATE ON "places"
    FOR EACH ROW EXECUTE FUNCTION places_search_update();`,

  `CREATE OR REPLACE FUNCTION places_location_sync() RETURNS trigger AS $$
  BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;`,

  `DROP TRIGGER IF EXISTS trg_places_location ON "places";`,

  `CREATE TRIGGER trg_places_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON "places"
    FOR EACH ROW EXECUTE FUNCTION places_location_sync();`,

  // Rebuild search vectors so city/state are indexed (idempotent, safe on every boot)
  `UPDATE "places" SET "name" = "name";`
];

export async function ensureDbExtensions(): Promise<void> {
  try {
    for (const statement of EXTENSIONS_SQL_STATEMENTS) {
      await prisma.$executeRawUnsafe(statement);
    }
    logger.info('Database extensions and triggers applied successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to apply database extensions');
    throw error;
  }
}
