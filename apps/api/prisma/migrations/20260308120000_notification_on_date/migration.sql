-- Add ON_DATE value to ReminderUnit enum
ALTER TYPE "ReminderUnit" ADD VALUE IF NOT EXISTS 'ON_DATE';

-- Add notificationDate to all notification-enabled models
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "notificationDate" TIMESTAMP(3);
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "notificationDate" TIMESTAMP(3);
ALTER TABLE "HouseworkItem" ADD COLUMN IF NOT EXISTS "notificationDate" TIMESTAMP(3);
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "notificationDate" TIMESTAMP(3);
ALTER TABLE "MaintenanceRecord" ADD COLUMN IF NOT EXISTS "notificationDate" TIMESTAMP(3);
