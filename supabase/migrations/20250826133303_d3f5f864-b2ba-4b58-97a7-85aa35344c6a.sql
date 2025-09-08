-- Remove o trigger redundante que está causando roles duplicados
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove a função redundante também
DROP FUNCTION IF EXISTS public.handle_new_user();