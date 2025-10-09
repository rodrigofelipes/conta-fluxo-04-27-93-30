-- Criar tabela para armazenar tokens OAuth do Google Drive
CREATE TABLE IF NOT EXISTS google_drive_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas seus próprios tokens
CREATE POLICY "Users can view their own tokens"
  ON google_drive_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuários podem inserir seus próprios tokens
CREATE POLICY "Users can insert their own tokens"
  ON google_drive_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: usuários podem atualizar seus próprios tokens
CREATE POLICY "Users can update their own tokens"
  ON google_drive_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: usuários podem deletar seus próprios tokens
CREATE POLICY "Users can delete their own tokens"
  ON google_drive_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_google_drive_tokens_updated_at
  BEFORE UPDATE ON google_drive_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();