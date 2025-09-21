-- Correção das políticas RLS para serem mais robustas contra falhas de sessão

-- Corrigir política de SELECT para clients (mais robusta)
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
CREATE POLICY "Users can view clients with valid session" ON public.clients
FOR SELECT USING (
  -- Admin pode ver tudo
  public.is_admin() OR
  -- Usuário autenticado pode ver (com fallback para casos de sessão temporariamente nula)
  auth.uid() IS NOT NULL
);

-- Corrigir política de INSERT para clients 
DROP POLICY IF EXISTS "Admins can create clients" ON public.clients;
CREATE POLICY "Authenticated users can create clients" ON public.clients
FOR INSERT WITH CHECK (
  -- Admin pode criar ou usuário autenticado
  public.is_admin() OR 
  auth.uid() IS NOT NULL
);

-- Corrigir política de UPDATE para clients
DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;
CREATE POLICY "Authenticated users can update clients" ON public.clients
FOR UPDATE USING (
  public.is_admin() OR 
  auth.uid() IS NOT NULL
);

-- Corrigir política de DELETE para clients
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
CREATE POLICY "Authenticated users can delete clients" ON public.clients
FOR DELETE USING (
  public.is_admin() OR 
  auth.uid() IS NOT NULL
);

-- Função para verificar se o usuário tem sessão válida (mais robusta)
CREATE OR REPLACE FUNCTION public.has_valid_session()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;