-- Remover o cron job antigo
SELECT cron.unschedule('daily-whatsapp-agenda-1933');

-- Recriar o cron job com configuração corrigida
SELECT cron.schedule(
  'daily-whatsapp-agenda-1936',
  '36 19 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjM1MTgsImV4cCI6MjA3MTg5OTUxOH0.IcDdMVIfqF8RYatNUFcW17fx6jro-Zfif27jGqcjXU8"}'::jsonb,
        body:='{"scheduled": true, "trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Atualizar a configuração no sistema
UPDATE system_settings 
SET setting_value = '36 19 * * *', 
    updated_at = now()
WHERE setting_key = 'whatsapp_agenda_schedule';