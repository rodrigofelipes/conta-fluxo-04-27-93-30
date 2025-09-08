-- Simplify RLS policy for tasks_new: client visibility via email/phone linkage
DROP POLICY IF EXISTS "Clients can view their tasks via clientes table" ON public.tasks_new;

CREATE POLICY "Clients can view their tasks via clientes table" 
ON public.tasks_new 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.clientes c
    JOIN public.profiles p ON (
      (c.email IS NOT NULL AND p.email IS NOT NULL AND c.email = p.email)
      OR 
      (c.telefone IS NOT NULL AND p.telefone IS NOT NULL AND c.telefone = p.telefone)
    )
    WHERE c.id = tasks_new.client_id 
      AND p.user_id = auth.uid()
  )
);
