-- Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Criar índices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS messages_conversation_performance_idx 
ON public.messages (from_user_id, to_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_unread_idx 
ON public.messages (to_user_id, viewed_at, created_at) 
WHERE viewed_at IS NULL;

-- Índice para busca de clientes por telefone
CREATE INDEX IF NOT EXISTS clientes_telefone_gin_idx 
ON public.clientes USING gin (telefone gin_trgm_ops);

-- Índice para user_roles + profiles join
CREATE INDEX IF NOT EXISTS user_roles_admin_idx 
ON public.user_roles (role, created_at) 
WHERE role = 'admin';