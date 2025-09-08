-- Verificar triggers existentes que podem estar causando recursão
SELECT 
    t.trigger_name,
    t.table_name,
    t.action_timing,
    t.event_manipulation,
    p.prosrc as function_body
FROM information_schema.triggers t
JOIN pg_proc p ON p.proname = substring(t.action_statement from 'EXECUTE FUNCTION ([^(]+)')
WHERE t.table_schema = 'public'
ORDER BY t.table_name, t.trigger_name;