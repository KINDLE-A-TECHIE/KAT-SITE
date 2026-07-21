-- A free per-term taster: school staff may preview a sample lesson even when its term is unlicensed.
ALTER TABLE "Lesson" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;
