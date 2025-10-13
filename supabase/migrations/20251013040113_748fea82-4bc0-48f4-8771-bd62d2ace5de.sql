-- Fase 1.1: Adicionar colunas para Google Calendar na tabela agenda
ALTER TABLE agenda 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agenda_google_event_id ON agenda(google_event_id);

-- Fase 1.2: Criar tabela de log de sincronização
CREATE TABLE IF NOT EXISTS google_calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id UUID REFERENCES agenda(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('system_to_google', 'google_to_system')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('success', 'failed', 'pending')),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sync_log_agenda_id ON google_calendar_sync_log(agenda_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_google_event_id ON google_calendar_sync_log(google_event_id);

-- RLS para a tabela de log
ALTER TABLE google_calendar_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sync logs"
ON google_calendar_sync_log
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert sync logs"
ON google_calendar_sync_log
FOR INSERT
TO authenticated
WITH CHECK (true);