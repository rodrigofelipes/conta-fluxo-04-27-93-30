-- Função para atualizar o full_name dos usuários existentes que não têm
CREATE OR REPLACE FUNCTION public.update_missing_display_names()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  user_record RECORD;
BEGIN
  -- Para cada usuário que não tem full_name mas tem username no metadata
  FOR user_record IN 
    SELECT id, raw_user_meta_data
    FROM auth.users 
    WHERE raw_user_meta_data->>'full_name' IS NULL 
      AND raw_user_meta_data->>'username' IS NOT NULL
  LOOP
    -- Atualizar o raw_user_meta_data para incluir full_name
    UPDATE auth.users 
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', raw_user_meta_data->>'username')
    WHERE id = user_record.id;
    
    RAISE NOTICE 'Updated display name for user: %', user_record.id;
  END LOOP;
  
  RAISE NOTICE 'Atualização de display names concluída';
END;
$function$;

-- Executar a função para corrigir usuários existentes
SELECT public.update_missing_display_names();