-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'SCRATCH';

-- AlterTable: the checklist a SCRATCH question's saved .sb3 is graded against (JSON array of ScratchCheck).
ALTER TABLE "AssessmentQuestion" ADD COLUMN "scratchChecks" TEXT;
