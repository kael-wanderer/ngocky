CREATE TYPE "ColorSettingModule" AS ENUM ('CAKEO');

CREATE TYPE "ColorSettingScope" AS ENUM ('ASSIGNEE');

CREATE TABLE "ModuleColorSetting" (
    "id" TEXT NOT NULL,
    "module" "ColorSettingModule" NOT NULL,
    "scope" "ColorSettingScope" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleColorSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleColorSetting_module_scope_entityKey_key"
ON "ModuleColorSetting"("module", "scope", "entityKey");

CREATE UNIQUE INDEX "ModuleColorSetting_module_scope_color_key"
ON "ModuleColorSetting"("module", "scope", "color");

CREATE INDEX "ModuleColorSetting_module_scope_idx"
ON "ModuleColorSetting"("module", "scope");
