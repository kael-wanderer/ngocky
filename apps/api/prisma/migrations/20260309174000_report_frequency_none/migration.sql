DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ReportFrequency' AND e.enumlabel = 'NONE'
  ) THEN
    ALTER TYPE "ReportFrequency" ADD VALUE 'NONE';
  END IF;
END $$;
