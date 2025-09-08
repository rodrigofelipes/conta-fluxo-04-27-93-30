
-- 1) Função que retorna os profiles.id restritos (Débora e Olevate)
create or replace function public.get_restricted_profile_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(id), '{}')
  from public.profiles
  where name in ('Débora', 'Olevate');
$$;

-- 2) Função que verifica se collaborators_ids contém SOMENTE os perfis restritos
create or replace function public.is_only_restricted_collaborators(_collabs uuid[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_length(_collabs, 1), 0) > 0
         and _collabs <@ public.get_restricted_profile_ids();
$$;

-- 3) Substituir a policy de SELECT da agenda
alter table public.agenda
  drop policy if exists "Agenda: select personal sector";

create policy "Agenda: visibility with restricted collaborators"
on public.agenda
for select
using (
  auth.uid() is not null and (
    public.is_admin()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.id = any (collaborators_ids)
    )
    or (
      agenda_type = 'compartilhada'
      and not public.is_only_restricted_collaborators(collaborators_ids)
    )
  )
);
