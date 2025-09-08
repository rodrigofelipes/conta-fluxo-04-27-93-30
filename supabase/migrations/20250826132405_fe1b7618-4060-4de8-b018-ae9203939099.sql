-- Atualizar função trigger para dar admin aos usuários criados via signup público
CREATE OR REPLACE FUNCTION public.auto_sync_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role public.app_role;
BEGIN
  -- Para casos simples, fazer sincronização direta
  IF TG_OP = 'DELETE' THEN
    -- Limpar dados relacionados ao usuário deletado
    DELETE FROM public.profiles WHERE user_id = OLD.id;
    DELETE FROM public.user_roles WHERE user_id = OLD.id;
    DELETE FROM public.admin_setores WHERE user_id = OLD.id;
    DELETE FROM public.master_admins WHERE user_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    -- Determinar role baseado na origem da criação
    -- Se tem metadado 'created_by_admin', é criação interna (role user)
    -- Senão é signup público (role admin)
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
    
    -- Criar role com base na origem
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Se é admin, adicionar a admin_setores com setor padrão
    IF user_role = 'admin'::public.app_role THEN
      INSERT INTO public.admin_setores (user_id, setor, username)
      VALUES (
        NEW.id, 
        'CONTABIL'::public.setor,
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
      )
      ON CONFLICT (user_id, setor) DO NOTHING;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Função auxiliar para criar usuários internamente (usada por admins)
CREATE OR REPLACE FUNCTION public.create_internal_user(
  user_email text,
  user_password text,
  user_username text DEFAULT NULL,
  user_telefone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_user_id uuid;
BEGIN
  -- Verificar se quem está chamando é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create internal users';
  END IF;
  
  -- Esta função deve ser chamada via edge function que cria usuários
  -- com metadado 'created_by_admin' = true
  RAISE NOTICE 'Use edge function create-user-admin para criar usuários internos';
  RETURN null;
END;
$function$;