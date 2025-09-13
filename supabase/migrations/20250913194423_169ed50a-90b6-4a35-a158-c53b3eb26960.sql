-- Update Olevate and Débora to admin role
UPDATE public.profiles 
SET role = 'admin'
WHERE name IN ('Olevate', 'Débora');

-- Create master_admins table to track permanent admins
CREATE TABLE public.master_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on master_admins table
ALTER TABLE public.master_admins ENABLE ROW LEVEL SECURITY;

-- Insert Olevate and Débora as master admins
INSERT INTO public.master_admins (user_id, name)
SELECT user_id, name
FROM public.profiles 
WHERE name IN ('Olevate', 'Débora');

-- Create policy to allow viewing master admins (for verification)
CREATE POLICY "Authenticated users can view master admins" 
ON public.master_admins 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Update the profiles RLS policy to prevent changing master admin roles
DROP POLICY IF EXISTS "Admins can update user profiles" ON public.profiles;

CREATE POLICY "Admins can update user profiles" 
ON public.profiles 
FOR UPDATE 
USING (is_admin())
WITH CHECK (
  is_admin() AND 
  (
    -- Cannot change role of master admins
    (name IN ('Olevate', 'Débora') AND role = 'admin') OR
    -- Regular admin changes (except promoting to admin requires master admin)
    (name NOT IN ('Olevate', 'Débora') AND (role != 'admin' OR is_master_admin()))
  )
);