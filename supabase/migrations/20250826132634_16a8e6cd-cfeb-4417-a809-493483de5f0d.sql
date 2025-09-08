-- Remover role duplicado 'user' para usuários que já são admin
DELETE FROM public.user_roles 
WHERE user_id = '54c5ac63-1545-47df-b7e7-a1c032ab1ac6' 
AND role = 'user'::public.app_role;

-- Corrigir trigger para evitar duplicação de roles
CREATE OR REPLACE FUNCTION public.auto_sync_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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