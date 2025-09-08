-- Corrigir todas as funções restantes que não têm search_path configurado

-- Função ensure_admin_exists
CREATE OR REPLACE FUNCTION public.ensure_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Check if any admin exists
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) THEN
    RETURN true;
  END IF;
  
  -- If no admin exists, make the first user an admin
  IF EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    UPDATE public.user_roles 
    SET role = 'admin'::public.app_role 
    WHERE id = (SELECT id FROM public.user_roles ORDER BY created_at LIMIT 1);
    RETURN true;
  END IF;
  
  RETURN false;
END;
$function$;

-- Função promote_user_to_admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(_user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  -- Find the user by email
  SELECT id INTO _user_id 
  FROM auth.users 
  WHERE email = _user_email;
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', _user_email;
  END IF;
  
  -- Update or insert the admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Remove any existing user role to avoid conflicts
  DELETE FROM public.user_roles 
  WHERE user_id = _user_id AND role = 'user'::public.app_role;
END;
$function$;

-- Função sync_profile_from_auth
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.profiles
  SET 
    email = NEW.email,
    username = COALESCE(NEW.raw_user_meta_data ->> 'username', username),
    full_name = COALESCE(NEW.raw_user_meta_data ->> 'full_name', full_name),
    updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$function$;