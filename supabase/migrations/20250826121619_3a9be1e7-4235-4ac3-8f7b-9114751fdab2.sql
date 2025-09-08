-- Função para sincronizar auth.users com profiles e user_roles
CREATE OR REPLACE FUNCTION public.sync_auth_users_with_profiles_and_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Inserir perfis faltantes baseados em auth.users
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
  
  -- Inserir roles faltantes (padrão 'user')
  INSERT INTO public.user_roles (user_id, role)  
  SELECT 
    au.id,
    'user'::app_role
  FROM auth.users au
  LEFT JOIN public.user_roles ur ON au.id = ur.user_id
  WHERE ur.user_id IS NULL;
  
  -- Atualizar profiles existentes com dados mais recentes do auth
  UPDATE public.profiles 
  SET 
    email = au.email,
    username = COALESCE(au.raw_user_meta_data ->> 'username', profiles.username),
    full_name = COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', profiles.full_name),
    telefone = COALESCE(au.raw_user_meta_data ->> 'telefone', profiles.telefone),
    updated_at = now()
  FROM auth.users au
  WHERE profiles.user_id = au.id;
  
  -- Log do resultado
  RAISE NOTICE 'Sincronização entre auth.users, profiles e user_roles concluída';
END;
$$;

-- Executar a sincronização
SELECT public.sync_auth_users_with_profiles_and_roles();