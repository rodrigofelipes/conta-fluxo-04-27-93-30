-- Criar tabela payment_transactions
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id UUID REFERENCES payment_links(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  client_financial_id UUID REFERENCES client_financials(id),
  installment_id UUID REFERENCES payment_installments(id),
  
  -- Dados do Stripe
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  
  -- Detalhes da transação
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_date TIMESTAMPTZ,
  
  -- Controle de erros
  error_message TEXT,
  
  -- Metadados
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_link ON payment_transactions(payment_link_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_client ON payment_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_payment ON payment_transactions(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- RLS para payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all transactions"
  ON payment_transactions FOR SELECT
  USING (is_admin() OR is_master_admin());

CREATE POLICY "System can manage transactions"
  ON payment_transactions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Corrigir payment_links.created_by
ALTER TABLE payment_links 
  DROP CONSTRAINT IF EXISTS payment_links_created_by_fkey;

ALTER TABLE payment_links 
  ALTER COLUMN created_by DROP NOT NULL;

-- Adicionar coluna accessed_at
ALTER TABLE payment_links 
  ADD COLUMN IF NOT EXISTS accessed_at TIMESTAMPTZ;

-- Trigger para updated_at em payment_transactions
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();