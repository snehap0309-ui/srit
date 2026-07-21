-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EARN', 'SPEND', 'REFUND');

-- DropIndex
DROP INDEX IF EXISTS "device_tokens_token_idx";

-- DropIndex
DROP INDEX IF EXISTS "places_slug_idx";

-- DropIndex
DROP INDEX IF EXISTS "point_rules_key_idx";

-- DropIndex
DROP INDEX IF EXISTS "redemption_tokens_redemption_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "redemption_tokens_token_idx";

-- DropIndex
DROP INDEX IF EXISTS "refresh_tokens_token_idx";

-- AlterTable
ALTER TABLE "point_transactions" DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'EARN';

-- AlterTable
ALTER TABLE "wallet_transactions" DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'EARN';
