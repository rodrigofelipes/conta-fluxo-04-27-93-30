-- Adicionar coluna username na tabela admin_setores
ALTER TABLE public.admin_setores 
ADD COLUMN username text;

-- Popular o campo username com dados da tabela profiles
UPDATE public.admin_setores asec
SET username = p.username
FROM public.profiles p
WHERE asec.user_id = p.user_id;

-- Atualizar função existente para incluir username ao adicionar admin a setores
CREATE OR REPLACE FUNCTION public.auto_add_admin_to_setores()
RETURNS TRIGGER 
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
    VALUES (NEW.user_id, 'CONTABIL'::setor, user_username)
    ON CONFLICT (user_id, setor) DO UPDATE SET username = user_username;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar função para sincronizar username quando profiles for atualizado
CREATE OR REPLACE FUNCTION public.sync_admin_setores_username()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar username em admin_setores quando profiles for atualizado
  UPDATE public.admin_setores 
  SET username = NEW.username 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para sincronizar username quando profiles for atualizada
DROP TRIGGER IF EXISTS sync_username_to_admin_setores ON public.profiles;
CREATE TRIGGER sync_username_to_admin_setores
  AFTER UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_setores_username();

-- Criar função para popular username ao inserir novo admin_setores
CREATE OR REPLACE FUNCTION public.populate_admin_setores_username()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Popular username automaticamente ao inserir novo registro
  SELECT username INTO NEW.username 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Trigger para popular username ao inserir
DROP TRIGGER IF EXISTS populate_username_on_admin_setores_insert ON public.admin_setores;
CREATE TRIGGER populate_username_on_admin_setores_insert
  BEFORE INSERT ON public.admin_setores
  FOR EACH ROW
  WHEN (NEW.username IS NULL)
  EXECUTE FUNCTION public.populate_admin_setores_username();