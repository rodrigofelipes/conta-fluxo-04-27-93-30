-- Adicionar campo start_date na tabela project_phases
ALTER TABLE project_phases 
ADD COLUMN start_date DATE;

-- Criar tabela de log para auditoria de mudanças de status
CREATE TABLE IF NOT EXISTS phase_status_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES project_phases(id) ON DELETE CASCADE,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  changed_by TEXT DEFAULT 'system_auto',
  reason TEXT
);

-- Habilitar RLS na tabela de logs
ALTER TABLE phase_status_changes ENABLE ROW LEVEL SECURITY;

-- Política para visualizar logs (autenticados)
CREATE POLICY "Authenticated users can view status changes"
ON phase_status_changes FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Política para sistema inserir logs
CREATE POLICY "System can insert status changes"
ON phase_status_changes FOR INSERT
WITH CHECK (true);

-- Criar função para atualização automática de status por data
CREATE OR REPLACE FUNCTION auto_update_phase_status_by_date()
RETURNS TABLE(updated_count INTEGER, phase_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_phases UUID[];
  update_count INTEGER := 0;
  phase_record RECORD;
BEGIN
  -- Buscar fases pendentes que devem iniciar hoje
  FOR phase_record IN 
    SELECT id, phase_name, status
    FROM project_phases
    WHERE status = 'pending'
      AND start_date IS NOT NULL
      AND start_date <= CURRENT_DATE
  LOOP
    -- Registrar mudança de status
    INSERT INTO phase_status_changes (
      phase_id,
      old_status,
      new_status,
      reason
    ) VALUES (
      phase_record.id,
      phase_record.status,
      'in_progress',
      'Início automático por data programada'
    );
    
    -- Adicionar à lista de fases atualizadas
    updated_phases := array_append(updated_phases, phase_record.id);
    update_count := update_count + 1;
  END LOOP;
  
  -- Atualizar status das fases
  IF update_count > 0 THEN
    UPDATE project_phases
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = ANY(updated_phases);
  END IF;
  
  RETURN QUERY SELECT update_count, COALESCE(updated_phases, '{}'::UUID[]);
END;
$$;