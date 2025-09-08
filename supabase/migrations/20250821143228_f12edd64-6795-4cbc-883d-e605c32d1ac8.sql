-- Criar política para permitir inserção de mensagens externas do WhatsApp
CREATE POLICY "System can insert external WhatsApp messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  -- Permitir se o from_user_id for um cliente válido E o to_user_id for um admin
  (
    EXISTS (SELECT 1 FROM public.clientes WHERE id = from_user_id::uuid) 
    AND 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = to_user_id AND role = 'admin'::public.app_role)
  )
  OR
  -- Permitir para contatos desconhecidos (from_user_id que começa com 'unknown-')
  (
    from_user_id LIKE 'unknown-%'
    AND 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = to_user_id AND role = 'admin'::public.app_role)
  )
);