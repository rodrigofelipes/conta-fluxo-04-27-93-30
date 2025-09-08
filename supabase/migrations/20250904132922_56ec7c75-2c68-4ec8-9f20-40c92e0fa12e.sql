-- Função para sincronizar dados do profile com auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar os metadados do usuário na tabela auth.users
  UPDATE auth.users 
  SET 
    raw_user_meta_data = jsonb_build_object(
      'name', NEW.name,
      'email', NEW.email,
      'role', NEW.role,
      'theme', NEW.theme,
      'gradient', NEW.gradient
    )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Trigger para sincronizar quando o profile for atualizado
CREATE TRIGGER sync_profile_to_auth_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_auth();

-- Trigger para sincronizar quando o profile for inserido  
CREATE TRIGGER sync_profile_to_auth_insert_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_auth();

-- Função para atualizar profile quando auth.users for alterado
CREATE OR REPLACE FUNCTION public.sync_auth_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar o profile quando os metadados do auth forem alterados
  UPDATE public.profiles 
  SET 
    name = COALESCE(NEW.raw_user_meta_data ->> 'name', OLD.raw_user_meta_data ->> 'name', name),
    email = COALESCE(NEW.email, email),
    updated_at = now()
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Trigger para sincronizar de auth.users para profiles
CREATE TRIGGER sync_auth_to_profile_trigger
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_to_profile();