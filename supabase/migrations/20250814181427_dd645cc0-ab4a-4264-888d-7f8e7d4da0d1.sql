-- Corrigir função involves_admin_role usando schema qualificado
create or replace function public.involves_admin_role(target_role public.app_role)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select target_role = 'admin'::public.app_role;
$$;