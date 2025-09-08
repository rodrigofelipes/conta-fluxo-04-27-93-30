-- Fix profiles foreign key constraint issue
-- Drop the problematic foreign key constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_user_id_fkey'
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_user_id_fkey;
        RAISE NOTICE 'Dropped problematic foreign key constraint profiles_user_id_fkey';
    END IF;
END $$;

-- Recreate the foreign key constraint properly
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Ensure the auto_sync_users trigger is working correctly
-- Update the trigger to handle user creation properly
CREATE OR REPLACE FUNCTION public.auto_sync_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- CORREÇÃO: Sempre criar como 'user' por padrão para novos usuários
    -- Apenas usuários explicitamente promovidos devem ser admins
    user_role := 'user'::public.app_role;
    
    -- Extrair username do metadata ou usar email
    user_username := COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      split_part(NEW.email, '@', 1)
    );
    
    -- Criar profile para novo usuário APENAS se não existir
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
      telefone = EXCLUDED.telefone,
      updated_at = now();
    
    -- Criar user_role APENAS se não existir
    INSERT INTO public.user_roles (user_id, role, username, telefone)
    VALUES (
      NEW.id, 
      user_role,
      user_username,
      NEW.raw_user_meta_data ->> 'telefone'
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Atualizar dados do usuário
    user_username := COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      split_part(NEW.email, '@', 1)
    );
    
    -- Atualizar user_roles
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
      telefone = NEW.raw_user_meta_data ->> 'telefone',
      updated_at = now()
    WHERE user_id = NEW.id;
    
    -- Atualizar admin_setores se existe
    UPDATE public.admin_setores 
    SET username = user_username 
    WHERE user_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;