-- Inserir todos os admins existentes na admin_setores que ainda não estão lá
INSERT INTO public.admin_setores (user_id, setor)
SELECT ur.user_id, 'CONTABIL'::public.setor
FROM public.user_roles ur
WHERE ur.role = 'admin'::public.app_role
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_setores asec 
    WHERE asec.user_id = ur.user_id
  );

-- Atualizar trigger existente para garantir que novos admins sejam adicionados automaticamente
CREATE OR REPLACE FUNCTION public.auto_add_admin_to_setores()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se o novo role é admin, adicionar à tabela admin_setores
  IF NEW.role = 'admin'::app_role THEN
    INSERT INTO admin_setores (user_id, setor)
    VALUES (NEW.user_id, 'CONTABIL'::setor)
    ON CONFLICT (user_id, setor) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar trigger para INSERT
DROP TRIGGER IF EXISTS auto_add_admin_to_setores_insert ON public.user_roles;
CREATE TRIGGER auto_add_admin_to_setores_insert
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_admin_to_setores();

-- Criar trigger para UPDATE (quando alguém se torna admin)
DROP TRIGGER IF EXISTS auto_add_admin_to_setores_update ON public.user_roles;
CREATE TRIGGER auto_add_admin_to_setores_update
  AFTER UPDATE ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'admin'::public.app_role AND OLD.role != 'admin'::public.app_role)
  EXECUTE FUNCTION public.auto_add_admin_to_setores();

-- Criar função para remover de admin_setores quando role admin for removido
CREATE OR REPLACE FUNCTION public.remove_admin_from_setores()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se o role admin foi removido, remover da tabela admin_setores
  IF OLD.role = 'admin'::app_role AND (NEW.role IS NULL OR NEW.role != 'admin'::app_role) THEN
    DELETE FROM admin_setores 
    WHERE user_id = OLD.user_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger para UPDATE (quando admin perde o role)
DROP TRIGGER IF EXISTS remove_admin_from_setores_update ON public.user_roles;
CREATE TRIGGER remove_admin_from_setores_update
  AFTER UPDATE ON public.user_roles
  FOR EACH ROW
  WHEN (OLD.role = 'admin'::public.app_role AND NEW.role != 'admin'::public.app_role)
  EXECUTE FUNCTION public.remove_admin_from_setores();

-- Trigger para DELETE (quando role admin é deletado)
DROP TRIGGER IF EXISTS remove_admin_from_setores_delete ON public.user_roles;
CREATE TRIGGER remove_admin_from_setores_delete
  AFTER DELETE ON public.user_roles
  FOR EACH ROW
  WHEN (OLD.role = 'admin'::public.app_role)
  EXECUTE FUNCTION public.remove_admin_from_setores();