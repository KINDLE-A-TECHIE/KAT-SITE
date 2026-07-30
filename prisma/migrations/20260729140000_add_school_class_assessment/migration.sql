-- CreateTable
CREATE TABLE "SchoolClassAssessment" (
    "id" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "assignedById" TEXT,
    "assignedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClassAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolClassAssessment_schoolClassId_idx" ON "SchoolClassAssessment"("schoolClassId");

-- CreateIndex
CREATE INDEX "SchoolClassAssessment_assessmentId_idx" ON "SchoolClassAssessment"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClassAssessment_schoolClassId_assessmentId_key" ON "SchoolClassAssessment"("schoolClassId", "assessmentId");

-- AddForeignKey
ALTER TABLE "SchoolClassAssessment" ADD CONSTRAINT "SchoolClassAssessment_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClassAssessment" ADD CONSTRAINT "SchoolClassAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

