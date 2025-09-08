-- Remover o cron job atual
SELECT cron.unschedule('daily-whatsapp-agenda-direct');

-- Criar um cron job simples que funcione (usando DO block)
SELECT cron.schedule(
    'daily-whatsapp-agenda-working',
    '25 8 * * *',  -- 08:25 para testar em alguns minutos (horário atual: 08:20)
    $$
    DO $$
    DECLARE
        result jsonb;
    BEGIN
        -- Fazer chamada HTTP
        SELECT net.http_post(
            url := 'https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjM1MTgsImV4cCI6MjA3MTg5OTUxOH0.IcDdMVIfqF8RYatNUFcW17fx6jro-Zfif27jGqcjXU8"}'::jsonb,
            body := '{"scheduled": true, "trigger": "cron", "source": "database_cron"}'::jsonb
        ) INTO result;
        
        -- Log simples da execução
        INSERT INTO public.daily_whatsapp_log (
            user_name, 
            appointments_count, 
            message_content, 
            whatsapp_status,
            error_details
        ) VALUES (
            'Sistema - Cron Direto',
            0,
            'Execução automática cron - teste DO block',
            'cron_triggered',
            result
        );
    END;
    $$;
    $$
);

-- Atualizar configuração do sistema
UPDATE system_settings 
SET setting_value = '25 8 * * *' 
WHERE setting_key = 'whatsapp_agenda_schedule';