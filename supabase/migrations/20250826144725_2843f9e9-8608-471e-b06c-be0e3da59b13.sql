-- Criar função para deletar usuário da auth quando profile for removido
CREATE OR REPLACE FUNCTION public.cleanup_auth_user_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Deletar o usuário da auth.users quando profile for removido
  DELETE FROM auth.users WHERE id = OLD.user_id;
  
  RAISE NOTICE 'Usuário % removido automaticamente da auth.users', OLD.user_id;
  RETURN OLD;
END;
$$;

-- Criar função para deletar usuário da auth quando último role for removido
CREATE OR REPLACE FUNCTION public.cleanup_auth_user_on_last_role_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Verificar se este era o último role do usuário
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id) THEN
    -- Se não há mais roles, deletar usuário da auth
    DELETE FROM auth.users WHERE id = OLD.user_id;
    
    RAISE NOTICE 'Usuário % removido automaticamente da auth.users (último role removido)', OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Criar trigger para profile delete
CREATE TRIGGER trigger_cleanup_auth_on_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_auth_user_on_profile_delete();

-- Criar trigger para user_roles delete  
CREATE TRIGGER trigger_cleanup_auth_on_last_role_delete
  AFTER DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_auth_user_on_last_role_delete();

-- Executar limpeza imediata dos usuários órfãos existentes
SELECT public.cleanup_orphan_auth_users();