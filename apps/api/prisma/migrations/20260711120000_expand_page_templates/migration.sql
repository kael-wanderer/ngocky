ALTER TYPE "PageModuleType" ADD VALUE 'IDEA';
ALTER TYPE "PageModuleType" ADD VALUE 'CALENDAR';
ALTER TYPE "PageModuleType" ADD VALUE 'CAKEO';
ALTER TYPE "PageModuleType" ADD VALUE 'HOUSEWORK';
ALTER TYPE "PageModuleType" ADD VALUE 'ASSET';
ALTER TYPE "PageModuleType" ADD VALUE 'HEALTHBOOK';
ALTER TYPE "PageModuleType" ADD VALUE 'KEYBOARD';
ALTER TYPE "PageModuleType" ADD VALUE 'FUND';
ALTER TYPE "PageModuleType" ADD VALUE 'LEARNING';

ALTER TABLE "PageInstance" DROP CONSTRAINT "PageInstance_createdById_fkey";
ALTER TABLE "PageInstance" ADD CONSTRAINT "PageInstance_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdeaTopic" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "CaKeo" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "HouseworkItem" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "HealthPerson" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "Keyboard" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "FundTransaction" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "LearningTopic" ADD COLUMN "instanceId" TEXT;

ALTER TABLE "IdeaTopic" ADD CONSTRAINT "IdeaTopic_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaKeo" ADD CONSTRAINT "CaKeo_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseworkItem" ADD CONSTRAINT "HouseworkItem_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthPerson" ADD CONSTRAINT "HealthPerson_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Keyboard" ADD CONSTRAINT "Keyboard_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningTopic" ADD CONSTRAINT "LearningTopic_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "IdeaTopic_instanceId_idx" ON "IdeaTopic"("instanceId");
CREATE INDEX "CalendarEvent_instanceId_idx" ON "CalendarEvent"("instanceId");
CREATE INDEX "CaKeo_instanceId_idx" ON "CaKeo"("instanceId");
CREATE INDEX "HouseworkItem_instanceId_idx" ON "HouseworkItem"("instanceId");
CREATE INDEX "Asset_instanceId_idx" ON "Asset"("instanceId");
CREATE INDEX "HealthPerson_instanceId_idx" ON "HealthPerson"("instanceId");
CREATE INDEX "Keyboard_instanceId_idx" ON "Keyboard"("instanceId");
CREATE INDEX "FundTransaction_instanceId_idx" ON "FundTransaction"("instanceId");
CREATE INDEX "LearningTopic_instanceId_idx" ON "LearningTopic"("instanceId");
