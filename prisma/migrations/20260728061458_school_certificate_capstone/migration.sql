-- CreateEnum
CREATE TYPE "SchoolCertificateKind" AS ENUM ('TERM', 'SESSION');

-- AlterTable
ALTER TABLE "SchoolCertificate" ADD COLUMN     "kind" "SchoolCertificateKind" NOT NULL DEFAULT 'TERM',
ADD COLUMN     "programId" TEXT,
ALTER COLUMN "moduleId" DROP NOT NULL,
ALTER COLUMN "moduleTitle" DROP NOT NULL,
ALTER COLUMN "termNumber" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCertificate_userId_programId_key" ON "SchoolCertificate"("userId", "programId");

-- AddForeignKey
ALTER TABLE "SchoolCertificate" ADD CONSTRAINT "SchoolCertificate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

