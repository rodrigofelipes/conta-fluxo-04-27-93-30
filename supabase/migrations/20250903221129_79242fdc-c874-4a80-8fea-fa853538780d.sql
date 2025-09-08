-- Add new system settings for WhatsApp configuration
INSERT INTO system_settings (setting_key, setting_value, created_by, description) 
VALUES 
  ('whatsapp_recipient_number', '5511999999999', (SELECT user_id FROM profiles WHERE role = 'admin' LIMIT 1), 'Número do WhatsApp que receberá a agenda diária'),
  ('whatsapp_agenda_owner', 'Débora', (SELECT user_id FROM profiles WHERE role = 'admin' LIMIT 1), 'Nome do usuário cuja agenda será enviada'),
  ('whatsapp_timezone', 'America/Sao_Paulo', (SELECT user_id FROM profiles WHERE role = 'admin' LIMIT 1), 'Timezone para cálculos de horário da agenda')
ON CONFLICT (setting_key) DO UPDATE SET 
  updated_at = now(),
  updated_by = excluded.created_by;

-- Add daily execution lock table
CREATE TABLE IF NOT EXISTS daily_execution_locks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lock_key text NOT NULL UNIQUE,
  execution_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  executed_by text NOT NULL
);

-- Enable RLS on execution locks
ALTER TABLE daily_execution_locks ENABLE ROW LEVEL SECURITY;

-- Policy to allow system functions to manage locks
CREATE POLICY "System can manage execution locks" 
ON daily_execution_locks 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_execution_locks_date_key 
ON daily_execution_locks(execution_date, lock_key);