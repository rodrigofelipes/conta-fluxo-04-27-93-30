-- Create cron job for daily WhatsApp agenda at 17:07 for testing
SELECT cron.schedule(
  'daily-whatsapp-agenda-test',
  '7 17 * * *', -- At 17:07 every day  
  $$
  SELECT
    net.http_post(
        url:='https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyMzUxOCwiZXhwIjoyMDcxODk5NTE4fQ.b2MGLF5qjy8DHsojj0TRsHqRzXwp8qE_zJTbrJvlXNI"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);