-- CreateEnum
CREATE TYPE "AssistantChannel" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING_CONFIRMATION', 'CANCELLED');

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "linkCode" TEXT,
    "linkCodeExpiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "AssistantChannel" NOT NULL,
    "externalMessageId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "AssistantChannel" NOT NULL,
    "intent" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "requestPayload" JSONB,
    "resolvedEntities" JSONB,
    "executionStatus" "ExecutionStatus" NOT NULL,
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantPendingAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "AssistantChannel" NOT NULL,
    "intent" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantPendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_userId_key" ON "TelegramLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_telegramChatId_key" ON "TelegramLink"("telegramChatId");

-- CreateIndex
CREATE INDEX "TelegramLink_telegramChatId_idx" ON "TelegramLink"("telegramChatId");

-- CreateIndex
CREATE INDEX "AssistantMessage_userId_idx" ON "AssistantMessage"("userId");

-- CreateIndex
CREATE INDEX "AssistantActionLog_userId_idx" ON "AssistantActionLog"("userId");

-- CreateIndex
CREATE INDEX "AssistantPendingAction_userId_idx" ON "AssistantPendingAction"("userId");

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantActionLog" ADD CONSTRAINT "AssistantActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantPendingAction" ADD CONSTRAINT "AssistantPendingAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
