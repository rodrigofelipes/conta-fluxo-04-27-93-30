-- Desabilitar Row Level Security temporariamente para evitar problemas com triggers
SET session_replication_role = replica;

-- Criar profiles faltantes para usuários sem profile
INSERT INTO public.profiles (user_id, username, full_name, email, telefone, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data ->> 'full_name', split_part(au.email, '@', 1)),
  au.email,
  au.raw_user_meta_data ->> 'telefone',
  now(),
  now()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
);

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- Atualizar user_roles com os dados dos profiles criados
UPDATE public.user_roles ur
SET 
  username = p.username,
  telefone = p.telefone
FROM public.profiles p
WHERE ur.user_id = p.user_id
  AND (ur.username IS NULL OR ur.telefone IS NULL);