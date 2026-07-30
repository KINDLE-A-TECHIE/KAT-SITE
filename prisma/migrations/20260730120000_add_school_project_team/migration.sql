-- CreateEnum
CREATE TYPE "ProjectTeamStatus" AS ENUM ('FORMING', 'APPROVED', 'NEEDS_WORK');

-- CreateTable
CREATE TABLE "SchoolProjectTeam" (
    "id" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProjectTeamStatus" NOT NULL DEFAULT 'FORMING',
    "submissionNote" TEXT,
    "submissionUrl" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolProjectTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolProjectTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SchoolProjectTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolProjectTeam_schoolClassId_moduleId_idx" ON "SchoolProjectTeam"("schoolClassId", "moduleId");

-- CreateIndex
CREATE INDEX "SchoolProjectTeam_moduleId_idx" ON "SchoolProjectTeam"("moduleId");

-- CreateIndex
CREATE INDEX "SchoolProjectTeamMember_userId_idx" ON "SchoolProjectTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolProjectTeamMember_teamId_userId_key" ON "SchoolProjectTeamMember"("teamId", "userId");

-- AddForeignKey
ALTER TABLE "SchoolProjectTeam" ADD CONSTRAINT "SchoolProjectTeam_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolProjectTeam" ADD CONSTRAINT "SchoolProjectTeam_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolProjectTeamMember" ADD CONSTRAINT "SchoolProjectTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SchoolProjectTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

