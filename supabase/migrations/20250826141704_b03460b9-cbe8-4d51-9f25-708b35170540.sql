-- Verificar se o trigger está ativo
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Criar profiles faltantes para usuários existentes
INSERT INTO public.profiles (user_id, username, full_name, email, telefone)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)),
  au.email,
  au.raw_user_meta_data ->> 'telefone'
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL;

-- Atualizar username e telefone nos user_roles com dados dos profiles
UPDATE public.user_roles ur
SET 
  username = p.username,
  telefone = p.telefone
FROM public.profiles p
WHERE ur.user_id = p.user_id
  AND (ur.username IS NULL OR ur.telefone IS NULL);