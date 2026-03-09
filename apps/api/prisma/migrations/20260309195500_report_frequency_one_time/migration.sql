DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ReportFrequency' AND e.enumlabel = 'NONE'
  ) THEN
    ALTER TYPE "ReportFrequency" RENAME VALUE 'NONE' TO 'ONE_TIME';
  END IF;
END $$;
