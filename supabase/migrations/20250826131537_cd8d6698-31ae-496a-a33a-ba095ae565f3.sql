-- Primeiro, limpar dados órfãos existentes
DELETE FROM user_roles 
WHERE user_id NOT IN (SELECT user_id FROM profiles);

-- Criar trigger para limpar user_roles automaticamente quando um profile é deletado
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

-- Criar o trigger na tabela profiles
DROP TRIGGER IF EXISTS cleanup_user_roles_on_profile_delete ON profiles;
CREATE TRIGGER cleanup_user_roles_on_profile_delete
  AFTER DELETE ON profiles
  FOR EACH ROW 
  EXECUTE FUNCTION public.cleanup_user_roles_on_profile_delete();

-- Atualizar a função de limpeza de dados órfãos para ser mais abrangente
CREATE OR REPLACE FUNCTION public.cleanup_orphan_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Remover user_roles sem profile correspondente
  DELETE FROM public.user_roles ur
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = ur.user_id
  );

  -- Remover admin_setores sem profile correspondente
  DELETE FROM public.admin_setores asec
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = asec.user_id
  );

  -- Remover master_admins sem profile correspondente
  DELETE FROM public.master_admins ma
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = ma.user_id
  );

  -- Remover profiles sem usuário correspondente no auth
  DELETE FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p.user_id
  );
  
  RAISE NOTICE 'Limpeza de dados órfãos concluída';
END;
$function$;