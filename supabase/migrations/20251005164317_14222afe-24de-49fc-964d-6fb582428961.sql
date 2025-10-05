-- Adicionar coluna viewed_at na tabela messages para rastrear mensagens lidas
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;