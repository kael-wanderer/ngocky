ALTER TYPE "PageModuleType" ADD VALUE 'FOODPLACE';

ALTER TABLE "User" ADD COLUMN "featureFood" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AppSetting"
ADD COLUMN "foodOptions" JSONB NOT NULL DEFAULT '{"tags":[],"types":[],"distances":[]}';

CREATE TABLE "FoodPlace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "type" TEXT,
    "distance" TEXT,
    "rating" INTEGER,
    "mapLink" TEXT,
    "note" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "instanceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodPlace_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FoodPlace_ownerId_idx" ON "FoodPlace"("ownerId");
CREATE INDEX "FoodPlace_instanceId_idx" ON "FoodPlace"("instanceId");

ALTER TABLE "FoodPlace"
ADD CONSTRAINT "FoodPlace_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodPlace"
ADD CONSTRAINT "FoodPlace_instanceId_fkey"
FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
