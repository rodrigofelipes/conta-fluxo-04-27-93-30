-- Primeiro, vamos criar profiles para usuários que não têm
INSERT INTO public.profiles (user_id, username, full_name, email, telefone)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)),
  au.email,
  au.raw_user_meta_data ->> 'telefone'
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  telefone = EXCLUDED.telefone;

-- Verificar se agora todos os usuários têm profiles
SELECT COUNT(*) as total_users FROM auth.users;
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- Verificar usuários específicos
SELECT au.email, p.username, p.full_name 
FROM auth.users au
JOIN public.profiles p ON au.id = p.user_id
WHERE au.email = 'empresateste@gmail.com';

-- Criar role para usuário se não existir
INSERT INTO public.user_roles (user_id, role, username, telefone)
SELECT 
  au.id,
  CASE 
    WHEN au.raw_user_meta_data->>'created_by_admin' = 'true' THEN 'user'::public.app_role
    ELSE 'admin'::public.app_role
  END,
  COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
  au.raw_user_meta_data ->> 'telefone'
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id) DO UPDATE SET
  username = EXCLUDED.username,
  telefone = EXCLUDED.telefone;