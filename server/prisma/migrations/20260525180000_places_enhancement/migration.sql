-- Add PARTNER to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PARTNER';

-- Add new columns to places table
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "short_description" TEXT;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "thumbnail" TEXT;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT '';
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'India';
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "review_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "opening_hours" JSONB;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "ticket_price" JSONB;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "hidden_gem_score" DOUBLE PRECISION;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "popularity_score" DOUBLE PRECISION;
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "verification_level" INTEGER NOT NULL DEFAULT 0;

-- Create unique index on slug
UPDATE "places" SET "slug" = LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(MD5("id")::TEXT, 1, 6) WHERE "slug" IS NULL;
ALTER TABLE "places" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "places_slug_idx" ON "places"("slug");

-- Add location column to Prisma-managed schema (if not already tracked)
-- (already exists from previous migration, adding to schema for Prisma awareness)

-- Create place_images table
CREATE TABLE IF NOT EXISTS "place_images" (
  "id" TEXT PRIMARY KEY,
  "place_id" TEXT NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "caption" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "place_images_place_id_idx" ON "place_images"("place_id");

-- Create place_videos table
CREATE TABLE IF NOT EXISTS "place_videos" (
  "id" TEXT PRIMARY KEY,
  "place_id" TEXT NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "thumbnail" TEXT,
  "title" TEXT,
  "duration" INTEGER,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "place_videos_place_id_idx" ON "place_videos"("place_id");

-- Create place_offers table
CREATE TABLE IF NOT EXISTS "place_offers" (
  "id" TEXT PRIMARY KEY,
  "place_id" TEXT NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "discount" TEXT,
  "valid_from" TIMESTAMPTZ,
  "valid_until" TIMESTAMPTZ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "place_offers_place_id_idx" ON "place_offers"("place_id");

-- Create place_events table
CREATE TABLE IF NOT EXISTS "place_events" (
  "id" TEXT PRIMARY KEY,
  "place_id" TEXT NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "image_url" TEXT,
  "start_date" TIMESTAMPTZ NOT NULL,
  "end_date" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "place_events_place_id_idx" ON "place_events"("place_id");
CREATE INDEX IF NOT EXISTS "place_events_start_date_idx" ON "place_events"("start_date");

-- Create reviews table
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" TEXT PRIMARY KEY,
  "place_id" TEXT NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" INTEGER NOT NULL,
  "content" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("place_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "reviews_place_id_idx" ON "reviews"("place_id");
CREATE INDEX IF NOT EXISTS "reviews_user_id_idx" ON "reviews"("user_id");

-- Create check_ins table
CREATE TABLE IF NOT EXISTS "check_ins" (
  "id" TEXT PRIMARY KEY,
  "place_id" TEXT NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("place_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "check_ins_place_id_idx" ON "check_ins"("place_id");
CREATE INDEX IF NOT EXISTS "check_ins_user_id_idx" ON "check_ins"("user_id");

-- Add PLACE_UPDATED to AuditAction if not exists
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PLACE_UPDATED';
