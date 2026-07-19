-- AlterTable
ALTER TABLE "SchoolClass" ADD COLUMN     "joinCode" TEXT;

-- CreateTable
CREATE TABLE "SchoolStudentCredential" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolStudentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolStudentCredential_enrollmentId_key" ON "SchoolStudentCredential"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_joinCode_key" ON "SchoolClass"("joinCode");

-- AddForeignKey
ALTER TABLE "SchoolStudentCredential" ADD CONSTRAINT "SchoolStudentCredential_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

