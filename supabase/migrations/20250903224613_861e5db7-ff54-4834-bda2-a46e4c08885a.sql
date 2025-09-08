-- Criar uma função que será executada diretamente pelo cron
CREATE OR REPLACE FUNCTION public.send_daily_whatsapp_agenda()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    agenda_count integer;
BEGIN
    -- Fazer uma chamada HTTP para a edge function
    SELECT net.http_post(
        url := 'https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjM1MTgsImV4cCI6MjA3MTg5OTUxOH0.IcDdMVIfqF8RYatNUFcW17fx6jro-Zfif27jGqcjXU8"}'::jsonb,
        body := '{"scheduled": true, "trigger": "cron", "source": "database_function"}'::jsonb
    ) INTO result;
    
    -- Log da execução
    INSERT INTO public.daily_whatsapp_log (
        user_name, 
        appointments_count, 
        message_content, 
        whatsapp_status,
        error_details
    ) VALUES (
        'System - Cron Job',
        0,
        'Execução automática via cron job - função de banco',
        'cron_executed',
        result
    );
    
    RETURN result;
END;
$$;

-- Remover o cron job anterior
SELECT cron.unschedule('daily-whatsapp-agenda-1936');

-- Criar novo cron job que chama a função diretamente
SELECT cron.schedule(
    'daily-whatsapp-agenda-direct',
    '50 19 * * *',  -- 19:50 para testar em alguns minutos
    'SELECT public.send_daily_whatsapp_agenda();'
);

-- Atualizar configuração do sistema
UPDATE system_settings 
SET setting_value = '50 19 * * *' 
WHERE setting_key = 'whatsapp_agenda_schedule';