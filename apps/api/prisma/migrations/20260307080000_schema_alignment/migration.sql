-- Align database state with current Prisma schema without destructive resets.
-- This migration is written to be safe on partially-patched environments.

-- GoalTrackingType enum (new in current schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoalTrackingType') THEN
    CREATE TYPE "GoalTrackingType" AS ENUM ('BY_QUANTITY', 'BY_FREQUENCY');
  END IF;
END $$;

-- Goal fields introduced after initial migration
ALTER TABLE "Goal"
  ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'times';

ALTER TABLE "Goal"
  ADD COLUMN IF NOT EXISTS "trackingType" "GoalTrackingType" NOT NULL DEFAULT 'BY_FREQUENCY';

-- Project board shape in current schema
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Backfill required board fields from legacy columns
UPDATE "Project"
SET "name" = COALESCE("name", "title", 'Untitled');

UPDATE "Project"
SET "ownerId" = COALESCE("ownerId", "createdById", "assigneeId");

WITH fallback_user AS (
  SELECT id
  FROM "User"
  ORDER BY
    CASE role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,
    "createdAt"
  LIMIT 1
)
UPDATE "Project" p
SET "ownerId" = (SELECT id FROM fallback_user)
WHERE p."ownerId" IS NULL;

UPDATE "Project"
SET "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "Project" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "updatedAt" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_ownerId_fkey'
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Project_ownerId_idx" ON "Project"("ownerId");

-- ProjectTask table (new in current schema)
CREATE TABLE IF NOT EXISTS "ProjectTask" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "projectId" TEXT NOT NULL,
  "category" TEXT,
  "deadline" TIMESTAMP(3),
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
  "assigneeId" TEXT,
  "createdById" TEXT NOT NULL,
  "notificationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pinToDashboard" BOOLEAN NOT NULL DEFAULT false,
  "kanbanOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectTask"
      ADD CONSTRAINT "ProjectTask_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_assigneeId_fkey'
  ) THEN
    ALTER TABLE "ProjectTask"
      ADD CONSTRAINT "ProjectTask_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectTask_createdById_fkey'
  ) THEN
    ALTER TABLE "ProjectTask"
      ADD CONSTRAINT "ProjectTask_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_idx" ON "ProjectTask"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectTask_assigneeId_idx" ON "ProjectTask"("assigneeId");
CREATE INDEX IF NOT EXISTS "ProjectTask_createdById_idx" ON "ProjectTask"("createdById");
CREATE INDEX IF NOT EXISTS "ProjectTask_status_idx" ON "ProjectTask"("status");
