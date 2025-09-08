-- Remove os cron jobs antigos
SELECT cron.unschedule('daily-debora-whatsapp-agenda');
SELECT cron.unschedule('daily-whatsapp-agenda-test');

-- Cria novo cron job com horário correto (17:38)
SELECT cron.schedule(
  'daily-whatsapp-agenda-1738',
  '38 17 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyMzUxOCwiZXhwIjoyMDcxODk5NTE4fQ.b2MGLF5qjy8DHsojj0TRsHqRzXwp8qE_zJTbrJvlXNI"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);