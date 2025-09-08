-- First, convert any existing moderators to users
UPDATE public.user_roles 
SET role = 'user' 
WHERE role = 'moderator';

-- Drop the old enum and create a new one without moderator
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Add the role column back with the new enum type
ALTER TABLE public.user_roles 
ADD COLUMN role public.app_role NOT NULL DEFAULT 'user';