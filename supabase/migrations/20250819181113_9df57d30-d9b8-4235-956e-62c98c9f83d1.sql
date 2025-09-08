-- Corrigir funções com search_path seguro
CREATE OR REPLACE FUNCTION public.sync_user_roles_username()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar username em user_roles quando profiles for atualizado
  UPDATE public.user_roles 
  SET username = NEW.username 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.populate_user_roles_username()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Popular username automaticamente ao inserir novo role
  SELECT username INTO NEW.username 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;