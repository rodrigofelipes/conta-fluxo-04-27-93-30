-- Drop the incorrect policy for users viewing tasks
DROP POLICY IF EXISTS "Users can view tasks assigned to their clients" ON tasks;

-- Create a correct policy for users to view tasks for their client profile
-- This assumes that users should see tasks where the client email/phone matches their profile
CREATE POLICY "Users can view tasks for their associated client" 
ON tasks FOR SELECT 
TO authenticated 
USING (
  client_id IN (
    SELECT c.id 
    FROM clientes c 
    INNER JOIN profiles p ON (c.email = p.email OR c.telefone = p.telefone)
    WHERE p.user_id = auth.uid()
  )
);