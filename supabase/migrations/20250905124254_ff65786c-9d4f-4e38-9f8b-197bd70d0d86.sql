-- Habilitar realtime para a tabela time_entries
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;