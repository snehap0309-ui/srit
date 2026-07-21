-- AI Itinerary System: typed enums for trip planning, richer TripPlan/TripPlanStop
-- fields for AI generation + budget/time-preference/avoid-list support, a typed
-- visit-duration field on Place, and an AiGenerationLog audit trail.

-- CreateEnum
CREATE TYPE "TravelPace" AS ENUM ('QUICK', 'BALANCED', 'RELAXED', 'VERY_RELAXED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('SUNRISE', 'MORNING', 'AFTERNOON', 'EVENING', 'SUNSET', 'NIGHT');

-- CreateEnum
CREATE TYPE "TimePreference" AS ENUM ('MORNING_FOCUSED', 'FULL_DAY', 'EVENING_FRIENDLY');

-- CreateEnum
CREATE TYPE "AvoidOption" AS ENUM ('CROWDED', 'LONG_TRAVEL', 'EXPENSIVE_ENTRY', 'NON_FAMILY_FRIENDLY');

-- CreateEnum
CREATE TYPE "GenerationSource" AS ENUM ('MANUAL', 'AI_PROMPT', 'HYBRID');

-- Defensive normalization before casting existing free-text columns to enums.
UPDATE "trip_plans" SET "status" = 'DRAFT'
WHERE "status" IS NULL OR "status" NOT IN ('DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

UPDATE "trip_plan_stops" SET "time_slot" = NULL
WHERE "time_slot" IS NOT NULL
  AND UPPER("time_slot") NOT IN ('SUNRISE', 'MORNING', 'AFTERNOON', 'EVENING', 'SUNSET', 'NIGHT');

-- AlterTable: trip_plans.status String -> TripStatus
ALTER TABLE "trip_plans" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "trip_plans" ALTER COLUMN "status" TYPE "TripStatus" USING ("status")::"TripStatus";
ALTER TABLE "trip_plans" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "trip_plans" ALTER COLUMN "status" SET NOT NULL;

-- AlterTable: trip_plan_stops.time_slot String -> TimeSlot
ALTER TABLE "trip_plan_stops" ALTER COLUMN "time_slot" TYPE "TimeSlot" USING (UPPER("time_slot"))::"TimeSlot";

-- AlterTable: trip_plans new AI-generation / preference fields
ALTER TABLE "trip_plans"
  ADD COLUMN IF NOT EXISTS "pace" "TravelPace" NOT NULL DEFAULT 'BALANCED',
  ADD COLUMN IF NOT EXISTS "time_preference" "TimePreference",
  ADD COLUMN IF NOT EXISTS "avoid" "AvoidOption"[] NOT NULL DEFAULT ARRAY[]::"AvoidOption"[],
  ADD COLUMN IF NOT EXISTS "estimated_budget" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "custom_budget_amount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "generation_source" "GenerationSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "ai_prompt" TEXT,
  ADD COLUMN IF NOT EXISTS "ai_preferences" JSONB,
  ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMP(3);

-- AlterTable: trip_plan_stops new enrichment fields
ALTER TABLE "trip_plan_stops"
  ADD COLUMN IF NOT EXISTS "entry_fee" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT FALSE;

-- AlterTable: places typed numeric visit duration (nullable, safe category fallback used at runtime)
ALTER TABLE "places"
  ADD COLUMN IF NOT EXISTS "estimated_duration_minutes" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trip_plans_user_id_status_idx" ON "trip_plans"("user_id", "status");

-- CreateTable: AiGenerationLog
CREATE TABLE IF NOT EXISTS "ai_generation_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "trip_plan_id" TEXT,
  "prompt" JSONB NOT NULL,
  "raw_prompt_text" TEXT,
  "provider" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_generation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_generation_logs_user_id_idx" ON "ai_generation_logs"("user_id");
CREATE INDEX IF NOT EXISTS "ai_generation_logs_trip_plan_id_idx" ON "ai_generation_logs"("trip_plan_id");
CREATE INDEX IF NOT EXISTS "ai_generation_logs_created_at_idx" ON "ai_generation_logs"("created_at");

DO $$ BEGIN
  ALTER TABLE "ai_generation_logs"
    ADD CONSTRAINT "ai_generation_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_generation_logs"
    ADD CONSTRAINT "ai_generation_logs_trip_plan_id_fkey"
    FOREIGN KEY ("trip_plan_id") REFERENCES "trip_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
