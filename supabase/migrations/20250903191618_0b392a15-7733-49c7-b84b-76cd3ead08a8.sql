-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to send daily agenda to Débora via WhatsApp
-- Runs every day at 8:00 AM (Brasília timezone)
SELECT cron.schedule(
  'daily-debora-whatsapp-agenda',
  '0 8 * * *', -- Every day at 8:00 AM
  $$
  SELECT
    net.http_post(
      url := 'https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjM1MTgsImV4cCI6MjA3MTg5OTUxOH0.IcDdMVIfqF8RYatNUFcW17fx6jro-Zfif27jGqcjXU8"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to track WhatsApp delivery status
CREATE TABLE IF NOT EXISTS daily_whatsapp_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  appointments_count INTEGER NOT NULL DEFAULT 0,
  whatsapp_status TEXT NOT NULL DEFAULT 'pending',
  message_content TEXT,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the log table
ALTER TABLE daily_whatsapp_log ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view logs
CREATE POLICY "Authenticated users can view WhatsApp logs" 
ON daily_whatsapp_log 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Policy for system to insert logs
CREATE POLICY "System can insert WhatsApp logs" 
ON daily_whatsapp_log 
FOR INSERT 
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_daily_whatsapp_log_updated_at
  BEFORE UPDATE ON daily_whatsapp_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();