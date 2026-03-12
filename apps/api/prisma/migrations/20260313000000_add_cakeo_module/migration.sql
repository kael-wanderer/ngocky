-- Add featureCaKeo to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "featureCaKeo" BOOLEAN NOT NULL DEFAULT true;

-- Create CaKeo table
CREATE TABLE IF NOT EXISTS "CaKeo" (
    "id"                      TEXT NOT NULL,
    "title"                   TEXT NOT NULL,
    "description"             TEXT,
    "category"                TEXT,
    "status"                  TEXT NOT NULL DEFAULT 'TODO',
    "assignerId"              TEXT,
    "startDate"               TIMESTAMP(3),
    "endDate"                 TIMESTAMP(3),
    "allDay"                  BOOLEAN NOT NULL DEFAULT false,
    "color"                   TEXT,
    "showOnCalendar"          BOOLEAN NOT NULL DEFAULT true,
    "notificationEnabled"     BOOLEAN NOT NULL DEFAULT false,
    "reminderOffsetValue"     INTEGER,
    "reminderOffsetUnit"      "ReminderUnit",
    "notificationDate"        TIMESTAMP(3),
    "notificationTime"        TEXT,
    "lastNotificationSentAt"  TIMESTAMP(3),
    "notificationCooldownHours" INTEGER NOT NULL DEFAULT 24,
    "isShared"                BOOLEAN NOT NULL DEFAULT true,
    "ownerId"                 TEXT NOT NULL,
    "sortOrder"               INTEGER NOT NULL DEFAULT 0,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaKeo_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CaKeo_ownerId_idx" ON "CaKeo"("ownerId");
CREATE INDEX IF NOT EXISTS "CaKeo_assignerId_idx" ON "CaKeo"("assignerId");
CREATE INDEX IF NOT EXISTS "CaKeo_startDate_idx" ON "CaKeo"("startDate");
CREATE INDEX IF NOT EXISTS "CaKeo_status_idx" ON "CaKeo"("status");

-- Foreign keys
ALTER TABLE "CaKeo" ADD CONSTRAINT "CaKeo_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaKeo" ADD CONSTRAINT "CaKeo_assignerId_fkey"
    FOREIGN KEY ("assignerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
