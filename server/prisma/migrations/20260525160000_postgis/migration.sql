-- PostGIS spatial extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to places table
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "location" geometry(Point, 4326);

-- Create spatial index
CREATE INDEX IF NOT EXISTS "places_location_idx" ON "places" USING GIST ("location");

-- Trigger function to auto-sync location from lat/lng
CREATE OR REPLACE FUNCTION places_location_sync() RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_places_location ON "places";
CREATE TRIGGER trg_places_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON "places"
  FOR EACH ROW EXECUTE FUNCTION places_location_sync();

-- Backfill existing rows
UPDATE "places"
SET "location" = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE "location" IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
