-- Adicionar campos data_abertura e inscricao_estadual na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN data_abertura DATE,
ADD COLUMN inscricao_estadual TEXT;