ALTER TABLE "creator_profiles"
  ADD COLUMN IF NOT EXISTS "full_name" TEXT,
  ADD COLUMN IF NOT EXISTS "travel_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "instagram_url" TEXT,
  ADD COLUMN IF NOT EXISTS "youtube_url" TEXT,
  ADD COLUMN IF NOT EXISTS "sample_reel_url" TEXT,
  ADD COLUMN IF NOT EXISTS "application_reason" TEXT;

CREATE TABLE IF NOT EXISTS "creator_daily_rewards" (
  "id" TEXT PRIMARY KEY,
  "creator_id" TEXT NOT NULL REFERENCES "creator_profiles"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL,
  "reel_id" TEXT NOT NULL UNIQUE REFERENCES "reels"("id") ON DELETE CASCADE,
  "reward_date" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 100,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("creator_id", "reward_date")
);

CREATE INDEX IF NOT EXISTS "creator_daily_rewards_user_id_idx" ON "creator_daily_rewards"("user_id");
CREATE INDEX IF NOT EXISTS "creator_daily_rewards_reward_date_idx" ON "creator_daily_rewards"("reward_date");
