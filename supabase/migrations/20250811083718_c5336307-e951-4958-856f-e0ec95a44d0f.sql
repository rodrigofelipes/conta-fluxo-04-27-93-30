-- Migration to set up admin role management
-- First, let's create a function to promote users to admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(_user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Remove any existing user role to avoid conflicts
  DELETE FROM public.user_roles 
  WHERE user_id = _user_id AND role = 'user';
END;
$$;

-- Create a function to ensure at least one admin exists
CREATE OR REPLACE FUNCTION public.ensure_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if any admin exists
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN true;
  END IF;
  
  -- If no admin exists, make the first user an admin
  IF EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    UPDATE public.user_roles 
    SET role = 'admin' 
    WHERE id = (SELECT id FROM public.user_roles ORDER BY created_at LIMIT 1);
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;