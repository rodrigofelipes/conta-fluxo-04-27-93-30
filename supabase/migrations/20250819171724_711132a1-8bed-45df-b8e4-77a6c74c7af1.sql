-- Adicionar campos CNPJ, regime tributário e cidade/estado na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN cnpj TEXT,
ADD COLUMN regime_tributario TEXT,
ADD COLUMN cidade TEXT,
ADD COLUMN estado TEXT;

-- Criar índice para CNPJ para busca rápida
CREATE INDEX idx_clientes_cnpj ON public.clientes(cnpj) WHERE cnpj IS NOT NULL;