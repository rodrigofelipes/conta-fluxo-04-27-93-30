-- Create SECURITY DEFINER helper to bypass RLS on referenced tables safely
CREATE OR REPLACE FUNCTION public.user_can_view_client_tasks(client_id uuid, uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clientes c
    JOIN public.profiles p ON (
      (c.email IS NOT NULL AND p.email IS NOT NULL AND c.email = p.email)
      OR (c.telefone IS NOT NULL AND p.telefone IS NOT NULL AND c.telefone = p.telefone)
    )
    WHERE c.id = client_id
      AND p.user_id = COALESCE(uid, auth.uid())
  );
$$;

-- Replace simplified RLS policy to use the helper function
DROP POLICY IF EXISTS "Clients can view their tasks via clientes table" ON public.tasks_new;

CREATE POLICY "Clients can view their tasks via clientes table"
ON public.tasks_new
FOR SELECT
USING (
  public.user_can_view_client_tasks(client_id)
);
