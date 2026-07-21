-- Verification: add columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verification_status" "VerificationStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verified_by_id" TEXT;

-- Social Graph tables
CREATE TABLE IF NOT EXISTS "follows" (
  "id" TEXT PRIMARY KEY,
  "follower_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "following_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("follower_id", "following_id")
);
CREATE INDEX IF NOT EXISTS "follows_follower_id_idx" ON "follows"("follower_id");
CREATE INDEX IF NOT EXISTS "follows_following_id_idx" ON "follows"("following_id");

CREATE TABLE IF NOT EXISTS "collections" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_public" BOOLEAN NOT NULL DEFAULT TRUE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "collections_user_id_idx" ON "collections"("user_id");

CREATE TABLE IF NOT EXISTS "collection_places" (
  "id" TEXT PRIMARY KEY,
  "collection_id" TEXT NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "place_id" TEXT NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "note" TEXT,
  "added_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("collection_id", "place_id")
);

CREATE TABLE IF NOT EXISTS "travel_journals" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "cover_image" TEXT,
  "is_public" BOOLEAN NOT NULL DEFAULT TRUE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "trip_plan_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "travel_journals_user_id_idx" ON "travel_journals"("user_id");
CREATE INDEX IF NOT EXISTS "travel_journals_trip_plan_id_idx" ON "travel_journals"("trip_plan_id");

CREATE TABLE IF NOT EXISTS "trip_plans" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "days" INTEGER NOT NULL DEFAULT 1,
  "is_published" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "trip_plans_user_id_idx" ON "trip_plans"("user_id");

CREATE TABLE IF NOT EXISTS "trip_plan_days" (
  "id" TEXT PRIMARY KEY,
  "trip_plan_id" TEXT NOT NULL REFERENCES "trip_plans"("id") ON DELETE CASCADE,
  "day_number" INTEGER NOT NULL,
  "theme" TEXT,
  UNIQUE("trip_plan_id", "day_number")
);

CREATE TABLE IF NOT EXISTS "trip_plan_stops" (
  "id" TEXT PRIMARY KEY,
  "trip_plan_day_id" TEXT NOT NULL REFERENCES "trip_plan_days"("id") ON DELETE CASCADE,
  "place_id" TEXT NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  "time_slot" TEXT,
  "notes" TEXT
);
CREATE INDEX IF NOT EXISTS "trip_plan_stops_trip_plan_day_id_idx" ON "trip_plan_stops"("trip_plan_day_id");

CREATE TABLE IF NOT EXISTS "trip_collaborators" (
  "id" TEXT PRIMARY KEY,
  "trip_plan_id" TEXT NOT NULL REFERENCES "trip_plans"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'EDITOR',
  UNIQUE("trip_plan_id", "user_id")
);

-- FK for journals -> trip_plans (after trip_plans exists)
ALTER TABLE "travel_journals" ADD CONSTRAINT IF NOT EXISTS "travel_journals_trip_plan_id_fkey"
  FOREIGN KEY ("trip_plan_id") REFERENCES "trip_plans"("id") ON DELETE SET NULL;

-- FK for verified_by
ALTER TABLE "users" ADD CONSTRAINT IF NOT EXISTS "users_verified_by_id_fkey"
  FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
