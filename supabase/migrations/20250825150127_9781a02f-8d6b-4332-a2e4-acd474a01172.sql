-- Otimizar performance da tabela messages para realtime
-- Habilitar realtime para a tabela messages se não estiver habilitado
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Adicionar índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_messages_realtime_lookup 
ON public.messages (to_user_id, from_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_user_conversation 
ON public.messages (from_user_id, to_user_id, created_at ASC);

-- Adicionar tabela à publicação realtime se não estiver
DO $$
BEGIN
    -- Verificar se a tabela já está na publicação
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;