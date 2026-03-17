ALTER TABLE "ProjectTask" ADD COLUMN "cost" INTEGER;
ALTER TABLE "ProjectTask" ADD COLUMN "showOnCalendar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectTask" ADD COLUMN "createExpenseAutomatically" BOOLEAN NOT NULL DEFAULT false;
