-- CreateEnum (idempotent via DO block — IF NOT EXISTS unsupported on PG <14)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationStatus') THEN
    CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'CONTRIBUTOR', 'EXPLORER', 'EXPERT_GUIDE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorStatus') THEN
    CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RedemptionStatus') THEN
    CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'VERIFIED', 'CANCELLED');
  END IF;
END $$;

-- Add missing AuditAction values (idempotent via DO block)
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VENDOR_REGISTERED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VENDOR_VERIFIED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VENDOR_REJECTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POINTS_EARNED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POINTS_REDEEMED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: vendors
CREATE TABLE IF NOT EXISTS "vendors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT,
    "image_url" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "linked_spot_ids" TEXT[],
    "services" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vendor_offers
CREATE TABLE IF NOT EXISTS "vendor_offers" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" TEXT NOT NULL,
    "discount_value" DOUBLE PRECISION NOT NULL,
    "points_required" INTEGER NOT NULL,
    "min_bill_amount" DOUBLE PRECISION,
    "coupon_code" TEXT,
    "daily_limit" INTEGER,
    "valid_till" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: point_balances
CREATE TABLE IF NOT EXISTS "point_balances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_earned" INTEGER NOT NULL DEFAULT 0,
    "lifetime_spent" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "point_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable: point_transactions
CREATE TABLE IF NOT EXISTS "point_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EARN',
    "reason" TEXT NOT NULL,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: redemptions
CREATE TABLE IF NOT EXISTS "redemptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "points_spent" INTEGER NOT NULL,
    "discount_value" DOUBLE PRECISION NOT NULL,
    "discount_type" TEXT NOT NULL,
    "qr_code" TEXT NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "verified_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: device_tokens
CREATE TABLE IF NOT EXISTS "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable: in_app_notifications
CREATE TABLE IF NOT EXISTS "in_app_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_user_id_key" ON "vendors"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "point_balances_user_id_key" ON "point_balances"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "redemptions_qr_code_key" ON "redemptions"("qr_code");
CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_token_key" ON "device_tokens"("token");

-- Indexes for vendors
CREATE INDEX IF NOT EXISTS "vendor_offers_vendor_id_idx" ON "vendor_offers"("vendor_id");
CREATE INDEX IF NOT EXISTS "point_transactions_user_id_idx" ON "point_transactions"("user_id");
CREATE INDEX IF NOT EXISTS "point_transactions_created_at_idx" ON "point_transactions"("created_at");
CREATE INDEX IF NOT EXISTS "redemptions_user_id_idx" ON "redemptions"("user_id");
CREATE INDEX IF NOT EXISTS "redemptions_vendor_id_idx" ON "redemptions"("vendor_id");
CREATE INDEX IF NOT EXISTS "redemptions_qr_code_idx" ON "redemptions"("qr_code");
CREATE INDEX IF NOT EXISTS "redemptions_status_idx" ON "redemptions"("status");
CREATE INDEX IF NOT EXISTS "device_tokens_user_id_idx" ON "device_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "device_tokens_token_idx" ON "device_tokens"("token");
CREATE INDEX IF NOT EXISTS "in_app_notifications_user_id_read_idx" ON "in_app_notifications"("user_id", "read");
CREATE INDEX IF NOT EXISTS "in_app_notifications_user_id_created_at_idx" ON "in_app_notifications"("user_id", "created_at");

-- Foreign keys (idempotent via DO block — ADD CONSTRAINT IF NOT EXISTS unsupported)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_user_id_fkey') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_reviewed_by_id_fkey') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "vendors_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_offers_vendor_id_fkey') THEN
    ALTER TABLE "vendor_offers" ADD CONSTRAINT "vendor_offers_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_balances_user_id_fkey') THEN
    ALTER TABLE "point_balances" ADD CONSTRAINT "point_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_user_id_fkey') THEN
    ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'redemptions_user_id_fkey') THEN
    ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'redemptions_offer_id_fkey') THEN
    ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "vendor_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'redemptions_vendor_id_fkey') THEN
    ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_tokens_user_id_fkey') THEN
    ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'in_app_notifications_user_id_fkey') THEN
    ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
