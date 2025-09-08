-- 1) Criar função que retorna os profiles.id restritos (Débora e Olevate)
CREATE OR REPLACE FUNCTION public.get_restricted_profile_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(id), '{}')
  FROM public.profiles
  WHERE name IN ('Débora', 'Olevate');
$$;

-- 2) Criar função que verifica se collaborators_ids contém SOMENTE os perfis restritos
CREATE OR REPLACE FUNCTION public.is_only_restricted_collaborators(_collabs uuid[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_length(_collabs, 1), 0) > 0
         AND _collabs <@ public.get_restricted_profile_ids();
$$;

-- 3) Remover política antiga e criar a nova
DROP POLICY IF EXISTS "Agenda: select personal sector" ON public.agenda;
DROP POLICY IF EXISTS "Agenda: visibility with restricted collaborators" ON public.agenda;

CREATE POLICY "Agenda: visibility with restricted collaborators"
ON public.agenda
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    public.is_admin()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.id = ANY (collaborators_ids)
    )
    OR (
      agenda_type = 'compartilhada'
      AND NOT public.is_only_restricted_collaborators(collaborators_ids)
    )
  )
);