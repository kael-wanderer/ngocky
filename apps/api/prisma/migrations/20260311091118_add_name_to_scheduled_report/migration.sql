ALTER TABLE "ScheduledReport"
ADD COLUMN "name" TEXT;

UPDATE "ScheduledReport"
SET "name" = CASE
  WHEN "reportType" = 'WEEKLY_SUMMARY' OR "reportType" = 'SUMMARY' THEN 'Weekly Summary'
  WHEN "reportType" = 'NEXT_WEEK_TASKS' THEN 'Next Week Tasks'
  WHEN "reportType" = 'TODAY_TASKS' THEN 'Today Tasks'
  WHEN "reportType" = 'TOMORROW_TASKS' THEN 'Tomorrow Tasks'
  ELSE COALESCE(NULLIF("reportType", ''), 'Action')
END
WHERE "name" IS NULL;

ALTER TABLE "ScheduledReport"
ALTER COLUMN "name" SET NOT NULL;
