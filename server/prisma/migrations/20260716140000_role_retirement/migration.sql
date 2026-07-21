-- Professional role exclusivity: add a RETIRED status distinct from admin-driven
-- REJECTED/SUSPENDED, used when a user self-switches between VENDOR and CONTENT_CREATOR
-- (or an admin force-switches them). Also adds a matching audit action and a
-- retiredAt timestamp on user_roles for quick admin-side visibility.

ALTER TYPE "RoleAssignmentStatus" ADD VALUE IF NOT EXISTS 'RETIRED';
ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'RETIRED';
ALTER TYPE "CreatorStatus" ADD VALUE IF NOT EXISTS 'RETIRED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ROLE_RETIRED';

ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "retired_at" TIMESTAMP(3);
