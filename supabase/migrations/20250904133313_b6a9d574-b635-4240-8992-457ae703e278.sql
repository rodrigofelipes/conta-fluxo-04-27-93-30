-- Remover triggers que estão causando recursão infinita
DROP TRIGGER IF EXISTS sync_auth_to_profile_trigger ON auth.users;
DROP TRIGGER IF EXISTS sync_profile_to_auth_trigger ON public.profiles;

-- Remover as funções problemáticas
DROP FUNCTION IF EXISTS public.sync_auth_to_profile() CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_to_auth() CASCADE;