-- Legacy compatibility for environments where Project table was created
-- with task-like required columns before ProjectTask split.
-- Current API creates boards with name/ownerId and does not write title/createdById.

ALTER TABLE "Project"
ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Project"
ALTER COLUMN "title" DROP NOT NULL;

ALTER TABLE "Project"
ALTER COLUMN "createdById" DROP NOT NULL;
