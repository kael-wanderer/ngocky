-- AlterTable
ALTER TABLE "MaintenanceRecord" ADD COLUMN "kilometers" INTEGER,
ADD COLUMN "notificationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminderOffsetValue" INTEGER,
ADD COLUMN "reminderOffsetUnit" "ReminderUnit";
