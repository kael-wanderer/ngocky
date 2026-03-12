-- CreateEnum
CREATE TYPE "ExpensePayment" AS ENUM ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD');

-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN "payment" "ExpensePayment" NOT NULL DEFAULT 'CASH';
