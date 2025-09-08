-- Adicionar coluna telefone na tabela profiles se ela não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telefone text;