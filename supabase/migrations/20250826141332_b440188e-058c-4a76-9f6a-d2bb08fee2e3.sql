-- Atualizar função para definir setor padrão como TODOS
CREATE OR REPLACE FUNCTION public.auto_add_admin_to_setores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_username text;
BEGIN
  -- Se o novo role é admin, adicionar à tabela admin_setores
  IF NEW.role = 'admin'::app_role THEN
    -- Buscar username do usuário
    SELECT username INTO user_username 
    FROM profiles 
    WHERE user_id = NEW.user_id;
    
    INSERT INTO admin_setores (user_id, setor, username)
    VALUES (NEW.user_id, 'TODOS'::setor, user_username)
    ON CONFLICT (user_id, setor) DO UPDATE SET username = user_username;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar função de sincronização para usar TODOS como padrão
CREATE OR REPLACE FUNCTION public.sync_existing_admins_to_setores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Atualizar função auto_sync_users para usar TODOS
CREATE OR REPLACE FUNCTION public.auto_sync_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role public.app_role;
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
    
    -- Criar profile para novo usuário
    INSERT INTO public.profiles (user_id, username, full_name, email, telefone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      NEW.raw_user_meta_data ->> 'telefone'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      telefone = EXCLUDED.telefone;
    
    -- Remover todos os roles existentes e criar apenas o correto
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role);
    
    -- Se é admin, adicionar a admin_setores com setor TODOS
    IF user_role = 'admin'::public.app_role THEN
      INSERT INTO public.admin_setores (user_id, setor, username)
      VALUES (
        NEW.id, 
        'TODOS'::public.setor,
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
      )
      ON CONFLICT (user_id, setor) DO NOTHING;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Atualizar todos os admins existentes para ter setor TODOS se não tiverem setor ainda
UPDATE admin_setores SET setor = 'TODOS'::setor WHERE setor != 'TODOS'::setor;

-- Sincronizar admins existentes que possam não estar na tabela admin_setores
SELECT public.sync_existing_admins_to_setores();