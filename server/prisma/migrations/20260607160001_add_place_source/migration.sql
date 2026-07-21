-- Create PlaceSource enum
CREATE TYPE "PlaceSource" AS ENUM ('CURATED', 'OSM', 'ADMIN', 'HIDDEN_GEM', 'PARTNER', 'WIKIMEDIA');

-- Add source column with default for existing records
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "source" "PlaceSource" NOT NULL DEFAULT 'HIDDEN_GEM';

-- Add external_id column (nullable, unique via partial index)
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "external_id" TEXT;

-- Partial unique index on non-null external_id
CREATE UNIQUE INDEX IF NOT EXISTS "places_external_id_key" ON "places"("external_id") WHERE "external_id" IS NOT NULL;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS "places_source_idx" ON "places"("source");
CREATE INDEX IF NOT EXISTS "places_external_id_idx" ON "places"("external_id");
