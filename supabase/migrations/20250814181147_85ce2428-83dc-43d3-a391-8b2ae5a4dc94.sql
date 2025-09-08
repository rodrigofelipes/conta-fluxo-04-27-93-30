-- Corrigir funções sem search_path configurado

-- Corrigir função involves_admin_role
create or replace function public.involves_admin_role(target_role app_role)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select target_role = 'admin'::app_role;
$$;

-- Corrigir função protect_master_admin_role
create or replace function public.protect_master_admin_role()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if (tg_op = 'DELETE') then
    if public.is_master_admin(old.user_id) and old.role::text = 'admin' then
      raise exception 'Master admin admin role cannot be deleted';
    end if;
    return old;
  elsif (tg_op = 'UPDATE') then
    if public.is_master_admin(old.user_id) and old.role::text = 'admin' then
      raise exception 'Master admin admin role cannot be changed';
    end if;
    return new;
  end if;
  return new;
end;
$$;