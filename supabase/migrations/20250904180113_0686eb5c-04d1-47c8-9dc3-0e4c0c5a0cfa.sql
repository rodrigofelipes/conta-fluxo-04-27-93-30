-- Corrigir search_path das funções criadas para melhorar segurança

-- Recriar função update_phase_executed_hours com search_path correto
CREATE OR REPLACE FUNCTION public.update_phase_executed_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- If inserting or updating with end_time, calculate and update executed hours
  IF TG_OP = 'INSERT' AND NEW.end_time IS NOT NULL AND NEW.phase_id IS NOT NULL THEN
    UPDATE project_phases 
    SET executed_hours = COALESCE(executed_hours, 0) + COALESCE(NEW.duration_minutes, 0) / 60.0
    WHERE id = NEW.phase_id;
  END IF;
  
  -- If updating and end_time was added, update executed hours
  IF TG_OP = 'UPDATE' AND OLD.end_time IS NULL AND NEW.end_time IS NOT NULL AND NEW.phase_id IS NOT NULL THEN
    UPDATE project_phases 
    SET executed_hours = COALESCE(executed_hours, 0) + COALESCE(NEW.duration_minutes, 0) / 60.0
    WHERE id = NEW.phase_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recriar função update_updated_at_column com search_path correto
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;