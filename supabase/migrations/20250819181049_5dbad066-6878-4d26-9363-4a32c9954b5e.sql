-- Adicionar coluna username na tabela user_roles
ALTER TABLE public.user_roles 
ADD COLUMN username text;

-- Popular o campo username com dados da tabela profiles
UPDATE public.user_roles ur
SET username = p.username
FROM public.profiles p
WHERE ur.user_id = p.user_id;

-- Criar função para manter username sincronizado quando profiles for atualizado
CREATE OR REPLACE FUNCTION public.sync_user_roles_username()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar username em user_roles quando profiles for atualizado
  UPDATE public.user_roles 
  SET username = NEW.username 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para sincronizar automaticamente
DROP TRIGGER IF EXISTS sync_username_to_user_roles ON public.profiles;
CREATE TRIGGER sync_username_to_user_roles
  AFTER UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_roles_username();

-- Criar trigger para quando novos user_roles forem criados
CREATE OR REPLACE FUNCTION public.populate_user_roles_username()
RETURNS TRIGGER AS $$
BEGIN
  -- Popular username automaticamente ao inserir novo role
  SELECT username INTO NEW.username 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS populate_username_on_insert ON public.user_roles;
CREATE TRIGGER populate_username_on_insert
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_user_roles_username();