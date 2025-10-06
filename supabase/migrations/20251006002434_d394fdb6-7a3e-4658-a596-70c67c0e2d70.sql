-- ====================================
-- FASE 1: SISTEMA DE UPLOAD ROBUSTO
-- Large File Upload System (2-5GB)
-- ====================================

-- 1. Criar bucket para documentos (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  5368709120, -- 5GB em bytes
  ARRAY[
    'application/pdf',
    'image/*',
    'video/*',
    'application/vnd.openxmlformats-officedocument.*',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/acad',
    'application/x-dwg',
    'application/dxf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 5368709120,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Atualizar tabela client_documents com novos campos
ALTER TABLE client_documents 
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'paused', 'verifying', 'verified', 'failed')),
ADD COLUMN IF NOT EXISTS upload_progress INTEGER DEFAULT 0 CHECK (upload_progress >= 0 AND upload_progress <= 100),
ADD COLUMN IF NOT EXISTS chunks_uploaded INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS upload_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS upload_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_metadata JSONB;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_client_docs_status ON client_documents(upload_status) WHERE upload_status != 'verified';
CREATE INDEX IF NOT EXISTS idx_client_docs_client_id ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_created ON client_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_docs_hash ON client_documents(file_hash) WHERE file_hash IS NOT NULL;

-- 3. Tabela de tokens de compartilhamento
CREATE TABLE IF NOT EXISTS document_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES client_documents(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  scope TEXT DEFAULT 'read' CHECK (scope IN ('read', 'download')),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON document_share_tokens(token) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires ON document_share_tokens(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_share_tokens_document ON document_share_tokens(document_id);

-- 4. Tabela de logs de eventos de documentos
CREATE TABLE IF NOT EXISTS document_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES client_documents(id) ON DELETE CASCADE,
  user_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'upload_started', 'upload_progress', 'upload_paused', 'upload_resumed',
    'upload_completed', 'upload_failed', 'upload_cancelled',
    'hash_started', 'hash_progress', 'hash_completed', 'hash_failed',
    'verification_started', 'verification_completed', 'verification_failed',
    'download', 'share_created', 'share_accessed', 'share_revoked',
    'file_deleted', 'metadata_updated'
  )),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_document ON document_events_log(document_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON document_events_log(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON document_events_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user ON document_events_log(user_id);

-- 5. Tabela de métricas de upload
CREATE TABLE IF NOT EXISTS upload_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  client_id UUID REFERENCES clients(id),
  document_id UUID REFERENCES client_documents(id),
  file_size BIGINT NOT NULL,
  upload_method TEXT NOT NULL CHECK (upload_method IN ('resumable', 'signed', 'standard')),
  hash_duration_ms INTEGER,
  upload_duration_ms INTEGER,
  upload_speed_mbps NUMERIC(10,2),
  chunks_count INTEGER,
  retry_count INTEGER DEFAULT 0,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_success ON upload_metrics(success);
CREATE INDEX IF NOT EXISTS idx_metrics_method ON upload_metrics(upload_method);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON upload_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_document ON upload_metrics(document_id);

-- 6. Adicionar configurações de sistema para feature flags
INSERT INTO system_config (config_key, config_value, description) VALUES
  ('enable_resumable_uploads', 'true', 'Ativar uploads resumíveis via TUS'),
  ('resumable_threshold_mb', '100', 'Tamanho mínimo (MB) para usar upload resumível'),
  ('max_file_size_gb', '5', 'Tamanho máximo de arquivo em GB'),
  ('supabase_plan', 'pro', 'Plano Supabase (free/pro/team)'),
  ('storage_quota_per_client_gb', '10', 'Cota de armazenamento por cliente em GB'),
  ('cleanup_orphaned_files_days', '2', 'Dias antes de limpar uploads incompletos'),
  ('cleanup_expired_tokens_enabled', 'true', 'Habilitar limpeza de tokens expirados')
ON CONFLICT (config_key) DO UPDATE SET
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description;

-- 7. RLS Policies para novas tabelas
ALTER TABLE document_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_events_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_metrics ENABLE ROW LEVEL SECURITY;

-- Policies para document_share_tokens
CREATE POLICY "Authenticated users can create share tokens"
  ON document_share_tokens FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can view non-revoked tokens"
  ON document_share_tokens FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() IS NOT NULL);

CREATE POLICY "Token creators can revoke their tokens"
  ON document_share_tokens FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Policies para document_events_log
CREATE POLICY "Authenticated users can view events"
  ON document_events_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert events"
  ON document_events_log FOR INSERT
  WITH CHECK (true);

-- Policies para upload_metrics
CREATE POLICY "Users can view their own metrics"
  ON upload_metrics FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "System can insert metrics"
  ON upload_metrics FOR INSERT
  WITH CHECK (true);

-- 8. RLS Policies para storage bucket client-documents
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "Authenticated users can view files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-documents');

CREATE POLICY "Authenticated users can update files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'client-documents');

CREATE POLICY "Authenticated users can delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-documents');

-- 9. Função helper para verificar tamanho de storage do cliente
CREATE OR REPLACE FUNCTION calculate_client_storage_usage(client_id_param UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_size BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0) INTO total_size
  FROM client_documents
  WHERE client_id = client_id_param
    AND upload_status = 'verified';
  
  RETURN total_size;
END;
$$;

-- 10. Função para limpar uploads órfãos e tokens expirados
CREATE OR REPLACE FUNCTION cleanup_orphaned_uploads()
RETURNS TABLE(
  orphaned_files_count INTEGER,
  expired_tokens_count INTEGER,
  incomplete_uploads_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphaned_count INTEGER := 0;
  expired_count INTEGER := 0;
  incomplete_count INTEGER := 0;
  cleanup_days INTEGER;
BEGIN
  -- Obter configuração de dias para cleanup
  SELECT COALESCE((config_value)::INTEGER, 2) INTO cleanup_days
  FROM system_config
  WHERE config_key = 'cleanup_orphaned_files_days';
  
  -- 1. Deletar tokens expirados
  DELETE FROM document_share_tokens
  WHERE expires_at < NOW()
    AND revoked_at IS NULL;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- 2. Deletar uploads incompletos antigos
  DELETE FROM client_documents
  WHERE upload_status IN ('uploading', 'paused', 'failed')
    AND upload_started_at < NOW() - (cleanup_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS incomplete_count = ROW_COUNT;
  
  -- Retornar estatísticas
  RETURN QUERY SELECT orphaned_count, expired_count, incomplete_count;
END;
$$;