ALTER TABLE "FundTransaction"
ADD COLUMN "condition" TEXT;

CREATE INDEX "FundTransaction_condition_idx" ON "FundTransaction"("condition");
