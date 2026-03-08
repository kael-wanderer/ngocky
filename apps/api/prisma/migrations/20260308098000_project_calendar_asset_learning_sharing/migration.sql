DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectType') THEN
        CREATE TYPE "ProjectType" AS ENUM ('PERSONAL', 'WORK', 'FOR_FUN', 'STUDY');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RepeatFrequency') THEN
        CREATE TYPE "RepeatFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RepeatEndType') THEN
        CREATE TYPE "RepeatEndType" AS ENUM ('NEVER', 'ON_DATE');
    END IF;
END $$;

ALTER TABLE "Project"
ADD COLUMN IF NOT EXISTS "type" "ProjectType" NOT NULL DEFAULT 'PERSONAL';

ALTER TABLE "LearningTopic"
ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "IdeaTopic"
ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Asset"
ADD COLUMN IF NOT EXISTS "warrantyMonths" INTEGER,
ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CalendarEvent"
ADD COLUMN IF NOT EXISTS "repeatFrequency" "RepeatFrequency",
ADD COLUMN IF NOT EXISTS "repeatEndType" "RepeatEndType",
ADD COLUMN IF NOT EXISTS "repeatUntil" TIMESTAMP(3);
