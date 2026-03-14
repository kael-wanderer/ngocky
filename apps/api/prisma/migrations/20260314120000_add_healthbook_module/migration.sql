-- CreateEnum
CREATE TYPE "HealthLogType" AS ENUM ('REGULAR_CHECKUP', 'DOCTOR_VISIT', 'EMERGENCY', 'VACCINATION', 'PRESCRIPTION', 'LAB_RESULT', 'OTHER');

-- AlterTable: add featureHealthbook to User
ALTER TABLE "User" ADD COLUMN "featureHealthbook" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: HealthPerson
CREATE TABLE "HealthPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "nationality" TEXT,
    "bloodType" TEXT,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "currentMedications" TEXT,
    "organDonor" BOOLEAN NOT NULL DEFAULT false,
    "emergencyContact1Name" TEXT,
    "emergencyContact1Phone" TEXT,
    "emergencyContact1Relationship" TEXT,
    "emergencyContact2Name" TEXT,
    "emergencyContact2Phone" TEXT,
    "emergencyContact2Relationship" TEXT,
    "insuranceProvider" TEXT,
    "insuranceCardNumber" TEXT,
    "policyNumber" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "coverageType" TEXT,
    "notes" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable: HealthLog
CREATE TABLE "HealthLog" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "HealthLogType" NOT NULL DEFAULT 'DOCTOR_VISIT',
    "location" TEXT,
    "doctor" TEXT,
    "symptoms" TEXT,
    "description" TEXT,
    "cost" DOUBLE PRECISION,
    "prescription" TEXT,
    "nextCheckupDate" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: HealthPersonFile
CREATE TABLE "HealthPersonFile" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthPersonFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: HealthLogFile
CREATE TABLE "HealthLogFile" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthLogFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthPerson_userId_idx" ON "HealthPerson"("userId");

-- CreateIndex
CREATE INDEX "HealthLog_personId_idx" ON "HealthLog"("personId");
CREATE INDEX "HealthLog_userId_idx" ON "HealthLog"("userId");
CREATE INDEX "HealthLog_date_idx" ON "HealthLog"("date");

-- CreateIndex
CREATE INDEX "HealthPersonFile_personId_idx" ON "HealthPersonFile"("personId");

-- CreateIndex
CREATE INDEX "HealthLogFile_logId_idx" ON "HealthLogFile"("logId");

-- AddForeignKey
ALTER TABLE "HealthPerson" ADD CONSTRAINT "HealthPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthLog" ADD CONSTRAINT "HealthLog_personId_fkey" FOREIGN KEY ("personId") REFERENCES "HealthPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthLog" ADD CONSTRAINT "HealthLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthPersonFile" ADD CONSTRAINT "HealthPersonFile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "HealthPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthLogFile" ADD CONSTRAINT "HealthLogFile_logId_fkey" FOREIGN KEY ("logId") REFERENCES "HealthLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
