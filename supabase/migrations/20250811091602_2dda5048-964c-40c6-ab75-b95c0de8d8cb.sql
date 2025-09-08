-- Convert any existing moderators to users
UPDATE public.user_roles 
SET role = 'user' 
WHERE role = 'moderator';

-- Drop and recreate the enum without moderator
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Recreate the user_roles table with the new enum
ALTER TABLE public.user_roles 
ALTER COLUMN role DROP DEFAULT,
ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role,
ALTER COLUMN role SET DEFAULT 'user'::public.app_role;