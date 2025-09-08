-- Add new enum value 'TODOS' to setor if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'setor' AND e.enumlabel = 'TODOS'
  ) THEN
    ALTER TYPE public.setor ADD VALUE 'TODOS';
  END IF;
END
$$;