-- Verificar e corrigir a política RLS com debug
-- Vamos criar uma versão mais explícita da política

DROP POLICY IF EXISTS "Clients can view their tasks via clientes table" ON tasks_new;

-- Criar uma política mais simples para debug
CREATE POLICY "Clients can view their tasks via clientes table" 
ON tasks_new FOR SELECT 
USING (
  client_id IN (
    SELECT c.id
    FROM clientes c
    WHERE c.email IN (
      SELECT p.email 
      FROM profiles p 
      WHERE p.user_id = auth.uid()
        AND p.email IS NOT NULL
        AND c.email IS NOT NULL
    )
    OR c.telefone IN (
      SELECT p.telefone 
      FROM profiles p 
      WHERE p.user_id = auth.uid()
        AND p.telefone IS NOT NULL  
        AND c.telefone IS NOT NULL
    )
  )
);