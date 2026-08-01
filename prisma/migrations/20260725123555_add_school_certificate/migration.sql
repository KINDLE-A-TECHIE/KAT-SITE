-- CreateEnum
CREATE TYPE "SchoolCertificateStatus" AS ENUM ('ISSUED', 'REVOKED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "certHighlight" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SchoolCertificate" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "pupilName" TEXT NOT NULL,
    "programTitle" TEXT NOT NULL,
    "moduleTitle" TEXT NOT NULL,
    "sessionLabel" TEXT NOT NULL,
    "termNumber" INTEGER NOT NULL,
    "highlightLessons" JSONB NOT NULL,
    "nameConsent" BOOLEAN NOT NULL DEFAULT false,
    "status" "SchoolCertificateStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCertificate_credentialId_key" ON "SchoolCertificate"("credentialId");

-- CreateIndex
CREATE INDEX "SchoolCertificate_schoolId_idx" ON "SchoolCertificate"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolCertificate_schoolClassId_idx" ON "SchoolCertificate"("schoolClassId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCertificate_userId_moduleId_key" ON "SchoolCertificate"("userId", "moduleId");

-- AddForeignKey
ALTER TABLE "SchoolCertificate" ADD CONSTRAINT "SchoolCertificate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCertificate" ADD CONSTRAINT "SchoolCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCertificate" ADD CONSTRAINT "SchoolCertificate_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCertificate" ADD CONSTRAINT "SchoolCertificate_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCertificate" ADD CONSTRAINT "SchoolCertificate_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
