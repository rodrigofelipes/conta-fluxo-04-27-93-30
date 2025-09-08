-- Verificar se o trigger auto_sync_users existe e está ativo
SELECT 
  tgname as trigger_name,
  tgtype as trigger_type,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass;

-- Verificar se a função auto_sync_users existe
SELECT proname, prosrc FROM pg_proc WHERE proname = 'auto_sync_users';

-- Criar/Recriar o trigger para auth.users para garantir sincronização automática
DROP TRIGGER IF EXISTS auto_sync_users_trigger ON auth.users;

CREATE TRIGGER auto_sync_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_sync_users();

-- Executar sincronização manual para usuários existentes que podem estar faltando
INSERT INTO public.user_roles (user_id, role, username, telefone)
SELECT 
  au.id,
  CASE 
    WHEN au.raw_user_meta_data->>'created_by_admin' = 'true' THEN 'user'::public.app_role
    ELSE 'admin'::public.app_role
  END as role,
  COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)) as username,
  au.raw_user_meta_data ->> 'telefone' as telefone
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Verificar resultado da sincronização
SELECT 
  COUNT(*) as total_auth_users,
  (SELECT COUNT(*) FROM public.user_roles) as total_user_roles,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles
FROM auth.users;