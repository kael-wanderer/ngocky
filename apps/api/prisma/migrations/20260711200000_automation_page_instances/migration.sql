ALTER TABLE "AlertRule" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "ScheduledReport" ADD COLUMN "instanceId" TEXT;

CREATE INDEX "AlertRule_instanceId_idx" ON "AlertRule"("instanceId");
CREATE INDEX "ScheduledReport_instanceId_idx" ON "ScheduledReport"("instanceId");

ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
