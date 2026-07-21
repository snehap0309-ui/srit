-- Preserve actionable feedback for creator applications that are rejected
-- or returned for changes.
ALTER TABLE "creator_profiles"
  ADD COLUMN "rejection_reason" TEXT;
