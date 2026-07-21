/*
  Warnings:

  - You are about to drop the column `place_id` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `place_id` on the `place_stats` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `place_stats` table. All the data in the column will be lost.
  - You are about to drop the column `approved_by_id` on the `places` table. All the data in the column will be lost.
  - You are about to drop the column `submitted_by_id` on the `places` table. All the data in the column will be lost.
  - Added the required column `placeId` to the `place_stats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `submittedById` to the `places` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_place_fkey";

-- DropForeignKey
ALTER TABLE "place_stats" DROP CONSTRAINT "place_stats_place_fkey";

-- DropForeignKey
ALTER TABLE "place_stats" DROP CONSTRAINT "place_stats_user_fkey";

-- DropForeignKey
ALTER TABLE "places" DROP CONSTRAINT "places_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "places" DROP CONSTRAINT "places_submitted_by_fkey";

-- DropIndex
DROP INDEX "place_stats_place_id_idx";

-- DropIndex
DROP INDEX "place_stats_user_id_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "place_id",
ADD COLUMN     "placeId" TEXT;

-- AlterTable
ALTER TABLE "place_stats" DROP COLUMN "place_id",
DROP COLUMN "user_id",
ADD COLUMN     "placeId" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "places" DROP COLUMN "approved_by_id",
DROP COLUMN "submitted_by_id",
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "submittedById" TEXT NOT NULL,
ALTER COLUMN "images" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "place_stats_placeId_idx" ON "place_stats"("placeId");

-- CreateIndex
CREATE INDEX "place_stats_userId_idx" ON "place_stats"("userId");

-- RenameForeignKey
ALTER TABLE "audit_logs" RENAME CONSTRAINT "audit_logs_actor_fkey" TO "audit_logs_actor_id_fkey";

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_stats" ADD CONSTRAINT "place_stats_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_stats" ADD CONSTRAINT "place_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "audit_logs_entity_idx" RENAME TO "audit_logs_entity_type_entity_id_idx";

-- RenameIndex
ALTER INDEX "sync_queue_status_created_idx" RENAME TO "sync_queue_status_created_at_idx";

-- RenameIndex
ALTER INDEX "sync_queue_user_status_idx" RENAME TO "sync_queue_user_id_status_idx";

