-- Fix critical security issue: Remove public access to profiles table
-- This addresses the "All User Personal Information Exposed to Public" error

-- First, drop the problematic policy that allows public access
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create proper RLS policies for profiles table
-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all profiles (for admin functionality)
CREATE POLICY "Admins can view all profiles"
ON public.profiles  
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::public.app_role
  )
);

-- Fix function search_path warnings by updating functions
CREATE OR REPLACE FUNCTION public.auto_create_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Inserir role 'user' para novo profile
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.user_id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.populate_admin_setores_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Popular username automaticamente ao inserir novo registro
  SELECT username INTO NEW.username 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_admin_setores_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar username em admin_setores quando profiles for atualizado
  UPDATE public.admin_setores 
  SET username = NEW.username 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;