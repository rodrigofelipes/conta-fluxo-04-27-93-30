-- Corrigir função com search_path adequado
CREATE OR REPLACE FUNCTION public.trigger_daily_whatsapp()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Log da execução direta no banco para debug
  INSERT INTO daily_whatsapp_log (
    user_name, 
    appointments_count, 
    message_content, 
    whatsapp_status,
    error_details
  ) VALUES (
    'System - DB Function',
    0,
    'Chamando edge function via trigger_daily_whatsapp()',
    'invoking',
    jsonb_build_object('trigger_time', now())
  );

  -- Fazer chamada HTTP direta para a edge function usando net.http_post
  SELECT net.http_post(
    url := 'https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjM1MTgsImV4cCI6MjA3MTg5OTUxOH0.IcDdMVIfqF8RYatNUFcW17fx6jro-Zfif27jGqcjXU8'
    ),
    body := jsonb_build_object(
      'scheduled', true, 
      'trigger', 'database_function',
      'source', 'trigger_daily_whatsapp'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;