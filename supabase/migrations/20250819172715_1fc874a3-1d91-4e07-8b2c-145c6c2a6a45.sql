-- Função para sincronizar admins existentes com admin_setores
CREATE OR REPLACE FUNCTION public.sync_existing_admins_to_setores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Inserir admins que ainda não estão na tabela admin_setores
  -- Usar 'CONTABIL' como setor padrão (você pode alterar depois)
  INSERT INTO public.admin_setores (user_id, setor)
  SELECT DISTINCT ur.user_id, 'CONTABIL'::setor
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_setores asec 
      WHERE asec.user_id = ur.user_id
    );
    
  -- Log do resultado
  RAISE NOTICE 'Sincronização de admins concluída';
END;
$function$;

-- Executar a sincronização agora
SELECT public.sync_existing_admins_to_setores();

-- Trigger para automaticamente adicionar novos admins à tabela admin_setores
CREATE OR REPLACE FUNCTION public.auto_add_admin_to_setores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Se o novo role é admin, adicionar à tabela admin_setores
  IF NEW.role = 'admin'::public.app_role THEN
    INSERT INTO public.admin_setores (user_id, setor)
    VALUES (NEW.user_id, 'CONTABIL'::setor)
    ON CONFLICT (user_id, setor) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar o trigger
CREATE TRIGGER trigger_auto_add_admin_to_setores
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_admin_to_setores();