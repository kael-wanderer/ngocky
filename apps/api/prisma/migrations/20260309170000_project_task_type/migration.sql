DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectTaskType') THEN
    CREATE TYPE "ProjectTaskType" AS ENUM ('TASK', 'BUG', 'FEATURE', 'STORY', 'EPIC');
  END IF;
END $$;

ALTER TABLE "ProjectTask"
  ADD COLUMN IF NOT EXISTS "type" "ProjectTaskType" NOT NULL DEFAULT 'TASK';
