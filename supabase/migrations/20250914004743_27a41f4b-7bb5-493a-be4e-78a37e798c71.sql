-- Add permissions for coordinators to modify project phases
CREATE POLICY "Coordinators can update phase assignments" 
ON public.project_phases 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND 
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'coordenador'
    ) OR 
    is_admin()
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'coordenador'
    ) OR 
    is_admin()
  )
);