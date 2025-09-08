-- Função para limpar usuários órfãos da auth que não existem em profiles e user_roles
CREATE OR REPLACE FUNCTION public.cleanup_orphan_auth_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Excluir usuários da auth.users que não existem em profiles E user_roles
  DELETE FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id
  );
  
  RAISE NOTICE 'Limpeza de usuários órfãos da auth concluída';
END;
$function$;

-- Função para garantir sincronização bidirecional
CREATE OR REPLACE FUNCTION public.sync_auth_with_app_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- 1. Limpar usuários órfãos da auth
  PERFORM public.cleanup_orphan_auth_users();
  
  -- 2. Limpar dados órfãos das tabelas da aplicação
  PERFORM public.cleanup_orphan_user_data();
  
  -- 3. Sincronizar dados restantes
  PERFORM public.sync_auth_users_with_profiles_and_roles();
  
  RAISE NOTICE 'Sincronização bidirecional concluída';
END;
$function$;

-- Executar a sincronização inicial
SELECT public.sync_auth_with_app_tables();