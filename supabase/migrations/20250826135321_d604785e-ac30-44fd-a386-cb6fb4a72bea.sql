-- Sincronizar usuários em falta manualmente
SELECT public.sync_auth_users_with_profiles_and_roles();