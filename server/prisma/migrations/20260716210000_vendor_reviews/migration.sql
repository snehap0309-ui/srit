-- Vendor shop ratings + user reviews (mirrors place reviews)
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "review_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "vendor_reviews" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "helpful_votes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_reviews_vendor_id_user_id_key" ON "vendor_reviews"("vendor_id", "user_id");
CREATE INDEX IF NOT EXISTS "vendor_reviews_vendor_id_idx" ON "vendor_reviews"("vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_reviews_user_id_idx" ON "vendor_reviews"("user_id");
CREATE INDEX IF NOT EXISTS "vendor_reviews_rating_idx" ON "vendor_reviews"("rating");
CREATE INDEX IF NOT EXISTS "vendor_reviews_created_at_idx" ON "vendor_reviews"("created_at");
CREATE INDEX IF NOT EXISTS "vendors_rating_idx" ON "vendors"("rating");

DO $$ BEGIN
  ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
