-- Track linked expense and calendar event IDs on HealthLog
ALTER TABLE "HealthLog" ADD COLUMN "linkedExpenseId" TEXT;
ALTER TABLE "HealthLog" ADD COLUMN "linkedCalendarEventId" TEXT;
