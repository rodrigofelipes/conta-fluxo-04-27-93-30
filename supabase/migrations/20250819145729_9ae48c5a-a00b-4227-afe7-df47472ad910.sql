-- Primeiro, vamos criar um novo enum para os setores
CREATE TYPE public.setor AS ENUM ('PESSOAL', 'FISCAL', 'CONTABIL', 'PLANEJAMENTO');

-- Criar tabela para associar admins aos setores
CREATE TABLE public.admin_setores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  setor public.setor NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, setor)
);

-- Criar tabela para clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  setor public.setor NOT NULL,
  admin_responsavel UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS nas novas tabelas
ALTER TABLE public.admin_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário é master admin
CREATE OR REPLACE FUNCTION public.is_user_master_admin(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_admins 
    WHERE user_id = user_id_param
  );
$$;

-- Função para verificar se usuário tem acesso ao setor
CREATE OR REPLACE FUNCTION public.user_has_setor_access(user_id_param UUID, setor_param public.setor)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_setores 
    WHERE user_id = user_id_param AND setor = setor_param
  ) OR public.is_user_master_admin(user_id_param);
$$;

-- Políticas RLS para admin_setores
CREATE POLICY "Master admins can view all admin setores" 
ON public.admin_setores 
FOR SELECT 
USING (public.is_user_master_admin(auth.uid()));

CREATE POLICY "Master admins can insert admin setores" 
ON public.admin_setores 
FOR INSERT 
WITH CHECK (public.is_user_master_admin(auth.uid()));

CREATE POLICY "Master admins can update admin setores" 
ON public.admin_setores 
FOR UPDATE 
USING (public.is_user_master_admin(auth.uid()));

CREATE POLICY "Master admins can delete admin setores" 
ON public.admin_setores 
FOR DELETE 
USING (public.is_user_master_admin(auth.uid()));

-- Políticas RLS para clientes
CREATE POLICY "Admins can view clients from their setor" 
ON public.clientes 
FOR SELECT 
USING (
  public.is_user_master_admin(auth.uid()) OR 
  public.user_has_setor_access(auth.uid(), setor)
);

CREATE POLICY "Admins can insert clients in their setor" 
ON public.clientes 
FOR INSERT 
WITH CHECK (
  public.is_user_master_admin(auth.uid()) OR 
  public.user_has_setor_access(auth.uid(), setor)
);

CREATE POLICY "Admins can update clients from their setor" 
ON public.clientes 
FOR UPDATE 
USING (
  public.is_user_master_admin(auth.uid()) OR 
  public.user_has_setor_access(auth.uid(), setor)
);

CREATE POLICY "Admins can delete clients from their setor" 
ON public.clientes 
FOR DELETE 
USING (
  public.is_user_master_admin(auth.uid()) OR 
  public.user_has_setor_access(auth.uid(), setor)
);

-- Trigger para atualizar updated_at em clientes
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();