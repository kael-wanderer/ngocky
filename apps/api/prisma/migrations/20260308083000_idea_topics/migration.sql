-- CreateTable
CREATE TABLE "IdeaTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IdeaTopic_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Idea"
ADD COLUMN "topicId" TEXT;

-- Backfill topics from existing ideas
WITH seeded_topics AS (
    INSERT INTO "IdeaTopic" ("id", "title", "description", "userId", "createdAt", "updatedAt")
    SELECT
        'it_' || md5(i."userId" || '|' || COALESCE(NULLIF(i.category, ''), i.title)),
        COALESCE(NULLIF(i.category, ''), i.title),
        NULL,
        i."userId",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM "Idea" i
    GROUP BY i."userId", COALESCE(NULLIF(i.category, ''), i.title)
    ON CONFLICT ("id") DO NOTHING
    RETURNING "id"
)
UPDATE "Idea" i
SET "topicId" = 'it_' || md5(i."userId" || '|' || COALESCE(NULLIF(i.category, ''), i.title))
WHERE i."topicId" IS NULL;

-- Indexes
CREATE INDEX "IdeaTopic_userId_idx" ON "IdeaTopic"("userId");
CREATE INDEX "Idea_topicId_idx" ON "Idea"("topicId");

-- Foreign keys
ALTER TABLE "IdeaTopic"
ADD CONSTRAINT "IdeaTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Idea"
ADD CONSTRAINT "Idea_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "IdeaTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
