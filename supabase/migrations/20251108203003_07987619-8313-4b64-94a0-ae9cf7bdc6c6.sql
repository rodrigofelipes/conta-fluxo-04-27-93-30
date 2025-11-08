-- Tabela para rastrear notificações de despesas vencidas
CREATE TABLE IF NOT EXISTS public.overdue_expense_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  expense_ids UUID[] NOT NULL,
  due_date DATE NOT NULL,
  notification_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  whatsapp_sent_at TIMESTAMPTZ,
  whatsapp_sent_by UUID REFERENCES profiles(id),
  whatsapp_message_id TEXT,
  
  email_sent_at TIMESTAMPTZ,
  email_sent_by UUID REFERENCES profiles(id),
  
  total_amount DECIMAL(10,2) NOT NULL,
  expense_count INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_overdue_notifications_client ON overdue_expense_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_overdue_notifications_status ON overdue_expense_notifications(status);
CREATE INDEX IF NOT EXISTS idx_overdue_notifications_date ON overdue_expense_notifications(notification_date);

-- RLS
ALTER TABLE overdue_expense_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all overdue notifications"
  ON overdue_expense_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert overdue notifications"
  ON overdue_expense_notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update overdue notifications"
  ON overdue_expense_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Função para buscar despesas vencidas que precisam de notificação
CREATE OR REPLACE FUNCTION get_overdue_expenses_for_notification()
RETURNS TABLE(
  client_id UUID,
  expense_ids UUID[],
  due_date DATE,
  total_amount DECIMAL,
  expense_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cf.client_id,
    array_agg(cf.id) as expense_ids,
    cf.transaction_date::DATE as due_date,
    SUM(cf.amount) as total_amount,
    COUNT(*)::INTEGER as expense_count
  FROM client_financials cf
  WHERE 
    cf.status = 'pending'
    AND cf.transaction_type IN ('expense', 'payment_sent')
    AND cf.transaction_date::DATE = CURRENT_DATE - INTERVAL '5 days'
    AND cf.payment_date IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM overdue_expense_notifications oen
      WHERE oen.client_id = cf.client_id
        AND cf.id = ANY(oen.expense_ids)
        AND oen.notification_date >= CURRENT_DATE - INTERVAL '1 day'
    )
  GROUP BY cf.client_id, cf.transaction_date::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Configurar Cron Job para executar diariamente às 00:00 BRT (03:00 UTC)
SELECT cron.schedule(
  'check-overdue-expenses-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/check-overdue-expenses',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyMzUxOCwiZXhwIjoyMDcxODk5NTE4fQ.D1V8wiQgTKELahdl1Xm98i7r_LEPzAXofQR5JxMwOz0"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);