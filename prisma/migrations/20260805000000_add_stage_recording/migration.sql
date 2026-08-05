-- CreateTable
CREATE TABLE "StageRecording" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "contentId" TEXT,
    "title" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StageRecording_r2Key_key" ON "StageRecording"("r2Key");

-- CreateIndex
CREATE INDEX "StageRecording_userId_createdAt_idx" ON "StageRecording"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StageRecording_contentId_idx" ON "StageRecording"("contentId");

-- AddForeignKey
ALTER TABLE "StageRecording" ADD CONSTRAINT "StageRecording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
