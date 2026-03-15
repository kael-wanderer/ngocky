-- Add notification fields to HealthLog
ALTER TABLE "HealthLog" ADD COLUMN "notificationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HealthLog" ADD COLUMN "reminderOffsetValue" INTEGER;
ALTER TABLE "HealthLog" ADD COLUMN "reminderOffsetUnit" "ReminderUnit";
ALTER TABLE "HealthLog" ADD COLUMN "notificationDate" TIMESTAMP(3);
ALTER TABLE "HealthLog" ADD COLUMN "notificationTime" TEXT;
ALTER TABLE "HealthLog" ADD COLUMN "lastNotificationSentAt" TIMESTAMP(3);
ALTER TABLE "HealthLog" ADD COLUMN "notificationCooldownHours" INTEGER NOT NULL DEFAULT 24;
