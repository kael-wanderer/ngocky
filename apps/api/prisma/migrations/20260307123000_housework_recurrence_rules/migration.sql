-- Add DAILY frequency and rule-based recurrence fields for housework
ALTER TYPE "FrequencyType" ADD VALUE IF NOT EXISTS 'DAILY';

ALTER TABLE "HouseworkItem"
ADD COLUMN IF NOT EXISTS "dayOfWeek" INTEGER,
ADD COLUMN IF NOT EXISTS "dayOfMonth" INTEGER,
ADD COLUMN IF NOT EXISTS "monthOfPeriod" INTEGER,
ADD COLUMN IF NOT EXISTS "monthOfYear" INTEGER;

ALTER TABLE "HouseworkItem"
ADD CONSTRAINT "HouseworkItem_dayOfWeek_check" CHECK ("dayOfWeek" IS NULL OR ("dayOfWeek" >= 1 AND "dayOfWeek" <= 7)),
ADD CONSTRAINT "HouseworkItem_dayOfMonth_check" CHECK ("dayOfMonth" IS NULL OR ("dayOfMonth" >= 1 AND "dayOfMonth" <= 31)),
ADD CONSTRAINT "HouseworkItem_monthOfPeriod_check" CHECK ("monthOfPeriod" IS NULL OR ("monthOfPeriod" >= 1 AND "monthOfPeriod" <= 6)),
ADD CONSTRAINT "HouseworkItem_monthOfYear_check" CHECK ("monthOfYear" IS NULL OR ("monthOfYear" >= 1 AND "monthOfYear" <= 12));
