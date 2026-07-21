-- Phase 1: support multiple account roles and an active role.
-- Replacement enums make the new values usable immediately within this
-- transactional Prisma migration.
CREATE TYPE "Role_new" AS ENUM ('USER', 'VENDOR', 'CONTENT_CREATOR', 'ADMIN');
CREATE TYPE "VendorStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');
CREATE TYPE "CreatorStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

ALTER TABLE "users"
  ADD COLUMN "roles" "Role_new"[],
  ADD COLUMN "active_role" "Role_new";

ALTER TABLE "vendors"
  ADD COLUMN "gst_number" TEXT,
  ADD COLUMN "documents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "creator_profiles"
  ADD COLUMN "facebook_url" TEXT,
  ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "government_id_url" TEXT,
  ADD COLUMN "portfolio_links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "vendors"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "VendorStatus_new"
  USING "status"::text::"VendorStatus_new",
  ALTER COLUMN "status" SET DEFAULT 'PENDING'::"VendorStatus_new";

ALTER TABLE "creator_profiles"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CreatorStatus_new"
  USING "status"::text::"CreatorStatus_new",
  ALTER COLUMN "status" SET DEFAULT 'PENDING'::"CreatorStatus_new";

UPDATE "users"
SET
  "roles" = CASE "role"
    WHEN 'VENDOR'::"Role" THEN ARRAY['USER'::"Role_new", 'VENDOR'::"Role_new"]
    WHEN 'ADMIN'::"Role" THEN ARRAY['ADMIN'::"Role_new"]
    ELSE ARRAY['USER'::"Role_new"]
  END,
  "active_role" = "role"::text::"Role_new";

UPDATE "users" AS u
SET "roles" = array_append(u."roles", 'CONTENT_CREATOR'::"Role_new")
FROM "creator_profiles" AS cp
WHERE cp."user_id" = u."id"
  AND cp."status" = 'APPROVED'::"CreatorStatus_new"
  AND NOT ('CONTENT_CREATOR'::"Role_new" = ANY(u."roles"));

ALTER TABLE "users"
  ALTER COLUMN "roles" SET DEFAULT ARRAY['USER'::"Role_new"],
  ALTER COLUMN "roles" SET NOT NULL,
  ALTER COLUMN "active_role" SET DEFAULT 'USER'::"Role_new",
  ALTER COLUMN "active_role" SET NOT NULL,
  DROP COLUMN "role";

DROP INDEX IF EXISTS "users_role_idx";
CREATE INDEX "users_active_role_idx" ON "users"("active_role");

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "VendorStatus";
ALTER TYPE "VendorStatus_new" RENAME TO "VendorStatus";
DROP TYPE "CreatorStatus";
ALTER TYPE "CreatorStatus_new" RENAME TO "CreatorStatus";
