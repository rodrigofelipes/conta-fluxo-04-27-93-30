-- Verificar dados atuais para diagnóstico
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data ->> 'username' as meta_username,
  au.raw_user_meta_data ->> 'created_by_admin' as created_by_admin,
  ur.username as role_username,
  ur.role
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
ORDER BY au.created_at DESC;

-- Atualizar a função auto_sync_users para garantir que username seja preenchido
CREATE OR REPLACE FUNCTION public.auto_sync_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role public.app_role;
  user_username text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Limpar dados relacionados ao usuário deletado
    DELETE FROM public.profiles WHERE user_id = OLD.id;
    DELETE FROM public.user_roles WHERE user_id = OLD.id;
    DELETE FROM public.admin_setores WHERE user_id = OLD.id;
    DELETE FROM public.master_admins WHERE user_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    -- Determinar role baseado na origem da criação
    IF NEW.raw_user_meta_data ? 'created_by_admin' THEN
      user_role := 'user'::public.app_role;
    ELSE
      user_role := 'admin'::public.app_role;
    END IF;
    
    -- Extrair username do metadata ou usar email
    user_username := COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      split_part(NEW.email, '@', 1)
    );
    
    -- Criar profile para novo usuário
    INSERT INTO public.profiles (user_id, username, full_name, email, telefone)
    VALUES (
      NEW.id,
      user_username,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', user_username),
      NEW.email,
      NEW.raw_user_meta_data ->> 'telefone'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      telefone = EXCLUDED.telefone;
    
    -- Remover todos os roles existentes e criar apenas o correto com username
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    
    INSERT INTO public.user_roles (user_id, role, username, telefone)
    VALUES (
      NEW.id, 
      user_role,
      user_username,
      NEW.raw_user_meta_data ->> 'telefone'
    );
    
    -- Se é admin, adicionar a admin_setores com setor TODOS
    IF user_role = 'admin'::public.app_role THEN
      INSERT INTO public.admin_setores (user_id, setor, username)
      VALUES (
        NEW.id, 
        'TODOS'::public.setor,
        user_username
      )
      ON CONFLICT (user_id, setor) DO NOTHING;
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Atualizar username se mudou no metadata
    user_username := COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      split_part(NEW.email, '@', 1)
    );
    
    -- Atualizar user_roles com novo username
    UPDATE public.user_roles 
    SET 
      username = user_username,
      telefone = NEW.raw_user_meta_data ->> 'telefone'
    WHERE user_id = NEW.id;
    
    -- Atualizar profiles
    UPDATE public.profiles
    SET 
      username = user_username,
      full_name = COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', username),
      email = NEW.email,
      telefone = NEW.raw_user_meta_data ->> 'telefone'
    WHERE user_id = NEW.id;
    
    -- Atualizar admin_setores se existe
    UPDATE public.admin_setores 
    SET username = user_username 
    WHERE user_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Executar correção manual dos usernames faltantes na user_roles
UPDATE public.user_roles 
SET username = COALESCE(
  (SELECT au.raw_user_meta_data ->> 'username' FROM auth.users au WHERE au.id = user_roles.user_id),
  (SELECT split_part(au.email, '@', 1) FROM auth.users au WHERE au.id = user_roles.user_id)
)
WHERE username IS NULL;

-- Verificar resultado final
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data ->> 'username' as meta_username,
  ur.username as role_username,
  ur.role,
  p.username as profile_username
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
LEFT JOIN public.profiles p ON au.id = p.user_id
ORDER BY au.created_at DESC;