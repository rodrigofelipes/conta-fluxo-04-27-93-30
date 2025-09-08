-- Fix RLS policies for project_phases to ensure collaborators can see their assigned phases

-- First, drop existing conflicting policies
DROP POLICY IF EXISTS "Users can view assigned or supervised phases" ON project_phases;
DROP POLICY IF EXISTS "Supervisors can update their phases" ON project_phases;

-- Create comprehensive RLS policies for project phases
CREATE POLICY "Users can view their assigned phases" 
ON project_phases FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can see phases assigned to them
    assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    -- Supervisors can see phases they supervise  
    supervised_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    -- Admins can see all phases
    is_admin()
  )
);

-- Allow users to update phases they are assigned to or supervise
CREATE POLICY "Users can update their phases" 
ON project_phases FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND (
    assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    supervised_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    is_admin()
  )
);

-- Ensure time_entries can be created for assigned phases
DROP POLICY IF EXISTS "Users can create time entries for assigned phases" ON time_entries;

CREATE POLICY "Users can create time entries for assigned phases" 
ON time_entries FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- Allow if no phase_id (general project time)
    phase_id IS NULL OR
    -- Allow if user is assigned to the phase
    phase_id IN (
      SELECT pp.id FROM project_phases pp
      INNER JOIN profiles p ON p.id = pp.assigned_to
      WHERE p.user_id = auth.uid()
    )
  )
);

-- Create function to check if user can work on phase
CREATE OR REPLACE FUNCTION public.user_can_work_on_phase(phase_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile_id uuid;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM profiles 
  WHERE user_id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if user is assigned to or supervises the phase
  RETURN EXISTS (
    SELECT 1
    FROM project_phases 
    WHERE id = phase_id_param
    AND (assigned_to = user_profile_id OR supervised_by = user_profile_id)
  ) OR is_admin();
END;
$$;