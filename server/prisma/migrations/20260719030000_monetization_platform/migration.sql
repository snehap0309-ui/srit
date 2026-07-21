-- Monetization platform: plans, subscriptions, payments, coupons, docs, ads

CREATE TYPE "PlanAudience" AS ENUM ('USER_PREMIUM', 'VENDOR', 'CREATOR');
CREATE TYPE "PlanBillingPeriod" AS ENUM ('MONTHLY', 'YEARLY', 'LIFETIME');
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE', 'CANCELLED', 'EXPIRED', 'SUSPENDED');
CREATE TYPE "VendorSubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'GRACE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED');
CREATE TYPE "PaymentProvider" AS ENUM ('GOOGLE_PLAY', 'APPLE_IAP', 'RAZORPAY', 'ADMIN_GRANT');
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FLAT', 'BOGO');
CREATE TYPE "CouponOwnerType" AS ENUM ('ADMIN', 'VENDOR');
CREATE TYPE "VendorDocumentType" AS ENUM ('GST', 'PAN', 'BUSINESS_LICENSE', 'SHOP_PHOTO', 'OWNER_ID', 'BANK_DETAILS', 'OTHER');
CREATE TYPE "VendorDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "razorpay_customer_id" TEXT;

ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "subscription_status" "VendorSubscriptionStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3);

ALTER TABLE "creator_profiles"
  ADD COLUMN IF NOT EXISTS "membership_plan_id" TEXT,
  ADD COLUMN IF NOT EXISTS "membership_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "upload_limit" INTEGER;

CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "audience" "PlanAudience" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "badge" TEXT,
    "color" TEXT DEFAULT '#B9834B',
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '{}',
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "grace_period_days" INTEGER NOT NULL DEFAULT 3,
    "google_product_id_monthly" TEXT,
    "google_product_id_yearly" TEXT,
    "apple_product_id_monthly" TEXT,
    "apple_product_id_yearly" TEXT,
    "razorpay_plan_id_monthly" TEXT,
    "razorpay_plan_id_yearly" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");
CREATE INDEX "subscription_plans_audience_status_idx" ON "subscription_plans"("audience", "status");
CREATE INDEX "subscription_plans_sort_order_idx" ON "subscription_plans"("sort_order");

CREATE TABLE "plan_prices" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "period" "PlanBillingPeriod" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_prices_plan_id_period_key" ON "plan_prices"("plan_id", "period");
CREATE INDEX "plan_prices_plan_id_idx" ON "plan_prices"("plan_id");

CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "audience" "PlanAudience" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_period" "PlanBillingPeriod" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_subscription_id" TEXT,
    "provider_customer_id" TEXT,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "grace_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_subscriptions_user_id_audience_status_idx" ON "user_subscriptions"("user_id", "audience", "status");
CREATE INDEX "user_subscriptions_plan_id_idx" ON "user_subscriptions"("plan_id");
CREATE INDEX "user_subscriptions_current_period_end_idx" ON "user_subscriptions"("current_period_end");
CREATE INDEX "user_subscriptions_provider_subscription_id_idx" ON "user_subscriptions"("provider_subscription_id");

CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "provider_payment_id" TEXT,
    "provider_order_id" TEXT,
    "provider_signature" TEXT,
    "receipt_number" TEXT,
    "failure_reason" TEXT,
    "raw_payload" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_transactions_provider_payment_id_key" ON "payment_transactions"("provider_payment_id");
CREATE UNIQUE INDEX "payment_transactions_receipt_number_key" ON "payment_transactions"("receipt_number");
CREATE INDEX "payment_transactions_user_id_idx" ON "payment_transactions"("user_id");
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");
CREATE INDEX "payment_transactions_provider_order_id_idx" ON "payment_transactions"("provider_order_id");
CREATE INDEX "payment_transactions_created_at_idx" ON "payment_transactions"("created_at");

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "tax_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gst_number" TEXT,
    "billing_name" TEXT,
    "billing_address" TEXT,
    "pdf_url" TEXT,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_transaction_id_key" ON "invoices"("transaction_id");
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");
CREATE INDEX "invoices_issued_at_idx" ON "invoices"("issued_at");

CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "requested_by_id" TEXT,
    "processed_by_id" TEXT,
    "amount_paise" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider_refund_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "refunds_transaction_id_idx" ON "refunds"("transaction_id");
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "owner_type" "CouponOwnerType" NOT NULL DEFAULT 'ADMIN',
    "vendor_id" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "max_discount" DOUBLE PRECISION,
    "min_purchase" DOUBLE PRECISION,
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER NOT NULL DEFAULT 1,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_vendor_id_idx" ON "coupons"("vendor_id");
CREATE INDEX "coupons_is_active_expires_at_idx" ON "coupons"("is_active", "expires_at");

CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coupon_redemptions_coupon_id_idx" ON "coupon_redemptions"("coupon_id");
CREATE INDEX "coupon_redemptions_user_id_idx" ON "coupon_redemptions"("user_id");

CREATE TABLE "vendor_documents" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "type" "VendorDocumentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT,
    "status" "VendorDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_documents_vendor_id_type_idx" ON "vendor_documents"("vendor_id", "type");
CREATE INDEX "vendor_documents_status_idx" ON "vendor_documents"("status");

CREATE TABLE "ad_configurations" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "ads_enabled" BOOLEAN NOT NULL DEFAULT true,
    "kill_switch" BOOLEAN NOT NULL DEFAULT false,
    "banner_enabled" BOOLEAN NOT NULL DEFAULT true,
    "interstitial_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rewarded_enabled" BOOLEAN NOT NULL DEFAULT true,
    "native_enabled" BOOLEAN NOT NULL DEFAULT true,
    "interstitial_cooldown_sec" INTEGER NOT NULL DEFAULT 120,
    "rewarded_points" INTEGER NOT NULL DEFAULT 10,
    "banner_ad_unit_id_android" TEXT,
    "banner_ad_unit_id_ios" TEXT,
    "interstitial_ad_unit_id_android" TEXT,
    "interstitial_ad_unit_id_ios" TEXT,
    "rewarded_ad_unit_id_android" TEXT,
    "rewarded_ad_unit_id_ios" TEXT,
    "native_ad_unit_id_android" TEXT,
    "native_ad_unit_id_ios" TEXT,
    "enabled_countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled_app_versions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ad_configurations_key_key" ON "ad_configurations"("key");

ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "user_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_membership_plan_id_fkey" FOREIGN KEY ("membership_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "creator_profiles_membership_plan_id_idx" ON "creator_profiles"("membership_plan_id");
