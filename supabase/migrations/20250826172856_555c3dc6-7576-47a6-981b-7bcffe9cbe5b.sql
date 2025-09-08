-- Recriar a função create_client_after_user com melhor tratamento de erros e logs
CREATE OR REPLACE FUNCTION public.create_client_after_user(client_data jsonb, user_id_param uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_client_id uuid;
  profile_exists boolean;
  user_role_exists boolean;
BEGIN
  -- Log de início
  RAISE NOTICE 'create_client_after_user: Iniciando com user_id: % e dados: %', user_id_param, client_data;
  
  -- Verificar se quem está chamando é admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can create clients';
  END IF;
  
  -- Verificar se user_id_param foi fornecido
  IF user_id_param IS NULL THEN
    RAISE EXCEPTION 'user_id_param cannot be null';
  END IF;
  
  -- Aguardar um pouco para garantir que o usuário foi criado
  PERFORM pg_sleep(0.2);
  
  -- Verificar se o profile foi criado
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = user_id_param) INTO profile_exists;
  RAISE NOTICE 'Profile exists: %', profile_exists;
  
  IF NOT profile_exists THEN
    RAISE EXCEPTION 'User profile not found for user_id: %. Profile must be created first.', user_id_param;
  END IF;
  
  -- Verificar se o user_role foi criado
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = user_id_param) INTO user_role_exists;
  RAISE NOTICE 'User role exists: %', user_role_exists;
  
  IF NOT user_role_exists THEN
    RAISE EXCEPTION 'User role not found for user_id: %. User role must be created first.', user_id_param;
  END IF;
  
  -- Verificar se os dados do cliente são válidos
  IF client_data->>'nome' IS NULL OR client_data->>'nome' = '' THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;
  
  IF client_data->>'setor' IS NULL THEN
    RAISE EXCEPTION 'Client setor is required';
  END IF;
  
  -- Inserir cliente
  RAISE NOTICE 'Inserindo cliente com dados: %', client_data;
  
  INSERT INTO clientes (
    nome, 
    email, 
    telefone, 
    setor,
    admin_responsavel,
    razao_social,
    cnpj,
    regime_tributario,
    endereco,
    cidade,
    estado,
    cep,
    situacao,
    data_abertura,
    inscricao_estadual
  )
  VALUES (
    client_data->>'nome',
    NULLIF(client_data->>'email', ''),
    NULLIF(client_data->>'telefone', ''),
    (client_data->>'setor')::setor,
    (client_data->>'admin_responsavel')::uuid,
    COALESCE(client_data->>'razao_social', client_data->>'nome'),
    NULLIF(client_data->>'cnpj', ''),
    NULLIF(client_data->>'regime_tributario', ''),
    NULLIF(client_data->>'endereco', ''),
    NULLIF(client_data->>'cidade', ''),
    NULLIF(client_data->>'estado', ''),
    NULLIF(client_data->>'cep', ''),
    COALESCE(NULLIF(client_data->>'situacao', ''), 'ATIVO'),
    CASE 
      WHEN client_data->>'data_abertura' IS NOT NULL AND client_data->>'data_abertura' != '' 
      THEN (client_data->>'data_abertura')::date 
      ELSE NULL 
    END,
    NULLIF(client_data->>'inscricao_estadual', '')
  )
  RETURNING id INTO new_client_id;
  
  RAISE NOTICE 'Cliente criado com sucesso, ID: %', new_client_id;
  
  RETURN new_client_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro na função create_client_after_user: % %', SQLSTATE, SQLERRM;
    RAISE;
END;
$$;