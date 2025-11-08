-- Drop the conflicting and overly restrictive admin update policy
DROP POLICY IF EXISTS "Admins can update user profiles" ON public.profiles;

-- Drop the simpler policy that only allows active toggle
DROP POLICY IF EXISTS "Admins can update any profile (active toggle)" ON public.profiles;

-- Create a single, clear policy for admin updates
-- Admins can update any profile field EXCEPT:
-- - Cannot promote users to 'admin' role (only master_admins can)
-- - Cannot change the role of protected admin accounts (Olevate, Débora)
CREATE POLICY "Admins can manage user profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (
  is_admin() AND (
    -- If trying to set role to 'admin', must be master_admin
    (role = 'admin'::user_role AND is_master_admin()) 
    OR 
    -- If NOT trying to set role to 'admin', regular admin is OK
    (role <> 'admin'::user_role)
    OR
    -- If updating protected accounts (Olevate, Débora), must keep them as admin
    (name = ANY (ARRAY['Olevate'::text, 'Débora'::text]) AND role = 'admin'::user_role)
  )
);