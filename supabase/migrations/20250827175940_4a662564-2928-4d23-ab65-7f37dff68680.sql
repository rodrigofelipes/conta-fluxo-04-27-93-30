-- Corrigir a política RLS para clientes visualizarem suas tarefas
-- A política atual está muito restritiva

DROP POLICY IF EXISTS "Clients can view their tasks via clientes table" ON tasks_new;

CREATE POLICY "Clients can view their tasks via clientes table" 
ON tasks_new 
FOR SELECT 
USING (
  client_id IN (
    SELECT c.id
    FROM clientes c
    WHERE (
      -- Match por email quando ambos têm email
      (c.email IS NOT NULL AND EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.user_id = auth.uid() 
          AND p.email IS NOT NULL 
          AND c.email = p.email
      ))
      OR
      -- Match por telefone quando ambos têm telefone  
      (c.telefone IS NOT NULL AND EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.user_id = auth.uid() 
          AND p.telefone IS NOT NULL 
          AND c.telefone = p.telefone
      ))
    )
  )
);