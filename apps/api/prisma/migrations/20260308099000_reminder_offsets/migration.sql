DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderUnit') THEN
        CREATE TYPE "ReminderUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS');
    END IF;
END $$;

ALTER TABLE "Goal"
ADD COLUMN IF NOT EXISTS "reminderOffsetValue" INTEGER,
ADD COLUMN IF NOT EXISTS "reminderOffsetUnit" "ReminderUnit";

ALTER TABLE "ProjectTask"
ADD COLUMN IF NOT EXISTS "reminderOffsetValue" INTEGER,
ADD COLUMN IF NOT EXISTS "reminderOffsetUnit" "ReminderUnit";

ALTER TABLE "HouseworkItem"
ADD COLUMN IF NOT EXISTS "reminderOffsetValue" INTEGER,
ADD COLUMN IF NOT EXISTS "reminderOffsetUnit" "ReminderUnit";

ALTER TABLE "CalendarEvent"
ADD COLUMN IF NOT EXISTS "notificationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "reminderOffsetValue" INTEGER,
ADD COLUMN IF NOT EXISTS "reminderOffsetUnit" "ReminderUnit";
