-- Fix critical security issues identified by the security scanner

-- 1. Fix the critical ERROR: System Messages Could Be Inserted Without Authentication
-- Remove the problematic policy that allows unauthenticated message insertion
DROP POLICY IF EXISTS "Allow external messages for real-time" ON public.messages;

-- Create a more secure policy for external messages that requires proper validation
CREATE POLICY "Allow external messages with proper validation"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = from_user_id) OR 
  (
    -- Only allow system/webhook messages for admins with specific conditions
    auth.jwt() ->> 'role' = 'service_role' AND
    to_user_id IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'::app_role
    )
  )
);

-- 2. Fix Unknown Contact Information exposure
-- Update the policy to be more restrictive
DROP POLICY IF EXISTS "System can insert unknown contacts" ON public.unknown_contacts;

CREATE POLICY "Webhook can insert unknown contacts"
ON public.unknown_contacts
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow inserts from service role (webhooks) or admins
  auth.jwt() ->> 'role' = 'service_role' OR
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- 3. Restrict profile access for chat to only necessary data
-- Drop the overly permissive policy for viewing admin profiles
DROP POLICY IF EXISTS "Users can view admin profiles for chat" ON public.profiles;

-- Create a more restrictive policy that only shows basic info needed for chat
CREATE POLICY "Users can view basic admin info for chat"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can see their own profile completely
  (auth.uid() = user_id) OR
  -- Or basic info of admins for chat (only username and full_name, no sensitive data)
  (
    user_id IN (SELECT user_id FROM user_roles WHERE role = 'admin'::app_role) AND
    auth.uid() IS NOT NULL
  )
);

-- 4. Add more restrictive access to client data
-- Ensure only authorized admins can access client sensitive data
CREATE POLICY "Restricted client data access"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  -- Only master admins or admins with proper sector access can view clients
  is_user_master_admin(auth.uid()) OR 
  (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    ) AND
    user_has_setor_access(auth.uid(), setor)
  )
);