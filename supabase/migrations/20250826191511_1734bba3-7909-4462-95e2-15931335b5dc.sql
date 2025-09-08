-- Corrigir implementação do setor "TODOS" 
CREATE OR REPLACE FUNCTION public.user_has_setor_access(user_id_param uuid, setor_param setor)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Se o setor solicitado é TODOS, só master admin ou admin com setor TODOS pode acessar
  IF setor_param = 'TODOS'::public.setor THEN
    RETURN public.is_user_master_admin(user_id_param) OR 
           EXISTS (
             SELECT 1 FROM public.admin_setores 
             WHERE user_id = user_id_param AND setor = 'TODOS'::public.setor
           );
  ELSE
    -- Para setores específicos, permitir se tem acesso ao setor específico OU setor TODOS
    RETURN EXISTS (
             SELECT 1 FROM public.admin_setores 
             WHERE user_id = user_id_param 
               AND (setor = setor_param OR setor = 'TODOS'::public.setor)
           ) OR public.is_user_master_admin(user_id_param);
  END IF;
END;
$$;