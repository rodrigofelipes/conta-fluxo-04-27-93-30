-- Adicionar coluna payment_method na tabela client_financials
ALTER TABLE public.client_financials 
ADD COLUMN payment_method text;

-- Adicionar comentário explicativo na coluna
COMMENT ON COLUMN public.client_financials.payment_method IS 'Forma de pagamento: PIX, TED, DOC, Dinheiro, Cartão, etc.';