ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "mobileNavItems" JSONB NOT NULL DEFAULT '["/","/goals","/tasks","/calendar","/settings"]';
