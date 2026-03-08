-- AlterEnum
ALTER TYPE "AlertFrequency" ADD VALUE 'MONTHLY';

-- AlterTable
ALTER TABLE "AlertRule"
  ADD COLUMN "dayOfWeek"   INTEGER,
  ADD COLUMN "dayOfMonth"  INTEGER,
  ADD COLUMN "time"        TEXT,
  ADD COLUMN "cooldownHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "lastSentAt"  TIMESTAMP(3);
