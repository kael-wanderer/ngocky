-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProjectBoardStatus" AS ENUM ('PLAN', 'WORKING', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "boardStatus" "ProjectBoardStatus" NOT NULL DEFAULT 'PLAN';
