-- Create payment links and transactions tables for integrated payments
CREATE TABLE IF NOT EXISTS public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financial_transaction_id uuid REFERENCES public.client_financials(id) ON DELETE SET NULL,
  installment_id uuid REFERENCES public.payment_installments(id) ON DELETE SET NULL,
  link_token text NOT NULL UNIQUE,
  stripe_checkout_session_id text,
  checkout_url text,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed', 'cancelled')),
  payment_method text,
  expires_at timestamp with time zone NOT NULL,
  accessed_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_by uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  client_financial_id uuid REFERENCES public.client_financials(id) ON DELETE SET NULL,
  installment_id uuid REFERENCES public.payment_installments(id) ON DELETE SET NULL,
  stripe_payment_id text UNIQUE,
  stripe_session_id text,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  payment_method text,
  payment_date timestamp with time zone,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Ensure helper function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Triggers to keep updated_at in sync
CREATE TRIGGER update_payment_links_updated_at
BEFORE UPDATE ON public.payment_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS payment_links_client_idx ON public.payment_links(client_id);
CREATE INDEX IF NOT EXISTS payment_links_status_idx ON public.payment_links(status);
CREATE INDEX IF NOT EXISTS payment_links_financial_idx ON public.payment_links(financial_transaction_id);
CREATE INDEX IF NOT EXISTS payment_links_installment_idx ON public.payment_links(installment_id);

CREATE INDEX IF NOT EXISTS payment_transactions_client_idx ON public.payment_transactions(client_id);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS payment_transactions_link_idx ON public.payment_transactions(payment_link_id);
CREATE INDEX IF NOT EXISTS payment_transactions_financial_idx ON public.payment_transactions(client_financial_id);
CREATE INDEX IF NOT EXISTS payment_transactions_installment_idx ON public.payment_transactions(installment_id);

-- Enable RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for payment_links
CREATE POLICY "Admins manage payment links"
ON public.payment_links
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Creators can view their payment links"
ON public.payment_links
FOR SELECT
USING (auth.uid() = created_by);

-- Policies for payment_transactions
CREATE POLICY "Admins manage payment transactions"
ON public.payment_transactions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Creators can view their payment transactions"
ON public.payment_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.payment_links pl
    WHERE pl.id = payment_link_id
      AND pl.created_by = auth.uid()
  )
);
