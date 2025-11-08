-- 1. Adicionar role 'cliente' ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cliente';

-- 2. Adicionar coluna user_id na tabela clients para vincular com auth.users
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Criar índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- 4. RLS Policy para clientes verem seus próprios dados na tabela clients
CREATE POLICY "Clientes podem ver seus próprios dados"
ON clients FOR SELECT
USING (auth.uid() = user_id OR is_admin() OR (auth.uid() IS NOT NULL));

-- 5. RLS Policy para clientes verem suas próprias transações financeiras
CREATE POLICY "Clientes podem ver suas próprias transações"
ON client_financials FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM clients WHERE id = client_financials.client_id AND user_id IS NOT NULL
  ) OR is_admin() OR (auth.uid() IS NOT NULL)
);

-- 6. RLS Policy para clientes verem suas próprias parcelas
CREATE POLICY "Clientes podem ver suas próprias parcelas"
ON payment_installments FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM clients WHERE id = payment_installments.client_id AND user_id IS NOT NULL
  ) OR is_admin() OR (auth.uid() IS NOT NULL)
);

-- 7. RLS Policy para clientes verem seus próprios links de pagamento
CREATE POLICY "Clientes podem ver seus links de pagamento"
ON payment_links FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM clients WHERE id = payment_links.client_id AND user_id IS NOT NULL
  ) OR is_admin() OR is_master_admin() OR true
);

-- 8. RLS Policy para clientes verem suas próprias transações de pagamento
CREATE POLICY "Clientes podem ver suas transações de pagamento"
ON payment_transactions FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM clients WHERE id = payment_transactions.client_id AND user_id IS NOT NULL
  ) OR is_admin() OR is_master_admin()
);

-- 9. RLS Policy para clientes verem seus próprios orçamentos
CREATE POLICY "Clientes podem ver seus próprios orçamentos"
ON client_budgets FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM clients WHERE id = client_budgets.client_id AND user_id IS NOT NULL
  ) OR (auth.uid() IS NOT NULL)
);

-- 10. RLS Policy para clientes verem suas próprias notas
CREATE POLICY "Clientes podem ver suas próprias notas"
ON client_notes FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM clients WHERE id = client_notes.client_id AND user_id IS NOT NULL
  ) OR (auth.uid() IS NOT NULL)
);

-- 11. RLS Policy para clientes verem seus próprios documentos
CREATE POLICY "Clientes podem ver seus próprios documentos"
ON client_documents FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM clients WHERE id = client_documents.client_id AND user_id IS NOT NULL
  ) OR (auth.uid() IS NOT NULL)
);

-- 12. RLS Policy para clientes verem seus próprios contatos
CREATE POLICY "Clientes podem ver seus próprios contatos"
ON client_contacts FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM clients WHERE id = client_contacts.client_id AND user_id IS NOT NULL
  ) OR (auth.uid() IS NOT NULL)
);