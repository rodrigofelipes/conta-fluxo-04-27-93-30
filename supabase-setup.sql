-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  from_user_name TEXT NOT NULL,
  to_user_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own messages
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (
    from_user_id = auth.uid()::TEXT OR 
    to_user_id = auth.uid()::TEXT
  );

-- Create policy to allow users to insert messages
CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT WITH CHECK (
    from_user_id = auth.uid()::TEXT
  );

-- Enable realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (from_user_id, to_user_id, created_at);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);

-- Create function to get user email by username
CREATE OR REPLACE FUNCTION get_user_email_by_username(username_input TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT au.email
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.username = username_input
  LIMIT 1;
$$;

-- Create function to promote user by username to admin
CREATE OR REPLACE FUNCTION promote_user_by_username_to_admin(username_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Find user by username
  SELECT au.id INTO user_uuid
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.username = username_input;
  
  -- If user not found, return false
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Insert or update user role to admin
  INSERT INTO user_roles (user_id, role)
  VALUES (user_uuid, 'admin'::app_role)
  ON CONFLICT (user_id)
  DO UPDATE SET role = 'admin'::app_role, created_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Create function to reset user password by username (admin only)
CREATE OR REPLACE FUNCTION reset_user_password_by_username(username_input TEXT, new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Find user by username
  SELECT au.id INTO user_uuid
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.username = username_input;
  
  -- If user not found, return false
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update the user's password
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN TRUE;
END;
$$;

-- Automatically promote OlevateADM to admin when they sign up
SELECT promote_user_by_username_to_admin('OlevateADM');

-- Reset OlevateADM password to adminadmin
SELECT reset_user_password_by_username('OlevateADM', 'adminadmin');

-- Recreate the has_role function for the new enum
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;

-- Recreate RLS policies for user_roles table
CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = user_id));

CREATE POLICY "Admins can insert user roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user roles" 
ON public.user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RLS policies for profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile and admins can view all" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile and admins can update all" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Recreate policies for messages table with admin access
CREATE POLICY "Users can view their own messages and admins can view all" ON messages
  FOR SELECT USING (
    from_user_id = auth.uid()::TEXT OR 
    to_user_id = auth.uid()::TEXT OR
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can insert messages and admins can insert any" ON messages
  FOR INSERT WITH CHECK (
    from_user_id = auth.uid()::TEXT OR
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update messages" ON messages
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete messages" ON messages
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'username', 
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'user'
  );
  RETURN NEW;
END;
$function$;

-- Create trigger that fires when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Promote specific user to admin (replace with actual admin user ID)
INSERT INTO user_roles (user_id, role)
VALUES ('63a67533-819d-4b9a-854d-a13b2ed15210', 'admin'::app_role)
ON CONFLICT (user_id)
DO UPDATE SET role = 'admin'::app_role, created_at = NOW();

-- Also promote the original admin user if exists
INSERT INTO user_roles (user_id, role)
VALUES ('177f3ec1-40bd-412f-8d37-bf0ad7489cc6', 'admin'::app_role)
ON CONFLICT (user_id)
DO UPDATE SET role = 'admin'::app_role, created_at = NOW();

-- Add message_type column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'internal' CHECK (message_type IN ('internal', 'whatsapp'));

-- Update existing messages that start with [WhatsApp]
UPDATE public.messages 
SET message_type = 'whatsapp' 
WHERE message LIKE '[WhatsApp]%';

-- Set internal type for existing messages
UPDATE public.messages 
SET message_type = 'internal' 
WHERE message_type IS NULL AND message NOT LIKE '[WhatsApp]%';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(message_type);