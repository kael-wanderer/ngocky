ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LearningTopic" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IdeaTopic" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MaintenanceRecord" ADD COLUMN IF NOT EXISTS "linkedEventId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceRecord_linkedEventId_key" ON "MaintenanceRecord"("linkedEventId");

DO $$ BEGIN
    ALTER TABLE "MaintenanceRecord"
    ADD CONSTRAINT "MaintenanceRecord_linkedEventId_fkey"
    FOREIGN KEY ("linkedEventId") REFERENCES "CalendarEvent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
