ALTER TABLE "HouseworkItem"
ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN "showOnCalendar" BOOLEAN NOT NULL DEFAULT false;
