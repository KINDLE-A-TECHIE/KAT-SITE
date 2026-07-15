-- Pilot-lead fields on PartnerInquiry (school requests). Additive and idempotent:
-- corporate/government leads leave them null. A school pilot lead is still a
-- PartnerInquiry with type = SCHOOL (see SCHOOL-BUILD-NOTES.md), not a new model.
ALTER TABLE "PartnerInquiry" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "PartnerInquiry" ADD COLUMN IF NOT EXISTS "estimatedStudents" INTEGER;
