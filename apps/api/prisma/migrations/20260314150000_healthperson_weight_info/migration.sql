-- Add weight and info fields to HealthPerson
ALTER TABLE "HealthPerson" ADD COLUMN "weight" DOUBLE PRECISION;
ALTER TABLE "HealthPerson" ADD COLUMN "info" TEXT;
