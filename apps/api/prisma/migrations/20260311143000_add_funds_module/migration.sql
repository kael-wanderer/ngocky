CREATE TYPE "HobbyFundType" AS ENUM ('BUY', 'SELL', 'TOP_UP');

CREATE TYPE "HobbyFundScope" AS ENUM ('MECHANICAL_KEYBOARD', 'PLAY_STATION');

CREATE TYPE "HobbyFundCategory" AS ENUM ('KEYCAP', 'KIT', 'SHIPPING', 'ACCESSORIES');

ALTER TABLE "User"
ADD COLUMN "featureFunds" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "FundTransaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "HobbyFundType" NOT NULL,
    "scope" "HobbyFundScope" NOT NULL,
    "category" "HobbyFundCategory" NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FundTransaction_userId_idx" ON "FundTransaction"("userId");
CREATE INDEX "FundTransaction_date_idx" ON "FundTransaction"("date");
CREATE INDEX "FundTransaction_type_idx" ON "FundTransaction"("type");
CREATE INDEX "FundTransaction_scope_idx" ON "FundTransaction"("scope");
CREATE INDEX "FundTransaction_category_idx" ON "FundTransaction"("category");

ALTER TABLE "FundTransaction"
ADD CONSTRAINT "FundTransaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
