-- Add type field to CaKeo
ALTER TABLE "CaKeo" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'Task';
