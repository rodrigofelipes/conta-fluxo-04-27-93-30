-- Criar função de debug para testar auth.uid()
CREATE OR REPLACE FUNCTION debug_auth_context()
RETURNS TABLE(
  current_user_id uuid,
  current_user_email text,
  has_profile boolean,
  matching_client_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    (SELECT email FROM profiles WHERE user_id = auth.uid()) as current_user_email,
    EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid()) as has_profile,
    (SELECT c.id FROM clientes c JOIN profiles p ON c.email = p.email WHERE p.user_id = auth.uid() LIMIT 1) as matching_client_id;
END;
$$;