-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionType" ADD VALUE 'CODE';
ALTER TYPE "QuestionType" ADD VALUE 'RUBRIC';

-- AlterTable
ALTER TABLE "AssessmentQuestion" ADD COLUMN     "codeLanguage" TEXT,
ADD COLUMN     "starterCode" TEXT;

-- CreateTable
CREATE TABLE "AssessmentTestCase" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "name" TEXT,
    "stdin" TEXT NOT NULL DEFAULT '',
    "expectedStdout" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "hidden" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssessmentTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCriterion" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "maxPoints" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentTestCase_questionId_idx" ON "AssessmentTestCase"("questionId");

-- CreateIndex
CREATE INDEX "RubricCriterion_questionId_idx" ON "RubricCriterion"("questionId");

-- AddForeignKey
ALTER TABLE "AssessmentTestCase" ADD CONSTRAINT "AssessmentTestCase_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

