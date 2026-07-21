-- Multi-role: UserRole assignments + Suspend/Pause on specialty profiles.
-- User.permission remains denormalized (dual-write) for one release.

CREATE TYPE "RoleAssignmentStatus" AS ENUM (
  'ACTIVE',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'PAUSED'
);

ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "CreatorStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "CreatorStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "status" "RoleAssignmentStatus" NOT NULL,
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "rejected_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");
CREATE INDEX IF NOT EXISTS "user_roles_role_status_idx" ON "user_roles"("role", "status");
CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx" ON "user_roles"("user_id");

DO $$ BEGIN
  ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: every user gets USER / ACTIVE
INSERT INTO "user_roles" ("id", "user_id", "role", "status", "created_at", "updated_at")
SELECT
  ('ur_user_' || u."id"),
  u."id",
  'USER'::"Role",
  'ACTIVE'::"RoleAssignmentStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "user_roles" ur
  WHERE ur."user_id" = u."id" AND ur."role" = 'USER'::"Role"
);

-- ADMIN from permission
INSERT INTO "user_roles" ("id", "user_id", "role", "status", "approved_at", "created_at", "updated_at")
SELECT
  ('ur_admin_' || u."id"),
  u."id",
  'ADMIN'::"Role",
  'APPROVED'::"RoleAssignmentStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."permission" = 'ADMIN'::"Role"
  AND NOT EXISTS (
    SELECT 1 FROM "user_roles" ur
    WHERE ur."user_id" = u."id" AND ur."role" = 'ADMIN'::"Role"
  );

-- Vendor specialty from vendors table (prefer) or permission
INSERT INTO "user_roles" ("id", "user_id", "role", "status", "approved_at", "rejected_reason", "created_at", "updated_at")
SELECT
  ('ur_vendor_' || v."user_id"),
  v."user_id",
  'VENDOR'::"Role",
  CASE v."status"::text
    WHEN 'APPROVED' THEN 'APPROVED'::"RoleAssignmentStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"RoleAssignmentStatus"
    WHEN 'SUSPENDED' THEN 'SUSPENDED'::"RoleAssignmentStatus"
    WHEN 'PAUSED' THEN 'PAUSED'::"RoleAssignmentStatus"
    ELSE 'PENDING'::"RoleAssignmentStatus"
  END,
  CASE WHEN v."status"::text = 'APPROVED' THEN COALESCE(v."reviewed_at", CURRENT_TIMESTAMP) ELSE NULL END,
  v."rejection_reason",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "vendors" v
WHERE NOT EXISTS (
  SELECT 1 FROM "user_roles" ur
  WHERE ur."user_id" = v."user_id" AND ur."role" = 'VENDOR'::"Role"
);

INSERT INTO "user_roles" ("id", "user_id", "role", "status", "approved_at", "created_at", "updated_at")
SELECT
  ('ur_vendor_perm_' || u."id"),
  u."id",
  'VENDOR'::"Role",
  'APPROVED'::"RoleAssignmentStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."permission" = 'VENDOR'::"Role"
  AND NOT EXISTS (
    SELECT 1 FROM "user_roles" ur
    WHERE ur."user_id" = u."id" AND ur."role" = 'VENDOR'::"Role"
  );

-- Creator specialty
INSERT INTO "user_roles" ("id", "user_id", "role", "status", "approved_at", "rejected_reason", "created_at", "updated_at")
SELECT
  ('ur_creator_' || cp."user_id"),
  cp."user_id",
  'CONTENT_CREATOR'::"Role",
  CASE cp."status"::text
    WHEN 'APPROVED' THEN 'APPROVED'::"RoleAssignmentStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"RoleAssignmentStatus"
    WHEN 'SUSPENDED' THEN 'SUSPENDED'::"RoleAssignmentStatus"
    WHEN 'PAUSED' THEN 'PAUSED'::"RoleAssignmentStatus"
    ELSE 'PENDING'::"RoleAssignmentStatus"
  END,
  CASE WHEN cp."status"::text = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END,
  cp."rejection_reason",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "creator_profiles" cp
WHERE NOT EXISTS (
  SELECT 1 FROM "user_roles" ur
  WHERE ur."user_id" = cp."user_id" AND ur."role" = 'CONTENT_CREATOR'::"Role"
);

INSERT INTO "user_roles" ("id", "user_id", "role", "status", "approved_at", "created_at", "updated_at")
SELECT
  ('ur_creator_perm_' || u."id"),
  u."id",
  'CONTENT_CREATOR'::"Role",
  'APPROVED'::"RoleAssignmentStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."permission" = 'CONTENT_CREATOR'::"Role"
  AND NOT EXISTS (
    SELECT 1 FROM "user_roles" ur
    WHERE ur."user_id" = u."id" AND ur."role" = 'CONTENT_CREATOR'::"Role"
  );
