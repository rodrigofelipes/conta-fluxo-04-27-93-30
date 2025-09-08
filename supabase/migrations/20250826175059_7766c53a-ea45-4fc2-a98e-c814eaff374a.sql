-- Fix the promote_user_to_admin function to handle RLS policies properly  
-- and avoid duplicate key errors

CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  target_user_id UUID;
  existing_role_count INTEGER;
BEGIN
  -- Find user by email in auth.users
  SELECT au.id INTO target_user_id
  FROM auth.users au
  WHERE au.email = user_email;
  
  -- If user not found, return false
  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User not found with email: %', user_email;
    RETURN FALSE;
  END IF;
  
  -- Check if user already has admin role
  SELECT COUNT(*) INTO existing_role_count
  FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'admin'::public.app_role;
  
  IF existing_role_count > 0 THEN
    RAISE NOTICE 'User % already has admin role', user_email;
    RETURN TRUE; -- Return true since user already is admin
  END IF;
  
  -- Insert admin role (using ON CONFLICT to handle any race conditions)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RAISE NOTICE 'User % promoted to admin successfully', user_email;
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error promoting user %: % %', user_email, SQLSTATE, SQLERRM;
    RETURN FALSE;
END;
$function$;