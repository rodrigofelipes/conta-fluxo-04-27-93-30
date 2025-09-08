-- Remove duplicate user roles, keeping admin over user when both exist
WITH duplicate_users AS (
  SELECT user_id
  FROM user_roles
  GROUP BY user_id
  HAVING COUNT(*) > 1
),
roles_to_delete AS (
  SELECT ur.id
  FROM user_roles ur
  INNER JOIN duplicate_users du ON ur.user_id = du.user_id
  WHERE ur.role = 'user'::app_role
    AND EXISTS (
      SELECT 1 FROM user_roles ur2 
      WHERE ur2.user_id = ur.user_id 
        AND ur2.role = 'admin'::app_role
    )
)
DELETE FROM user_roles 
WHERE id IN (SELECT id FROM roles_to_delete);

-- Add unique constraint to prevent future duplicates
ALTER TABLE user_roles 
DROP CONSTRAINT IF EXISTS unique_user_role;

ALTER TABLE user_roles 
ADD CONSTRAINT unique_user_role UNIQUE (user_id);

-- Update sync function to avoid creating duplicates
CREATE OR REPLACE FUNCTION public.sync_auth_users_with_profiles_and_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Inserir perfis faltantes baseados em auth.users
  INSERT INTO public.profiles (user_id, username, full_name, email, telefone)
  SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)),
    au.email,
    au.raw_user_meta_data ->> 'telefone'
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL;
  
  -- Inserir roles faltantes (padrão 'user') - ONLY ONE ROLE PER USER
  INSERT INTO public.user_roles (user_id, role)  
  SELECT 
    au.id,
    CASE 
      WHEN au.raw_user_meta_data->>'created_by_admin' = 'true' THEN 'user'::app_role
      ELSE 'admin'::app_role
    END
  FROM auth.users au
  LEFT JOIN public.user_roles ur ON au.id = ur.user_id
  WHERE ur.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Atualizar profiles existentes com dados mais recentes do auth
  UPDATE public.profiles 
  SET 
    email = au.email,
    username = COALESCE(au.raw_user_meta_data ->> 'username', profiles.username),
    full_name = COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', profiles.full_name),
    telefone = COALESCE(au.raw_user_meta_data ->> 'telefone', profiles.telefone),
    updated_at = now()
  FROM auth.users au
  WHERE profiles.user_id = au.id;
  
  -- Log do resultado
  RAISE NOTICE 'Sincronização entre auth.users, profiles e user_roles concluída - sem duplicatas';
END;
$$;