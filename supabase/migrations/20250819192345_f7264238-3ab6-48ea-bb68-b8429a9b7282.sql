-- Adicionar novos campos à tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN endereco TEXT,
ADD COLUMN bairro TEXT,
ADD COLUMN numero TEXT,
ADD COLUMN cep TEXT,
ADD COLUMN situacao TEXT DEFAULT 'ATIVO' CHECK (situacao IN ('ATIVO', 'INATIVO')),
ADD COLUMN cliente_desde DATE,
ADD COLUMN apelido TEXT,
ADD COLUMN razao_social TEXT;

-- Adicionar comentários para documentar os campos
COMMENT ON COLUMN public.clientes.endereco IS 'Endereço completo do cliente';
COMMENT ON COLUMN public.clientes.bairro IS 'Bairro do cliente';
COMMENT ON COLUMN public.clientes.numero IS 'Número do endereço';
COMMENT ON COLUMN public.clientes.cep IS 'CEP do cliente';
COMMENT ON COLUMN public.clientes.situacao IS 'Situação do cliente: ATIVO ou INATIVO';
COMMENT ON COLUMN public.clientes.cliente_desde IS 'Data desde quando é cliente';
COMMENT ON COLUMN public.clientes.apelido IS 'Nome fantasia ou apelido';
COMMENT ON COLUMN public.clientes.razao_social IS 'Razão social da empresa';