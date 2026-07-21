-- Convert multi-role accounts into a single authorization permission plus active UI mode.
ALTER TABLE "users"
  ADD COLUMN "permission" "Role" NOT NULL DEFAULT 'USER',
  ADD COLUMN "active_mode" "Role" NOT NULL DEFAULT 'USER';

UPDATE "users"
SET
  "permission" = CASE
    WHEN 'ADMIN' = ANY("roles") THEN 'ADMIN'::"Role"
    WHEN 'VENDOR' = ANY("roles") THEN 'VENDOR'::"Role"
    WHEN 'CONTENT_CREATOR' = ANY("roles") THEN 'CONTENT_CREATOR'::"Role"
    ELSE 'USER'::"Role"
  END,
  "active_mode" = CASE
    WHEN 'ADMIN' = ANY("roles") THEN 'ADMIN'::"Role"
    WHEN 'VENDOR' = ANY("roles")
      THEN CASE WHEN "active_role" IN ('USER'::"Role", 'VENDOR'::"Role") THEN "active_role" ELSE 'USER'::"Role" END
    WHEN 'CONTENT_CREATOR' = ANY("roles")
      THEN CASE WHEN "active_role" IN ('USER'::"Role", 'CONTENT_CREATOR'::"Role") THEN "active_role" ELSE 'USER'::"Role" END
    ELSE 'USER'::"Role"
  END;

DROP INDEX IF EXISTS "users_active_role_idx";
ALTER TABLE "users"
  DROP COLUMN "roles",
  DROP COLUMN "active_role";

CREATE INDEX "users_permission_idx" ON "users"("permission");
CREATE INDEX "users_active_mode_idx" ON "users"("active_mode");
