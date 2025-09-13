-- Função para verificar se uma fase tem time entries (foi iniciada por algum colaborador)
CREATE OR REPLACE FUNCTION public.phase_has_time_entries(phase_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM time_entries 
    WHERE phase_id = phase_id_param
  );
END;
$$;