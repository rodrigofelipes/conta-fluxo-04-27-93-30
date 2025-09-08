-- Limpeza de órfãos e nova sincronização
CREATE OR REPLACE FUNCTION public.cleanup_orphan_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Remover admin_setores sem usuário correspondente
  DELETE FROM public.admin_setores a
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = a.user_id
  );

  -- Remover user_roles sem usuário correspondente
  DELETE FROM public.user_roles ur
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = ur.user_id
  );

  -- Remover profiles sem usuário correspondente (se existir algum)
  DELETE FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p.user_id
  );
END;
$$;

-- Executar limpeza e sincronização
SELECT public.cleanup_orphan_user_data();
SELECT public.sync_auth_users_with_profiles_and_roles();