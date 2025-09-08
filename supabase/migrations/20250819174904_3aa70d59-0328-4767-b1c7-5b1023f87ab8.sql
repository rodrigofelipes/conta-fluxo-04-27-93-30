-- Drop and recreate the app_role type to ensure it's properly defined
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Recreate the user_roles table with the proper type
DROP TABLE IF EXISTS public.user_roles CASCADE;
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user'::public.app_role,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Recreate all functions that use app_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.involves_admin_role(target_role public.app_role)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT target_role = 'admin'::public.app_role;
$$;

-- Recreate RLS policies
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Master admins can insert admin roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  CASE
    WHEN involves_admin_role(role) THEN public.is_current_user_master_admin()
    ELSE public.is_admin()
  END
);

CREATE POLICY "Master admins can update admin roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.is_admin())
WITH CHECK (
  CASE
    WHEN involves_admin_role(role) THEN public.is_current_user_master_admin()
    ELSE public.is_admin()
  END
);

CREATE POLICY "Master admins can delete admin roles" 
ON public.user_roles 
FOR DELETE 
USING (
  CASE
    WHEN involves_admin_role(role) THEN public.is_current_user_master_admin()
    ELSE public.is_admin()
  END
);