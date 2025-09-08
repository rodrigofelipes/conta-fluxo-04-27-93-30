-- Fix remaining functions that still need search_path set
-- These are the last functions causing search_path warnings

CREATE OR REPLACE FUNCTION public.cleanup_orphan_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Remover user_roles sem profile correspondente
  DELETE FROM public.user_roles ur
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = ur.user_id
  );

  -- Remover admin_setores sem profile correspondente
  DELETE FROM public.admin_setores asec
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = asec.user_id
  );

  -- Remover master_admins sem profile correspondente
  DELETE FROM public.master_admins ma
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = ma.user_id
  );

  -- Remover profiles sem usuário correspondente no auth
  DELETE FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p.user_id
  );
  
  RAISE NOTICE 'Limpeza de dados órfãos concluída';
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profiles_user_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Inserir role 'user' para profiles que não têm role
  INSERT INTO user_roles (user_id, role)
  SELECT p.user_id, 'user'::app_role
  FROM profiles p
  LEFT JOIN user_roles ur ON p.user_id = ur.user_id
  WHERE ur.user_id IS NULL;
  
  -- Log do resultado
  RAISE NOTICE 'Sincronização de profiles e user_roles concluída';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_orphan_clients()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Deletar clientes que não têm profile correspondente por email ou telefone
  DELETE FROM public.clientes c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE (c.email = p.email AND c.email IS NOT NULL) 
       OR (c.telefone = p.telefone AND c.telefone IS NOT NULL)
  )
  AND (c.email IS NOT NULL OR c.telefone IS NOT NULL);
  
  RAISE NOTICE 'Clientes órfãos removidos automaticamente';
END;
$function$;