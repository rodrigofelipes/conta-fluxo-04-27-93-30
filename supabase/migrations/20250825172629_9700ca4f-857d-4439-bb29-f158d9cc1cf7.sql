-- Função para sincronizar profiles e user_roles
CREATE OR REPLACE FUNCTION sync_profiles_user_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Inserir role 'user' para profiles que não têm role
  INSERT INTO user_roles (user_id, role)
  SELECT p.user_id, 'user'::app_role
  FROM profiles p
  LEFT JOIN user_roles ur ON p.user_id = ur.user_id
  WHERE ur.user_id IS NULL;
  
  -- Log do resultado
  RAISE NOTICE 'Sincronização de profiles e user_roles concluída';
END;
$$;

-- Trigger para criar role automaticamente quando profile é criado
CREATE OR REPLACE FUNCTION auto_create_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Inserir role 'user' para novo profile
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.user_id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger para remover profile quando user_role é deletado
CREATE OR REPLACE FUNCTION auto_delete_profile_on_role_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se restam outros roles para este usuário
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = OLD.user_id) THEN
    -- Se não há mais roles, deletar o profile
    DELETE FROM profiles WHERE user_id = OLD.user_id;
    RAISE NOTICE 'Profile deletado para user_id: %', OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Criar triggers
DROP TRIGGER IF EXISTS auto_create_user_role_trigger ON profiles;
CREATE TRIGGER auto_create_user_role_trigger
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_user_role();

DROP TRIGGER IF EXISTS auto_delete_profile_trigger ON user_roles;
CREATE TRIGGER auto_delete_profile_trigger
    AFTER DELETE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION auto_delete_profile_on_role_delete();

-- Executar sincronização inicial
SELECT sync_profiles_user_roles();