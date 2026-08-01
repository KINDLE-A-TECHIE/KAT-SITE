-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false;


-- Backfill: existing live programmes stay live (published). Archived ones keep isPublished=false,
-- so restoring them lands in Draft (a deliberate re-publish), per the agreed lifecycle.
UPDATE "Program" SET "isPublished" = true WHERE "isActive" = true;
