-- ============================================
-- MÓDULO DE ATA INTELIGENTE
-- Migration completa: Tabelas, RLS, Storage, Functions
-- ============================================

-- 1. Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela de atas de reunião
CREATE TABLE IF NOT EXISTS meeting_atas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id UUID REFERENCES agenda(id) ON DELETE CASCADE,
  meeting_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'completed', 'failed')),
  
  -- LGPD e compliance
  consent_obtained BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at TIMESTAMPTZ,
  retention_until DATE,
  
  -- Sumário processado
  processed_summary TEXT,
  decisions JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  
  -- Armazenamento
  audio_file_url TEXT,
  audio_size_bytes BIGINT,
  
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de utterances (falas individuais)
CREATE TABLE IF NOT EXISTS utterances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id UUID NOT NULL REFERENCES meeting_atas(id) ON DELETE CASCADE,
  
  -- Segmentação temporal
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  
  -- Diarização
  diar_label TEXT NOT NULL,
  
  -- Identificação (pode ser NULL no início)
  person_id UUID REFERENCES profiles(id),
  identified_name TEXT,
  confidence_score FLOAT DEFAULT 0.0,
  
  -- Conteúdo
  transcript TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de perfis de voz
CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  
  -- Embedding de voz (256 dimensões)
  voice_embedding VECTOR(256),
  
  -- Limiar de similaridade configurável
  similarity_threshold FLOAT DEFAULT 0.25,
  
  -- Metadados
  samples_count INTEGER DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_utterances_ata ON utterances(ata_id);
CREATE INDEX IF NOT EXISTS idx_utterances_person ON utterances(person_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_person ON voice_profiles(person_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_embedding ON voice_profiles USING ivfflat(voice_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_meeting_atas_agenda ON meeting_atas(agenda_id);
CREATE INDEX IF NOT EXISTS idx_meeting_atas_retention ON meeting_atas(retention_until) WHERE status = 'completed';

-- 6. RLS Policies
ALTER TABLE meeting_atas ENABLE ROW LEVEL SECURITY;
ALTER TABLE utterances ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

-- Policies para meeting_atas
CREATE POLICY "Users can view atas they created or participated"
  ON meeting_atas FOR SELECT
  USING (
    auth.uid() = created_by 
    OR auth.uid() IN (
      SELECT p.user_id FROM utterances u
      JOIN profiles p ON u.person_id = p.id
      WHERE u.ata_id = meeting_atas.id
    )
    OR is_admin()
  );

CREATE POLICY "Users can insert atas"
  ON meeting_atas FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their atas"
  ON meeting_atas FOR UPDATE
  USING (auth.uid() = created_by OR is_admin());

-- Policies para utterances
CREATE POLICY "Users can view utterances from atas they can access"
  ON utterances FOR SELECT
  USING (
    ata_id IN (
      SELECT id FROM meeting_atas WHERE 
        auth.uid() = created_by 
        OR auth.uid() IN (
          SELECT p.user_id FROM utterances u2
          JOIN profiles p ON u2.person_id = p.id
          WHERE u2.ata_id = meeting_atas.id
        )
        OR is_admin()
    )
  );

CREATE POLICY "System can insert utterances"
  ON utterances FOR INSERT
  WITH CHECK (true);

-- Policies para voice_profiles
CREATE POLICY "Users can view their own voice profiles"
  ON voice_profiles FOR SELECT
  USING (auth.uid() = person_id OR is_admin());

CREATE POLICY "Users can insert their voice profile"
  ON voice_profiles FOR INSERT
  WITH CHECK (auth.uid() = person_id);

CREATE POLICY "Users can update their voice profile"
  ON voice_profiles FOR UPDATE
  USING (auth.uid() = person_id);

-- 7. Storage bucket para áudios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-audio',
  'meeting-audio',
  false,
  524288000, -- 500MB
  ARRAY['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage policies
CREATE POLICY "Users can upload their meeting audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-audio' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view their meeting audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'meeting-audio'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their meeting audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'meeting-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 9. Função para identificação de falante por voz
CREATE OR REPLACE FUNCTION match_voice_profile(
  query_embedding VECTOR(256),
  match_threshold FLOAT DEFAULT 0.25,
  match_count INT DEFAULT 1
)
RETURNS TABLE (
  person_id UUID,
  similarity FLOAT,
  identified_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vp.person_id,
    1 - (vp.voice_embedding <=> query_embedding) as similarity,
    p.name as identified_name
  FROM voice_profiles vp
  JOIN profiles p ON vp.person_id = p.id
  WHERE 1 - (vp.voice_embedding <=> query_embedding) > vp.similarity_threshold
  ORDER BY vp.voice_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 10. Função de purga automática (LGPD)
CREATE OR REPLACE FUNCTION purge_expired_atas()
RETURNS TABLE(purged_count INTEGER, purged_audio_paths TEXT[]) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_purged INTEGER := 0;
  audio_paths TEXT[];
BEGIN
  -- Coletar URLs de áudio para deletar do storage
  SELECT ARRAY_AGG(audio_file_url)
  INTO audio_paths
  FROM meeting_atas
  WHERE retention_until < CURRENT_DATE
    AND status = 'completed'
    AND audio_file_url IS NOT NULL;
  
  -- Deletar atas expiradas (CASCADE vai deletar utterances)
  DELETE FROM meeting_atas
  WHERE retention_until < CURRENT_DATE
    AND status = 'completed';
  
  GET DIAGNOSTICS count_purged = ROW_COUNT;
  
  RETURN QUERY SELECT count_purged, COALESCE(audio_paths, ARRAY[]::TEXT[]);
END;
$$;

-- 11. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_meeting_atas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER meeting_atas_updated_at
  BEFORE UPDATE ON meeting_atas
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_atas_updated_at();