DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Theme' AND e.enumlabel = 'DARK'
  ) THEN
    ALTER TYPE "Theme" ADD VALUE 'DARK';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Theme' AND e.enumlabel = 'MODERN_GREEN'
  ) THEN
    ALTER TYPE "Theme" ADD VALUE 'MODERN_GREEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Theme' AND e.enumlabel = 'MULTI_COLOR_BLOCK'
  ) THEN
    ALTER TYPE "Theme" ADD VALUE 'MULTI_COLOR_BLOCK';
  END IF;
END $$;
