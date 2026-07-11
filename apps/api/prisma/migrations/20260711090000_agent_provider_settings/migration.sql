CREATE TYPE "AgentProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'OPENAI_COMPATIBLE');

CREATE TABLE "AgentSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "activeProvider" "AgentProvider" NOT NULL DEFAULT 'OPENAI',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" "AgentProvider" NOT NULL,
    "baseUrl" TEXT,
    "model" TEXT NOT NULL,
    "effort" TEXT NOT NULL DEFAULT 'auto',
    "keyCiphertext" TEXT,
    "keyLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentProviderConfig_provider_key" ON "AgentProviderConfig"("provider");

INSERT INTO "AgentSetting" ("id", "activeProvider", "updatedAt")
VALUES (1, 'OPENAI', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AgentProviderConfig" (
    "id", "provider", "model", "effort", "keyCiphertext", "keyLast4", "createdAt", "updatedAt"
)
SELECT
    'legacy-openai', 'OPENAI', 'gpt-4o-mini', 'auto',
    "openaiKeyCiphertext", "openaiKeyLast4", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "AppSetting"
WHERE "id" = 1 AND "openaiKeyCiphertext" IS NOT NULL
ON CONFLICT ("provider") DO NOTHING;
