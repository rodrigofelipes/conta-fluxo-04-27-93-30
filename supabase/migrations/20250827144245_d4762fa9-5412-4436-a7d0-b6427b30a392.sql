-- Update RLS policy for clients to view tasks through the clientes relationship
DROP POLICY IF EXISTS "Clients can view their own tasks" ON tasks_new;

CREATE POLICY "Clients can view their tasks via clientes table"
ON tasks_new
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id
    FROM clientes c
    JOIN profiles p ON (c.email = p.email OR c.telefone = p.telefone)
    WHERE p.user_id = auth.uid()
  )
);