-- Adicionar campo telefone na tabela user_roles se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_roles' 
                   AND column_name = 'telefone' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.user_roles ADD COLUMN telefone text;
    END IF;
END $$;

-- Atualizar a função populate_user_roles_username para incluir telefone
CREATE OR REPLACE FUNCTION public.populate_user_roles_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Popular username e telefone automaticamente ao inserir novo role
  SELECT username, telefone INTO NEW.username, NEW.telefone
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

-- Atualizar a função sync_user_roles_username para incluir telefone
CREATE OR REPLACE FUNCTION public.sync_user_roles_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar username e telefone em user_roles quando profiles for atualizado
  UPDATE public.user_roles 
  SET username = NEW.username, telefone = NEW.telefone
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

-- Sincronizar dados existentes (preencher telefone nos user_roles existentes)
UPDATE public.user_roles 
SET telefone = p.telefone
FROM public.profiles p
WHERE user_roles.user_id = p.user_id
AND user_roles.telefone IS NULL;