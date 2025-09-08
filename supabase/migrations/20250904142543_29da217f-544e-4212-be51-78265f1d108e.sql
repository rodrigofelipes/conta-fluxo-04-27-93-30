-- 1. Add new columns to project_phases table
ALTER TABLE public.project_phases 
ADD COLUMN assigned_to uuid,
ADD COLUMN supervised_by uuid,
ADD COLUMN executed_hours numeric DEFAULT 0;

-- 2. Add foreign key constraints
ALTER TABLE public.project_phases
ADD CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
ADD CONSTRAINT fk_supervised_by FOREIGN KEY (supervised_by) REFERENCES public.profiles(id);

-- 3. Add phase_id to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN phase_id uuid;

-- 4. Add foreign key constraint for phase_id
ALTER TABLE public.time_entries
ADD CONSTRAINT fk_phase_id FOREIGN KEY (phase_id) REFERENCES public.project_phases(id);

-- 5. Create function to update executed hours when time entry is created/updated
CREATE OR REPLACE FUNCTION update_phase_executed_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- If inserting or updating with end_time, calculate and update executed hours
  IF TG_OP = 'INSERT' AND NEW.end_time IS NOT NULL AND NEW.phase_id IS NOT NULL THEN
    UPDATE project_phases 
    SET executed_hours = COALESCE(executed_hours, 0) + COALESCE(NEW.duration_minutes, 0) / 60.0
    WHERE id = NEW.phase_id;
  END IF;
  
  -- If updating and end_time was added, update executed hours
  IF TG_OP = 'UPDATE' AND OLD.end_time IS NULL AND NEW.end_time IS NOT NULL AND NEW.phase_id IS NOT NULL THEN
    UPDATE project_phases 
    SET executed_hours = COALESCE(executed_hours, 0) + COALESCE(NEW.duration_minutes, 0) / 60.0
    WHERE id = NEW.phase_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to automatically update executed hours
CREATE TRIGGER trigger_update_phase_executed_hours
  AFTER INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_phase_executed_hours();

-- 7. Create RLS policies for phase-based access
-- Users can only see phases assigned to them or supervised by them
CREATE POLICY "Users can view assigned or supervised phases" 
ON public.project_phases 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    supervised_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    is_admin()
  )
);

-- Users can only update phases they supervise or if they are admin
CREATE POLICY "Supervisors can update their phases" 
ON public.project_phases 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND (
    supervised_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    is_admin()
  )
);

-- Time entries policy - users can only create entries for phases assigned to them
CREATE POLICY "Users can create time entries for assigned phases" 
ON public.time_entries 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    phase_id IS NULL OR -- Allow for backward compatibility
    EXISTS (
      SELECT 1 FROM project_phases pp 
      WHERE pp.id = phase_id 
      AND pp.assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
);