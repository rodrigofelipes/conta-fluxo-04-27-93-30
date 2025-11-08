-- Criar tabela payment_links
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  financial_transaction_id UUID REFERENCES client_financials(id) ON DELETE SET NULL,
  installment_id UUID REFERENCES payment_installments(id) ON DELETE SET NULL,
  
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  
  link_token TEXT NOT NULL UNIQUE,
  stripe_session_id TEXT,
  stripe_checkout_url TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'expired', 'cancelled'
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT check_has_reference CHECK (
    financial_transaction_id IS NOT NULL OR installment_id IS NOT NULL
  )
);

-- Índices para performance
CREATE INDEX idx_payment_links_client ON payment_links(client_id);
CREATE INDEX idx_payment_links_token ON payment_links(link_token);
CREATE INDEX idx_payment_links_status ON payment_links(status);
CREATE INDEX idx_payment_links_expires ON payment_links(expires_at);

-- RLS
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can view all payment links"
  ON payment_links FOR SELECT
  USING (is_admin() OR is_master_admin());

CREATE POLICY "Admins can create payment links"
  ON payment_links FOR INSERT
  WITH CHECK (is_admin() OR is_master_admin());

CREATE POLICY "Admins can update payment links"
  ON payment_links FOR UPDATE
  USING (is_admin() OR is_master_admin())
  WITH CHECK (is_admin() OR is_master_admin());

-- Público pode visualizar link pelo token (para pagamento)
CREATE POLICY "Public can view payment link by token"
  ON payment_links FOR SELECT
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_payment_links_updated_at
  BEFORE UPDATE ON payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();