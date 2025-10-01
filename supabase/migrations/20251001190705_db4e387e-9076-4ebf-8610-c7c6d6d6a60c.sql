-- Fase 1 e 3: Adicionar role marketing e melhorias nas project_phases
-- Adicionar 'marketing' ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'marketing';

-- Adicionar colunas de prioridade e data de entrega às fases
ALTER TABLE project_phases 
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
ADD COLUMN IF NOT EXISTS due_date date;

-- Fase 4: Melhorias na tabela de reuniões
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS external_location boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS distance_km numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS travel_cost numeric DEFAULT 0;

-- Criar tabela de atas de reunião
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- RLS policies para meeting_minutes
CREATE POLICY "Authenticated users can view meeting minutes"
ON meeting_minutes FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert meeting minutes"
ON meeting_minutes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Authenticated users can update meeting minutes"
ON meeting_minutes FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete meeting minutes"
ON meeting_minutes FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Criar tabela de configurações do sistema (para valor por km)
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- RLS policies para system_config
CREATE POLICY "Only admins can manage system config"
ON system_config FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Inserir valor padrão por km
INSERT INTO system_config (config_key, config_value, description)
VALUES ('travel_cost_per_km', '2.50', 'Valor em reais cobrado por quilômetro de deslocamento')
ON CONFLICT (config_key) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_meeting_minutes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_meeting_minutes_updated_at
BEFORE UPDATE ON meeting_minutes
FOR EACH ROW
EXECUTE FUNCTION update_meeting_minutes_updated_at();

CREATE TRIGGER update_system_config_updated_at
BEFORE UPDATE ON system_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();