-- Corrigir as funções para adicionar SET search_path TO 'public'
CREATE OR REPLACE FUNCTION public.sync_existing_admins_to_setores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Inserir admins que ainda não estão na tabela admin_setores
  -- Usar 'CONTABIL' como setor padrão (você pode alterar depois)
  INSERT INTO admin_setores (user_id, setor)
  SELECT DISTINCT ur.user_id, 'CONTABIL'::setor
  FROM user_roles ur
  WHERE ur.role = 'admin'::app_role
    AND NOT EXISTS (
      SELECT 1 FROM admin_setores asec 
      WHERE asec.user_id = ur.user_id
    );
    
  -- Log do resultado
  RAISE NOTICE 'Sincronização de admins concluída';
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_add_admin_to_setores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o novo role é admin, adicionar à tabela admin_setores
  IF NEW.role = 'admin'::app_role THEN
    INSERT INTO admin_setores (user_id, setor)
    VALUES (NEW.user_id, 'CONTABIL'::setor)
    ON CONFLICT (user_id, setor) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;