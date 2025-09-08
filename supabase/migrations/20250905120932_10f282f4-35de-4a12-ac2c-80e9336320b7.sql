DO $$
BEGIN
  -- Drop view public.users if it exists
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_views 
    WHERE schemaname = 'public' AND viewname = 'users'
  ) THEN
    EXECUTE 'DROP VIEW IF EXISTS public.users CASCADE';
  END IF;

  -- Drop table public.users if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    -- Ensure it's a BASE TABLE (not a view)
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r'
    ) THEN
      EXECUTE 'DROP TABLE IF EXISTS public.users CASCADE';
    END IF;
  END IF;
END $$;