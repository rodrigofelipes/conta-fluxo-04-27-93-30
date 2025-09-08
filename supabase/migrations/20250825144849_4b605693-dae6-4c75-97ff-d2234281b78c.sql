-- Verificar e ajustar RLS policies para permitir real-time updates
-- Remover política restritiva que pode estar bloqueando real-time
DROP POLICY IF EXISTS "System can insert external messages" ON public.messages;

-- Criar nova política mais permissiva para mensagens externas
CREATE POLICY "Allow external messages for real-time" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  -- Permitir inserção se:
  -- 1. É o próprio usuário inserindo (autenticado)
  (auth.uid() = from_user_id) 
  OR 
  -- 2. É uma mensagem externa (não autenticada) direcionada a um admin
  (
    auth.uid() IS NULL 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = messages.to_user_id 
      AND role = 'admin'::app_role
    )
  )
);

-- Política específica para real-time: permitir que o sistema veja todas as mensagens para admin
CREATE POLICY "Admin can see all messages for real-time" 
ON public.messages 
FOR SELECT 
USING (
  -- Admin pode ver mensagens onde ele é o remetente ou destinatário
  (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  OR
  -- Admin pode ver mensagens direcionadas a qualquer admin (para real-time)
  (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'::app_role)
    AND to_user_id IN (SELECT user_id FROM user_roles WHERE role = 'admin'::app_role)
  )
);