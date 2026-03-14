-- Rename nationality to mobile
ALTER TABLE "HealthPerson" RENAME COLUMN "nationality" TO "mobile";

-- Add personalId and passportNumber
ALTER TABLE "HealthPerson" ADD COLUMN "personalId" TEXT;
ALTER TABLE "HealthPerson" ADD COLUMN "passportNumber" TEXT;
