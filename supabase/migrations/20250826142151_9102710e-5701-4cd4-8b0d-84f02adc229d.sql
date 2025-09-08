-- Inserir o profile específico que está faltando
INSERT INTO public.profiles (user_id, username, full_name, email, telefone)
VALUES (
  'da83b7d1-5c40-4191-ab8c-ec56571f139e',
  'empresa_teste3',
  'Teste 2',
  'empresateste3@gmail.com',
  '(21) 32131-2312'
)
ON CONFLICT (user_id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  telefone = EXCLUDED.telefone;

-- Atualizar o user_role correspondente
UPDATE public.user_roles 
SET 
  username = 'empresa_teste3',
  telefone = '(21) 32131-2312'
WHERE user_id = 'da83b7d1-5c40-4191-ab8c-ec56571f139e';