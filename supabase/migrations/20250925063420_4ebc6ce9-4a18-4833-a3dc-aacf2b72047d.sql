-- Fix agenda table structure and policies

-- 1. Add data_fim column to agenda table
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS data_fim date;

-- 2. Update existing records to set data_fim = data where null
UPDATE public.agenda SET data_fim = data WHERE data_fim IS NULL;

-- 3. Drop existing restrictive policies for UPDATE and DELETE
DROP POLICY IF EXISTS "Agenda: update own or master admin" ON public.agenda;
DROP POLICY IF EXISTS "Agenda: delete own or master admin" ON public.agenda;

-- 4. Create new permissive policies for UPDATE and DELETE that include supervisors and admins
CREATE POLICY "Agenda: update for creators, supervisors and admins" 
ON public.agenda 
FOR UPDATE 
USING (
  created_by = auth.uid() OR 
  is_master_admin() OR 
  is_admin() OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'supervisor'
  )
)
WITH CHECK (
  created_by = auth.uid() OR 
  is_master_admin() OR 
  is_admin() OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'supervisor'
  )
);

CREATE POLICY "Agenda: delete for creators, supervisors and admins" 
ON public.agenda 
FOR DELETE 
USING (
  created_by = auth.uid() OR 
  is_master_admin() OR 
  is_admin() OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'supervisor'
  )
);

-- 5. Update agenda_apply_visibility function to handle data_fim
CREATE OR REPLACE FUNCTION public.agenda_apply_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Mapear tipo de agenda para visibility
  if new.agenda_type = 'pessoal' then
    new.visibility := 'private';
  elsif new.agenda_type = 'compartilhada' then
    new.visibility := 'team';
  end if;

  -- Evitar nulos
  if new.collaborators_ids is null then
    new.collaborators_ids := '{}';
  end if;
  
  -- Garantir data_fim
  if new.data_fim is null then
    new.data_fim := new.data;
  elsif new.data_fim < new.data then
    new.data_fim := new.data;
  end if;

  return new;
end;
$function$;

-- 6. Create trigger for agenda_apply_visibility if not exists
DROP TRIGGER IF EXISTS agenda_apply_visibility_trigger ON public.agenda;
CREATE TRIGGER agenda_apply_visibility_trigger
  BEFORE INSERT OR UPDATE ON public.agenda
  FOR EACH ROW
  EXECUTE FUNCTION public.agenda_apply_visibility();

-- 7. Ensure storage policies for project-documents bucket exist
DO $$
BEGIN
  -- Check if policies exist before creating them
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload project documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload project documents" 
    ON storage.objects 
    FOR INSERT 
    TO authenticated
    WITH CHECK (bucket_id = 'project-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view project documents'
  ) THEN
    CREATE POLICY "Authenticated users can view project documents" 
    ON storage.objects 
    FOR SELECT 
    TO authenticated
    USING (bucket_id = 'project-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update project documents'
  ) THEN
    CREATE POLICY "Authenticated users can update project documents" 
    ON storage.objects 
    FOR UPDATE 
    TO authenticated
    USING (bucket_id = 'project-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete project documents'
  ) THEN
    CREATE POLICY "Authenticated users can delete project documents" 
    ON storage.objects 
    FOR DELETE 
    TO authenticated
    USING (bucket_id = 'project-documents');
  END IF;
END $$;