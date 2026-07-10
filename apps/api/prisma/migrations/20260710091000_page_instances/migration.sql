CREATE TYPE "PageModuleType" AS ENUM ('TASK', 'PROJECT', 'EXPENSE', 'GOAL');

CREATE TABLE "PageInstance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "moduleType" "PageModuleType" NOT NULL,
    "group" TEXT NOT NULL,
    "icon" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageInstance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Goal" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "Task" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "Project" ADD COLUMN "instanceId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "instanceId" TEXT;

CREATE UNIQUE INDEX "PageInstance_slug_key" ON "PageInstance"("slug");
CREATE INDEX "PageInstance_createdById_idx" ON "PageInstance"("createdById");
CREATE INDEX "PageInstance_group_idx" ON "PageInstance"("group");
CREATE INDEX "PageInstance_moduleType_idx" ON "PageInstance"("moduleType");
CREATE INDEX "Goal_instanceId_idx" ON "Goal"("instanceId");
CREATE INDEX "Task_instanceId_idx" ON "Task"("instanceId");
CREATE INDEX "Project_instanceId_idx" ON "Project"("instanceId");
CREATE INDEX "Expense_instanceId_idx" ON "Expense"("instanceId");

ALTER TABLE "PageInstance" ADD CONSTRAINT "PageInstance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "PageInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
