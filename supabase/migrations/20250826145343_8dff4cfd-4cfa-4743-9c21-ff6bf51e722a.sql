-- Verificar clientes órfãos (que não têm usuário correspondente)
SELECT 
  c.id,
  c.nome,
  c.email,
  c.telefone,
  'Profile match' as match_type
FROM public.clientes c
LEFT JOIN public.profiles p ON (c.email = p.email OR c.telefone = p.telefone)
WHERE p.user_id IS NULL
LIMIT 10;

-- Criar função para limpar clientes órfãos baseados em email/telefone
CREATE OR REPLACE FUNCTION public.cleanup_orphan_clients()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Deletar clientes que não têm profile correspondente por email ou telefone
  DELETE FROM public.clientes c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE (c.email = p.email AND c.email IS NOT NULL) 
       OR (c.telefone = p.telefone AND c.telefone IS NOT NULL)
  )
  AND (c.email IS NOT NULL OR c.telefone IS NOT NULL);
  
  RAISE NOTICE 'Clientes órfãos removidos automaticamente';
END;
$$;

-- Criar função para limpar clientes quando profile for deletado
CREATE OR REPLACE FUNCTION public.cleanup_clients_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Deletar clientes que correspondem ao profile deletado
  DELETE FROM public.clientes 
  WHERE (email = OLD.email AND OLD.email IS NOT NULL)
     OR (telefone = OLD.telefone AND OLD.telefone IS NOT NULL);
  
  RAISE NOTICE 'Clientes relacionados ao profile % removidos automaticamente', OLD.user_id;
  RETURN OLD;
END;
$$;

-- Criar função para limpar clientes quando usuário da auth for deletado
CREATE OR REPLACE FUNCTION public.cleanup_clients_on_auth_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Deletar clientes que correspondem ao email do usuário deletado
  DELETE FROM public.clientes 
  WHERE email = OLD.email AND OLD.email IS NOT NULL;
  
  RAISE NOTICE 'Clientes relacionados ao usuário % removidos automaticamente', OLD.id;
  RETURN OLD;
END;
$$;

-- Criar triggers para limpeza automática
DROP TRIGGER IF EXISTS trigger_cleanup_clients_on_profile_delete ON public.profiles;
CREATE TRIGGER trigger_cleanup_clients_on_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_clients_on_profile_delete();

DROP TRIGGER IF EXISTS trigger_cleanup_clients_on_auth_delete ON auth.users;
CREATE TRIGGER trigger_cleanup_clients_on_auth_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_clients_on_auth_delete();

-- Executar limpeza imediata dos clientes órfãos existentes
SELECT public.cleanup_orphan_clients();

-- Verificar resultado da limpeza
SELECT 
  COUNT(*) as total_clientes_restantes,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as clientes_com_email,
  COUNT(CASE WHEN telefone IS NOT NULL THEN 1 END) as clientes_com_telefone
FROM public.clientes;

-- Verificar se ainda existem clientes órfãos
SELECT 
  c.id,
  c.nome,
  c.email,
  c.telefone
FROM public.clientes c
LEFT JOIN public.profiles p ON (c.email = p.email OR c.telefone = p.telefone)
WHERE p.user_id IS NULL
LIMIT 5;