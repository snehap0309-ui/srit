-- Idempotent repair: ensure users.permission and users.active_mode exist.
-- Safe when legacy role, roles/active_role, or prior migrations left schema drift.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VENDOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CONTENT_CREATOR';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permission" "Role";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_mode" "Role";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    UPDATE "users"
    SET
      "permission" = COALESCE("permission", CASE "role"::text
        WHEN 'ADMIN' THEN 'ADMIN'::"Role"
        WHEN 'VENDOR' THEN 'VENDOR'::"Role"
        ELSE 'USER'::"Role"
      END),
      "active_mode" = COALESCE("active_mode", CASE "role"::text
        WHEN 'ADMIN' THEN 'ADMIN'::"Role"
        WHEN 'VENDOR' THEN 'VENDOR'::"Role"
        ELSE 'USER'::"Role"
      END)
    WHERE "permission" IS NULL OR "active_mode" IS NULL;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'creator_profiles'
    ) THEN
      UPDATE "users" AS u
      SET "permission" = 'CONTENT_CREATOR'::"Role"
      FROM "creator_profiles" AS cp
      WHERE cp."user_id" = u."id"
        AND cp."status" = 'APPROVED'
        AND u."permission" = 'USER'::"Role";
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'roles'
  ) THEN
    UPDATE "users"
    SET
      "permission" = COALESCE("permission", CASE
        WHEN 'ADMIN' = ANY("roles") THEN 'ADMIN'::"Role"
        WHEN 'VENDOR' = ANY("roles") THEN 'VENDOR'::"Role"
        WHEN 'CONTENT_CREATOR' = ANY("roles") THEN 'CONTENT_CREATOR'::"Role"
        ELSE 'USER'::"Role"
      END),
      "active_mode" = COALESCE("active_mode", CASE
        WHEN 'ADMIN' = ANY("roles") THEN 'ADMIN'::"Role"
        WHEN 'VENDOR' = ANY("roles") THEN
          CASE
            WHEN "active_role" IN ('USER'::"Role", 'VENDOR'::"Role") THEN "active_role"
            ELSE 'USER'::"Role"
          END
        WHEN 'CONTENT_CREATOR' = ANY("roles") THEN
          CASE
            WHEN "active_role" IN ('USER'::"Role", 'CONTENT_CREATOR'::"Role") THEN "active_role"
            ELSE 'USER'::"Role"
          END
        ELSE 'USER'::"Role"
      END)
    WHERE "permission" IS NULL OR "active_mode" IS NULL;
  END IF;

  UPDATE "users"
  SET
    "permission" = COALESCE("permission", 'USER'::"Role"),
    "active_mode" = COALESCE("active_mode", 'USER'::"Role")
  WHERE "permission" IS NULL OR "active_mode" IS NULL;
END $$;

ALTER TABLE "users" ALTER COLUMN "permission" SET DEFAULT 'USER'::"Role";
ALTER TABLE "users" ALTER COLUMN "active_mode" SET DEFAULT 'USER'::"Role";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "users" WHERE "permission" IS NULL) THEN
    ALTER TABLE "users" ALTER COLUMN "permission" SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "users" WHERE "active_mode" IS NULL) THEN
    ALTER TABLE "users" ALTER COLUMN "active_mode" SET NOT NULL;
  END IF;
END $$;

ALTER TABLE "users" DROP COLUMN IF EXISTS "roles";
ALTER TABLE "users" DROP COLUMN IF EXISTS "active_role";
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

DROP INDEX IF EXISTS "users_role_idx";
DROP INDEX IF EXISTS "users_active_role_idx";
CREATE INDEX IF NOT EXISTS "users_permission_idx" ON "users"("permission");
CREATE INDEX IF NOT EXISTS "users_active_mode_idx" ON "users"("active_mode");
