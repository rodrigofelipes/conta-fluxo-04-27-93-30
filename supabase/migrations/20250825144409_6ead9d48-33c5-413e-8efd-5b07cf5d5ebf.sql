-- Habilitar real-time para a tabela messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Adicionar a tabela messages à publicação de real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;