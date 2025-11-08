-- Adjust payment_links schema to match edge function expectations
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS checkout_url TEXT;

-- Remove overly strict constraint to allow custom links without references
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_has_reference' 
      AND table_name = 'payment_links'
  ) THEN
    ALTER TABLE public.payment_links DROP CONSTRAINT check_has_reference;
  END IF;
END $$;