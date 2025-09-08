-- Limpar cron jobs antigos
DO $$
BEGIN
    PERFORM cron.unschedule('daily-whatsapp-agenda-direct');
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

-- Criar cron job mais simples
SELECT cron.schedule(
    'daily-whatsapp-agenda-simple',
    '30 8 * * *',
    'INSERT INTO public.daily_whatsapp_log (user_name, appointments_count, message_content, whatsapp_status) VALUES (''Cron Test'', 0, ''Teste de execução automática'', ''test'');'
);

-- Atualizar configuração do sistema
UPDATE system_settings 
SET setting_value = '30 8 * * *' 
WHERE setting_key = 'whatsapp_agenda_schedule';