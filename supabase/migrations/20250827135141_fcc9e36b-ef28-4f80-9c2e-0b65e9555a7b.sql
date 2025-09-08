-- Fix remaining functions that may not have search_path set properly

-- Update more functions with proper search_path
CREATE OR REPLACE FUNCTION public.remove_admin_from_setores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o role admin foi removido, remover da tabela admin_setores
  IF OLD.role = 'admin'::app_role AND (NEW.role IS NULL OR NEW.role != 'admin'::app_role) THEN
    DELETE FROM admin_setores 
    WHERE user_id = OLD.user_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_add_admin_to_setores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_username text;
BEGIN
  -- Se o novo role é admin, adicionar à tabela admin_setores
  IF NEW.role = 'admin'::app_role THEN
    -- Buscar username do usuário
    SELECT username INTO user_username 
    FROM profiles 
    WHERE user_id = NEW.user_id;
    
    INSERT INTO admin_setores (user_id, setor, username)
    VALUES (NEW.user_id, 'TODOS'::setor, user_username)
    ON CONFLICT (user_id, setor) DO UPDATE SET username = user_username;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_delete_profile_on_role_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se restam outros roles para este usuário
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = OLD.user_id) THEN
    -- Se não há mais roles, deletar o profile
    DELETE FROM profiles WHERE user_id = OLD.user_id;
    RAISE NOTICE 'Profile deletado para user_id: %', OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$function$;