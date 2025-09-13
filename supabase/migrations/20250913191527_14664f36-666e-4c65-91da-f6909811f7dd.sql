-- Add RLS policy to allow admins to update user profiles
CREATE POLICY "Admins can update user profiles" 
ON public.profiles 
FOR UPDATE 
USING (is_admin())
WITH CHECK (
  is_admin() AND 
  (role != 'admin' OR is_master_admin())
);