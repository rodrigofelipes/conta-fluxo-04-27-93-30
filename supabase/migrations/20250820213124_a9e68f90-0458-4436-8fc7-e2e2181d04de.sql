-- Inserir cliente de teste com telefone 31997810730
INSERT INTO public.clientes (
  nome,
  email,
  telefone,
  setor,
  situacao,
  apelido
) VALUES (
  'Cliente Teste WhatsApp',
  'testecliente@whatsapp.com',
  '31997810730',
  'CONTABIL'::setor,
  'ATIVO',
  'Teste WA'
);

-- Criar perfil para o cliente de teste (necessário para o sistema de mensagens)
INSERT INTO public.profiles (
  user_id,
  username,
  full_name,
  email
) 
SELECT 
  gen_random_uuid() as user_id,
  'testecliente',
  'Cliente Teste WhatsApp',
  'testecliente@whatsapp.com'
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE email = 'testecliente@whatsapp.com'
);

-- Criar role de usuário para o perfil do cliente
INSERT INTO public.user_roles (
  user_id,
  role,
  username
)
SELECT 
  p.user_id,
  'user'::app_role,
  'testecliente'
FROM public.profiles p
WHERE p.email = 'testecliente@whatsapp.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
);