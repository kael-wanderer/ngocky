-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('PAY', 'RECEIVE');

-- AlterEnum
ALTER TYPE "ExpenseScope" ADD VALUE IF NOT EXISTS 'KEO';
ALTER TYPE "ExpenseScope" ADD VALUE IF NOT EXISTS 'PROJECT';

-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN "type" "ExpenseType" NOT NULL DEFAULT 'PAY';

