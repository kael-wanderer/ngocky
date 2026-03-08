-- AlterTable
ALTER TABLE "ProjectTask"
ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LearningTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningTopic_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LearningItem"
ADD COLUMN "topicId" TEXT;

-- Backfill topics from existing learning items
WITH seeded_topics AS (
    INSERT INTO "LearningTopic" ("id", "title", "description", "userId", "createdAt", "updatedAt")
    SELECT
        'lt_' || md5(li."userId" || '|' || COALESCE(NULLIF(li.subject, ''), li.title)),
        COALESCE(NULLIF(li.subject, ''), li.title),
        NULL,
        li."userId",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM "LearningItem" li
    GROUP BY li."userId", COALESCE(NULLIF(li.subject, ''), li.title)
    ON CONFLICT ("id") DO NOTHING
    RETURNING "id"
)
UPDATE "LearningItem" li
SET "topicId" = 'lt_' || md5(li."userId" || '|' || COALESCE(NULLIF(li.subject, ''), li.title))
WHERE li."topicId" IS NULL;

-- Indexes
CREATE INDEX "LearningTopic_userId_idx" ON "LearningTopic"("userId");
CREATE INDEX "LearningItem_topicId_idx" ON "LearningItem"("topicId");

-- Foreign keys
ALTER TABLE "LearningTopic"
ADD CONSTRAINT "LearningTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningItem"
ADD CONSTRAINT "LearningItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "LearningTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
