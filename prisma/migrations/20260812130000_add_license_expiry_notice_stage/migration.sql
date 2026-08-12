-- Tracks which term-expiry notice has been emailed, so the daily cron is idempotent (0 none,
-- 1 "expiring soon" sent, 2 "in grace/expired" sent). Reset to 0 on (re)activation.
ALTER TABLE "SchoolLicense" ADD COLUMN "expiryNoticeStage" INTEGER NOT NULL DEFAULT 0;
