-- Idempotent setup for master admin protection

-- 1) Master admins table
create table if not exists public.master_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.master_admins enable row level security;

-- 2) Helper function
create or replace function public.is_master_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.master_admins where user_id = _user_id
  );
$$;

-- 3) Trigger function
create or replace function public.protect_master_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
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

-- 4) Triggers on user_roles
drop trigger if exists trg_protect_master_admin_role_update on public.user_roles;
create trigger trg_protect_master_admin_role_update
before update on public.user_roles
for each row execute function public.protect_master_admin_role();

drop trigger if exists trg_protect_master_admin_role_delete on public.user_roles;
create trigger trg_protect_master_admin_role_delete
before delete on public.user_roles
for each row execute function public.protect_master_admin_role();

-- 5) Register the provided UID as master admin (idempotent)
insert into public.master_admins (user_id)
values ('a2928166-5f73-44de-a1d1-7915731e6b44')
on conflict (user_id) do nothing;

-- 6) Ensure the master admin has the admin role (idempotent without ON CONFLICT)
insert into public.user_roles (user_id, role)
select 'a2928166-5f73-44de-a1d1-7915731e6b44'::uuid, 'admin'::app_role
where not exists (
  select 1 from public.user_roles
  where user_id = 'a2928166-5f73-44de-a1d1-7915731e6b44'::uuid
    and role = 'admin'::app_role
);
