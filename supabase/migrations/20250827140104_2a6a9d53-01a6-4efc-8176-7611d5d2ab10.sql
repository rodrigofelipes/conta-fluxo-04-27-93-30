-- Fix the remaining functions that are still missing search_path

-- These functions may still need search_path configuration
CREATE OR REPLACE FUNCTION public.sync_existing_admins_to_setores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Inserir admins que ainda não estão na tabela admin_setores
  -- Usar 'TODOS' como setor padrão
  INSERT INTO admin_setores (user_id, setor)
  SELECT DISTINCT ur.user_id, 'TODOS'::setor
  FROM user_roles ur
  WHERE ur.role = 'admin'::app_role
    AND NOT EXISTS (
      SELECT 1 FROM admin_setores asec 
      WHERE asec.user_id = ur.user_id
    );
    
  -- Log do resultado
  RAISE NOTICE 'Sincronização de admins concluída com setor TODOS';
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_and_cleanup_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Limpar usuários órfãos da auth.users (que não existem em profiles nem user_roles)
  DELETE FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id
  );
  
  -- 2. Limpar dados órfãos das tabelas da aplicação
  DELETE FROM public.user_roles ur
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = ur.user_id
  );
  
  DELETE FROM public.admin_setores asec
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = asec.user_id
  );
  
  DELETE FROM public.master_admins ma
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = ma.user_id
  );
  
  DELETE FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = p.user_id
  );
  
  -- 3. Sincronizar usuários restantes do auth.users com profiles e user_roles
  -- Inserir profiles faltantes
  INSERT INTO public.profiles (user_id, username, full_name, email, telefone)
  SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)),
    au.email,
    au.raw_user_meta_data ->> 'telefone'
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL;
  
  -- Inserir user_roles faltantes (padrão 'user')
  INSERT INTO public.user_roles (user_id, role)  
  SELECT 
    au.id,
    'user'::public.app_role
  FROM auth.users au
  LEFT JOIN public.user_roles ur ON au.id = ur.user_id
  WHERE ur.user_id IS NULL;
  
  -- 4. Garantir que existe pelo menos um admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) THEN
    -- Se não existe admin, promover o primeiro usuário
    UPDATE public.user_roles 
    SET role = 'admin'::public.app_role 
    WHERE id = (SELECT id FROM public.user_roles ORDER BY created_at LIMIT 1);
  END IF;
  
  -- 5. Garantir que existe pelo menos um master admin
  IF NOT EXISTS (SELECT 1 FROM public.master_admins) THEN
    -- Se não existe master admin, promover o primeiro admin
    INSERT INTO public.master_admins (user_id) 
    SELECT user_id FROM public.user_roles 
    WHERE role = 'admin'::public.app_role 
    ORDER BY created_at LIMIT 1
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RAISE NOTICE 'Sincronização e limpeza de usuários concluída com sucesso';
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_missing_display_names()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  user_record RECORD;
BEGIN
  -- Para cada usuário que não tem full_name mas tem username no metadata
  FOR user_record IN 
    SELECT id, raw_user_meta_data
    FROM auth.users 
    WHERE raw_user_meta_data->>'full_name' IS NULL 
      AND raw_user_meta_data->>'username' IS NOT NULL
  LOOP
    -- Atualizar o raw_user_meta_data para incluir full_name
    UPDATE auth.users 
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', raw_user_meta_data->>'username')
    WHERE id = user_record.id;
    
    RAISE NOTICE 'Updated display name for user: %', user_record.id;
  END LOOP;
  
  RAISE NOTICE 'Atualização de display names concluída';
END;
$function$;