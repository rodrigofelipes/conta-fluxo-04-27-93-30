-- Corrigir política RLS para tasks_new para clientes
-- A política atual falha quando há múltiplos profiles com dados similares

DROP POLICY IF EXISTS "Clients can view their tasks via clientes table" ON tasks_new;

CREATE POLICY "Clients can view their tasks via clientes table" 
ON tasks_new FOR SELECT 
USING (
  client_id IN (
    SELECT c.id
    FROM clientes c
    JOIN profiles p ON (
      (c.email IS NOT NULL AND c.email = p.email) OR 
      (c.telefone IS NOT NULL AND c.telefone = p.telefone)
    )
    WHERE p.user_id = auth.uid()
  )
);