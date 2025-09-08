-- Create master_admins table
CREATE TABLE public.master_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.master_admins ENABLE ROW LEVEL SECURITY;

-- Only master admins can view master admins
CREATE POLICY "Master admins can view master admins" 
ON public.master_admins 
FOR SELECT 
USING (public.is_current_user_master_admin());

-- Only master admins can insert master admins
CREATE POLICY "Master admins can insert master admins" 
ON public.master_admins 
FOR INSERT 
WITH CHECK (public.is_current_user_master_admin());

-- Only master admins can delete master admins
CREATE POLICY "Master admins can delete master admins" 
ON public.master_admins 
FOR DELETE 
USING (public.is_current_user_master_admin());

-- Function to promote first admin to master admin if none exists
CREATE OR REPLACE FUNCTION public.ensure_master_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Check if any master admin exists
  IF EXISTS (SELECT 1 FROM public.master_admins LIMIT 1) THEN
    RETURN true;
  END IF;
  
  -- If no master admin exists, make the first admin a master admin
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role LIMIT 1) THEN
    INSERT INTO public.master_admins (user_id) 
    SELECT user_id FROM public.user_roles 
    WHERE role = 'admin'::public.app_role 
    ORDER BY created_at LIMIT 1;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$function$;

-- Call the function to ensure there's a master admin
SELECT public.ensure_master_admin_exists();