ALTER TABLE "AppSetting" ADD COLUMN "hobbyOptions" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "FundTransaction" ALTER COLUMN "category" TYPE TEXT USING (
  CASE "category"::text WHEN 'KEYCAP' THEN 'Keycap' WHEN 'KIT' THEN 'Kit' WHEN 'SHIPPING' THEN 'Shipping'
  WHEN 'ACCESSORIES' THEN 'Accessories' WHEN 'OTHER' THEN 'Other' ELSE "category"::text END);
UPDATE "FundTransaction" SET "condition" = 'Used' WHERE "condition" = 'USED';
DROP TYPE "HobbyFundCategory";
