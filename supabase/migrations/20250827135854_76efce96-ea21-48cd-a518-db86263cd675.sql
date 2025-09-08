-- Try to fix any remaining custom functions that might still need search_path
-- This targets any remaining functions that are user-created (not system functions)

-- Update any remaining functions that we can control
CREATE OR REPLACE FUNCTION public.sync_auth_users_with_profiles_and_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Inserir roles faltantes (padrão 'user') - ONLY ONE ROLE PER USER
  INSERT INTO public.user_roles (user_id, role)  
  SELECT 
    au.id,
    CASE 
      WHEN au.raw_user_meta_data->>'created_by_admin' = 'true' THEN 'user'::app_role
      ELSE 'user'::app_role
    END
  FROM auth.users au
  LEFT JOIN public.user_roles ur ON au.id = ur.user_id
  WHERE ur.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
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
  RAISE NOTICE 'Sincronização entre auth.users, profiles e user_roles concluída - sem duplicatas';
END;
$function$;

-- Update another function that might need search_path
CREATE OR REPLACE FUNCTION public.cleanup_user_roles_on_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Deletar roles associados ao profile que foi removido
  DELETE FROM user_roles WHERE user_id = OLD.user_id;
  
  -- Deletar também de admin_setores se existir
  DELETE FROM admin_setores WHERE user_id = OLD.user_id;
  
  RAISE NOTICE 'Limpeza automática: removidos roles e setores para user_id: %', OLD.user_id;
  RETURN OLD;
END;
$function$;