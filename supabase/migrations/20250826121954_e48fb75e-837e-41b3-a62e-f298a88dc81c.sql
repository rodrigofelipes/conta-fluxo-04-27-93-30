-- Ensure unique constraints used by ON CONFLICT clauses
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_key ON public.user_roles (user_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS admin_setores_user_id_setor_key ON public.admin_setores (user_id, setor);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles (user_id);

-- Create/refresh triggers to keep auth.users, profiles and user_roles in sync
-- 1) When a new auth user is created, create profile and default role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 2) When auth.users data changes, update profile
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_from_auth();

-- 3) When a profile is created, ensure a default user role exists
DROP TRIGGER IF EXISTS profiles_after_insert_auto_role ON public.profiles;
CREATE TRIGGER profiles_after_insert_auto_role
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_user_role();

-- 4) Keep username/telefone mirrored to user_roles on profile updates
DROP TRIGGER IF EXISTS profiles_after_update_sync_user_roles ON public.profiles;
CREATE TRIGGER profiles_after_update_sync_user_roles
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_roles_username();

-- 5) Populate username/telefone fields in user_roles before insert
DROP TRIGGER IF EXISTS user_roles_before_insert_populate_username ON public.user_roles;
CREATE TRIGGER user_roles_before_insert_populate_username
BEFORE INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.populate_user_roles_username();

-- 6) Auto add/remove admin in admin_setores when role changes
DROP TRIGGER IF EXISTS user_roles_after_insert_auto_add_admin ON public.user_roles;
CREATE TRIGGER user_roles_after_insert_auto_add_admin
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_admin_to_setores();

DROP TRIGGER IF EXISTS user_roles_after_update_remove_admin ON public.user_roles;
CREATE TRIGGER user_roles_after_update_remove_admin
AFTER UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.remove_admin_from_setores();

-- 7) Populate username in admin_setores based on profiles
DROP TRIGGER IF EXISTS admin_setores_before_insert_populate_username ON public.admin_setores;
CREATE TRIGGER admin_setores_before_insert_populate_username
BEFORE INSERT ON public.admin_setores
FOR EACH ROW
EXECUTE FUNCTION public.populate_admin_setores_username();

-- One-time sync to ensure current data is aligned
SELECT public.sync_auth_users_with_profiles_and_roles();