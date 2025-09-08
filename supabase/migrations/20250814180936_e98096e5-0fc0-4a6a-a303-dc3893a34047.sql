-- Adicionar proteções para que apenas master admins possam gerenciar roles de admin

-- 1) Função para verificar se o usuário atual é master admin
create or replace function public.is_current_user_master_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_master_admin(auth.uid());
$$;

-- 2) Função para verificar se uma operação envolve role de admin
create or replace function public.involves_admin_role(target_role app_role)
returns boolean
language sql
immutable
as $$
  select target_role = 'admin'::app_role;
$$;

-- 3) Remover políticas antigas que permitem qualquer admin gerenciar roles
drop policy if exists "Admins can delete roles" on public.user_roles;
drop policy if exists "Admins can insert roles" on public.user_roles;
drop policy if exists "Admins can update roles" on public.user_roles;

-- 4) Criar novas políticas mais restritivas

-- Política para inserção: apenas master admins podem criar roles de admin
create policy "Master admins can insert admin roles"
on public.user_roles
for insert
to authenticated
with check (
  case 
    when public.involves_admin_role(role) then public.is_current_user_master_admin()
    else public.is_admin()
  end
);

-- Política para atualização: apenas master admins podem modificar roles de admin
create policy "Master admins can update admin roles"
on public.user_roles
for update
to authenticated
using (
  case 
    when public.involves_admin_role(role) or public.involves_admin_role(OLD.role) then public.is_current_user_master_admin()
    else public.is_admin()
  end
);

-- Política para deleção: apenas master admins podem deletar roles de admin
create policy "Master admins can delete admin roles"
on public.user_roles
for delete
to authenticated
using (
  case 
    when public.involves_admin_role(role) then public.is_current_user_master_admin()
    else public.is_admin()
  end
);

-- 5) Adicionar política para master_admins table para que master admins possam gerenciar outros master admins
create policy "Master admins can manage master admins"
on public.master_admins
for all
to authenticated
using (public.is_current_user_master_admin())
with check (public.is_current_user_master_admin());