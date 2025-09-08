-- Update access helper to grant access when admin has setor 'TODOS'
CREATE OR REPLACE FUNCTION public.user_has_setor_access(user_id_param uuid, setor_param setor)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_setores 
    WHERE user_id = user_id_param 
      AND (setor = setor_param OR setor = 'TODOS'::public.setor)
  ) OR public.is_user_master_admin(user_id_param);
$function$;