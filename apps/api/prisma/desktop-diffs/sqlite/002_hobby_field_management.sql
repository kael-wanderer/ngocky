ALTER TABLE "AppSetting" ADD COLUMN "hobbyOptions" JSONB;
UPDATE "FundTransaction" SET "category" = 'Keycap' WHERE "category" = 'KEYCAP';
UPDATE "FundTransaction" SET "category" = 'Kit' WHERE "category" = 'KIT';
UPDATE "FundTransaction" SET "category" = 'Shipping' WHERE "category" = 'SHIPPING';
UPDATE "FundTransaction" SET "category" = 'Accessories' WHERE "category" = 'ACCESSORIES';
UPDATE "FundTransaction" SET "category" = 'Other' WHERE "category" = 'OTHER';
UPDATE "FundTransaction" SET "condition" = 'Used' WHERE "condition" = 'USED';
