
-- 1) Função auxiliar: detectar admin de forma segura
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- 2) Gatilho para normalizar visibility com base em agenda_type
create or replace function public.agenda_apply_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mapear tipo de agenda para visibility
  if new.agenda_type = 'pessoal' then
    new.visibility := 'private';
  elsif new.agenda_type = 'compartilhada' then
    new.visibility := 'team';
  end if;

  -- Evitar nulos
  if new.collaborators_ids is null then
    new.collaborators_ids := '{}';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agenda_apply_visibility_ins on public.agenda;
drop trigger if exists trg_agenda_apply_visibility_upd on public.agenda;

create trigger trg_agenda_apply_visibility_ins
before insert on public.agenda
for each row execute function public.agenda_apply_visibility();

create trigger trg_agenda_apply_visibility_upd
before update on public.agenda
for each row execute function public.agenda_apply_visibility();

-- 3) Regras de acesso (RLS) da agenda
-- Remover políticas antigas
drop policy if exists "Authenticated users can create agenda items" on public.agenda;
drop policy if exists "Authenticated users can delete agenda items" on public.agenda;
drop policy if exists "Authenticated users can update agenda items" on public.agenda;
drop policy if exists "Authenticated users can view agenda" on public.agenda;

-- Criar políticas alinhadas aos "setores"
create policy "Agenda: insert own"
on public.agenda
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
);

create policy "Agenda: select personal or shared or admin"
on public.agenda
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.is_admin()
    or agenda_type = 'compartilhada'
    or created_by = auth.uid()
  )
);

create policy "Agenda: update own or admin"
on public.agenda
for update
to authenticated
using (public.is_admin() or created_by = auth.uid())
with check (public.is_admin() or created_by = auth.uid());

create policy "Agenda: delete own or admin"
on public.agenda
for delete
to authenticated
using (public.is_admin() or created_by = auth.uid());

-- 4) Índices para performance
create index if not exists idx_agenda_agenda_type on public.agenda (agenda_type);
create index if not exists idx_agenda_created_by on public.agenda (created_by);
create index if not exists idx_agenda_data_horario on public.agenda (data, horario);
