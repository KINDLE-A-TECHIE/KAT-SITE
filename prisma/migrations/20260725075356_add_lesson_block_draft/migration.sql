-- CreateTable
CREATE TABLE "LessonBlockDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonBlockDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonBlockDraft_userId_idx" ON "LessonBlockDraft"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonBlockDraft_userId_contentId_key" ON "LessonBlockDraft"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "LessonBlockDraft" ADD CONSTRAINT "LessonBlockDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonBlockDraft" ADD CONSTRAINT "LessonBlockDraft_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "LessonContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
