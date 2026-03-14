-- Remove organDonor
ALTER TABLE "HealthPerson" DROP COLUMN "organDonor";

-- Add idIssueDate and passportIssueDate
ALTER TABLE "HealthPerson" ADD COLUMN "idIssueDate" TIMESTAMP(3);
ALTER TABLE "HealthPerson" ADD COLUMN "passportIssueDate" TIMESTAMP(3);

-- Add Work Insurance fields
ALTER TABLE "HealthPerson" ADD COLUMN "workInsuranceProvider" TEXT;
ALTER TABLE "HealthPerson" ADD COLUMN "workInsuranceCardNo" TEXT;
ALTER TABLE "HealthPerson" ADD COLUMN "workInsurancePolicyHolder" TEXT;
ALTER TABLE "HealthPerson" ADD COLUMN "workInsuranceId" TEXT;
ALTER TABLE "HealthPerson" ADD COLUMN "workInsuranceValidFrom" TIMESTAMP(3);
