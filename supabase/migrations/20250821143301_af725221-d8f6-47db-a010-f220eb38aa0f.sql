-- Criar política para permitir inserção de mensagens externas do sistema (webhook WhatsApp)
CREATE POLICY "System can insert external messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  -- Permitir inserção sem autenticação se for mensagem externa válida
  auth.uid() IS NULL 
  AND 
  (
    -- from_user_id é um cliente válido OU contém 'unknown' no texto
    EXISTS (SELECT 1 FROM public.clientes WHERE id::text = from_user_id) 
    OR 
    from_user_name ILIKE '%WhatsApp%'
    OR 
    from_user_name ILIKE '%Contato Desconhecido%'
  )
  AND 
  -- to_user_id deve ser um admin válido
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id::text = to_user_id AND role = 'admin'::public.app_role)
);