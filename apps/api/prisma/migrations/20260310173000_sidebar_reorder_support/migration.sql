ALTER TABLE "AlertRule"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ScheduledReport"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered_alerts AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" ASC, "id" ASC) - 1 AS rn
  FROM "AlertRule"
)
UPDATE "AlertRule" a
SET "sortOrder" = ordered_alerts.rn
FROM ordered_alerts
WHERE a."id" = ordered_alerts."id";

WITH ordered_reports AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" ASC, "id" ASC) - 1 AS rn
  FROM "ScheduledReport"
)
UPDATE "ScheduledReport" s
SET "sortOrder" = ordered_reports.rn
FROM ordered_reports
WHERE s."id" = ordered_reports."id";
