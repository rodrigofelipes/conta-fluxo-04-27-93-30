-- Allow users to view admin roles for chat functionality
CREATE POLICY "Users can view admin roles for chat" 
ON user_roles 
FOR SELECT 
TO authenticated
USING (role = 'admin'::app_role);

-- Also allow users to view profiles of admins for chat
CREATE POLICY "Users can view admin profiles for chat" 
ON profiles 
FOR SELECT 
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM user_roles WHERE role = 'admin'::app_role
  )
);