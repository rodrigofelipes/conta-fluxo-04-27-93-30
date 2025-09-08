-- Create master admin function to identify company owners
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND (name = 'Débora' OR name = 'Olevate')
      AND role = 'admin'
  );
$$;

-- Update agenda RLS policies for better sector control
DROP POLICY IF EXISTS "Agenda: select personal or shared or admin" ON public.agenda;

-- Personal sector: only creator can see their own commitments + master admins can see all
CREATE POLICY "Agenda: select personal sector"
ON public.agenda
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) AND (
    is_master_admin() OR  -- Master admins see everything
    (agenda_type = 'compartilhada') OR  -- Everyone sees shared
    (agenda_type = 'pessoal' AND created_by = auth.uid())  -- Only creator sees personal
  )
);

-- Ensure all authenticated users can create in both sectors
DROP POLICY IF EXISTS "Agenda: insert own" ON public.agenda;
CREATE POLICY "Agenda: insert authenticated users"
ON public.agenda
FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL) AND (created_by = auth.uid())
);

-- Update permissions for updates
DROP POLICY IF EXISTS "Agenda: update own or admin" ON public.agenda;
CREATE POLICY "Agenda: update own or master admin"
ON public.agenda
FOR UPDATE
USING (is_master_admin() OR (created_by = auth.uid()))
WITH CHECK (is_master_admin() OR (created_by = auth.uid()));

-- Update permissions for deletes  
DROP POLICY IF EXISTS "Agenda: delete own or admin" ON public.agenda;
CREATE POLICY "Agenda: delete own or master admin"
ON public.agenda
FOR DELETE
USING (is_master_admin() OR (created_by = auth.uid()));