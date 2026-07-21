-- AlterEnum: add 6-month billing period for vendor subscriptions
DO $$ BEGIN
  ALTER TYPE "PlanBillingPeriod" ADD VALUE 'SEMIANNUAL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
