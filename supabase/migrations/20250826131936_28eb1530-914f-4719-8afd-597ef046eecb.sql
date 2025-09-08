-- Criar o tipo enum app_role se não existir
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar o tipo enum setor se não existir
DO $$ BEGIN
    CREATE TYPE public.setor AS ENUM ('PESSOAL', 'FISCAL', 'CONTABIL', 'PLANEJAMENTO', 'TODOS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Função para sincronização completa e limpeza de dados
CREATE OR REPLACE FUNCTION public.sync_and_cleanup_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- Executar sincronização inicial
SELECT public.sync_and_cleanup_users();