-- CORREÇÃO 1: Ajustar a função auto_sync_users para melhor lógica de roles
CREATE OR REPLACE FUNCTION public.auto_sync_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
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
    
    -- Criar profile para novo usuário
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
      telefone = EXCLUDED.telefone;
    
    -- Remover todos os roles existentes e criar apenas o correto
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    
    INSERT INTO public.user_roles (user_id, role, username, telefone)
    VALUES (
      NEW.id, 
      user_role,
      user_username,
      NEW.raw_user_meta_data ->> 'telefone'
    );
    
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
      telefone = NEW.raw_user_meta_data ->> 'telefone'
    WHERE user_id = NEW.id;
    
    -- Atualizar admin_setores se existe
    UPDATE public.admin_setores 
    SET username = user_username 
    WHERE user_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- CORREÇÃO 2: Garantir que políticas RLS dos clientes permitam criação por admins
DROP POLICY IF EXISTS "Admins can insert clients in their setor" ON public.clientes;
CREATE POLICY "Admins can insert clients in their setor" 
ON public.clientes 
FOR INSERT 
WITH CHECK (
  is_admin() AND 
  (is_user_master_admin(auth.uid()) OR user_has_setor_access(auth.uid(), setor))
);

-- CORREÇÃO 3: Função para sincronizar criação de cliente após criação de usuário
CREATE OR REPLACE FUNCTION public.create_client_after_user(
  client_data jsonb,
  user_id_param uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_client_id uuid;
BEGIN
  -- Verificar se quem está chamando é admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can create clients';
  END IF;
  
  -- Aguardar um pouco para garantir que o usuário foi criado
  PERFORM pg_sleep(0.1);
  
  -- Verificar se o profile foi criado
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = user_id_param) THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', user_id_param;
  END IF;
  
  -- Inserir cliente
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
    situacao
  )
  VALUES (
    client_data->>'nome',
    client_data->>'email',
    client_data->>'telefone',
    (client_data->>'setor')::setor,
    (client_data->>'admin_responsavel')::uuid,
    client_data->>'razao_social',
    client_data->>'cnpj',
    client_data->>'regime_tributario',
    client_data->>'endereco',
    client_data->>'cidade',
    client_data->>'estado',
    client_data->>'cep',
    COALESCE(client_data->>'situacao', 'ATIVO')
  )
  RETURNING id INTO new_client_id;
  
  RETURN new_client_id;
END;
$$;