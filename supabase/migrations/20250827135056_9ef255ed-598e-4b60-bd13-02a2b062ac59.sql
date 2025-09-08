-- Continue fixing function search_path warnings for remaining functions

-- Fix more functions that need search_path set
CREATE OR REPLACE FUNCTION public.populate_user_roles_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Popular username e telefone automaticamente ao inserir novo role
  SELECT username, telefone INTO NEW.username, NEW.telefone
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_user_roles_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar username e telefone em user_roles quando profiles for atualizado
  UPDATE public.user_roles 
  SET username = NEW.username, telefone = NEW.telefone
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

-- Ensure task-files storage bucket exists with proper configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('task-files', 'task-files', false, 52428800, ARRAY['application/pdf', 'image/*', 'text/*', 'application/vnd.openxmlformats-officedocument.*', 'application/msword', 'application/vnd.ms-excel'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/*', 'text/*', 'application/vnd.openxmlformats-officedocument.*', 'application/msword', 'application/vnd.ms-excel'];

-- Ensure RLS policies exist for task-files bucket
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'task-files');

CREATE POLICY "Authenticated users can view files" 
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'task-files');

CREATE POLICY "Authenticated users can update files"
ON storage.objects
FOR UPDATE
TO authenticated  
USING (bucket_id = 'task-files');

CREATE POLICY "Authenticated users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'task-files');