-- Recreate missing master admin functions
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_admins 
    WHERE user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.is_master_admin(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_user_master_admin(user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_admins 
    WHERE user_id = user_id_param
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_setor_access(user_id_param uuid, setor_param public.setor)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_setores 
    WHERE user_id = user_id_param AND setor = setor_param
  ) OR public.is_user_master_admin(user_id_param);
$$;