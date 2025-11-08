-- Align payment_links schema with edge function fields
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checkout_url TEXT; -- idempotent safeguard

-- Optional: keep legacy columns if they exist for compatibility; no action needed

-- Ensure updated_at trigger exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payment_links_updated_at'
  ) THEN
    CREATE TRIGGER update_payment_links_updated_at
      BEFORE UPDATE ON public.payment_links
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;