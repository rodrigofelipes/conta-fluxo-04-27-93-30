-- Função para atualizar automaticamente o status da fase quando timer inicia
CREATE OR REPLACE FUNCTION public.auto_update_phase_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando um timer é iniciado (INSERT com end_time NULL), muda status para in_progress
  IF TG_OP = 'INSERT' AND NEW.end_time IS NULL AND NEW.phase_id IS NOT NULL THEN
    UPDATE project_phases 
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = NEW.phase_id 
    AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para executar a função quando uma entrada de tempo é criada
CREATE TRIGGER trigger_auto_update_phase_status
  AFTER INSERT ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_phase_status();

-- Função para calcular o prejuízo de uma fase baseado nas horas excedidas
CREATE OR REPLACE FUNCTION public.calculate_phase_loss(phase_id_param uuid)
RETURNS TABLE (
  excess_hours numeric,
  hourly_value numeric,
  total_loss numeric,
  loss_percentage numeric
) AS $$
DECLARE
  phase_record RECORD;
  project_record RECORD;
BEGIN
  -- Buscar dados da fase
  SELECT 
    allocated_hours,
    executed_hours,
    value_percentage,
    project_id
  INTO phase_record
  FROM project_phases 
  WHERE id = phase_id_param;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Buscar dados do projeto
  SELECT contracted_value, contracted_hours
  INTO project_record
  FROM projects 
  WHERE id = phase_record.project_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calcular apenas se há horas excedidas
  IF phase_record.executed_hours > phase_record.allocated_hours THEN
    -- Calcular horas excedidas
    excess_hours := phase_record.executed_hours - phase_record.allocated_hours;
    
    -- Calcular valor por hora baseado no valor contratado do projeto
    IF project_record.contracted_hours > 0 THEN
      hourly_value := (project_record.contracted_value * (phase_record.value_percentage / 100)) / phase_record.allocated_hours;
    ELSE
      hourly_value := 0;
    END IF;
    
    -- Calcular prejuízo total
    total_loss := excess_hours * hourly_value;
    
    -- Calcular percentual de prejuízo
    IF phase_record.allocated_hours > 0 THEN
      loss_percentage := (excess_hours / phase_record.allocated_hours) * 100;
    ELSE
      loss_percentage := 0;
    END IF;
  ELSE
    -- Não há prejuízo
    excess_hours := 0;
    hourly_value := 0;
    total_loss := 0;
    loss_percentage := 0;
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para marcar fase como concluída (apenas pelo responsável)
CREATE OR REPLACE FUNCTION public.complete_phase(phase_id_param uuid, user_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  phase_record RECORD;
  user_profile_id uuid;
  result jsonb;
BEGIN
  -- Buscar ID do perfil do usuário
  SELECT id INTO user_profile_id
  FROM profiles 
  WHERE user_id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;
  
  -- Verificar se a fase existe e se o usuário é o responsável
  SELECT * INTO phase_record
  FROM project_phases 
  WHERE id = phase_id_param
  AND (assigned_to = user_profile_id OR supervised_by = user_profile_id);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fase não encontrada ou usuário não é responsável'
    );
  END IF;
  
  -- Verificar se a fase está em andamento
  IF phase_record.status != 'in_progress' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas fases em andamento podem ser concluídas'
    );
  END IF;
  
  -- Atualizar status para concluída
  UPDATE project_phases 
  SET status = 'completed',
      updated_at = now()
  WHERE id = phase_id_param;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Fase marcada como concluída com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para verificar se usuário pode gerenciar a fase
CREATE OR REPLACE FUNCTION public.can_manage_phase(phase_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
DECLARE
  user_profile_id uuid;
BEGIN
  -- Buscar ID do perfil do usuário
  SELECT id INTO user_profile_id
  FROM profiles 
  WHERE user_id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Verificar se o usuário é responsável ou supervisor da fase, ou se é admin
  RETURN EXISTS (
    SELECT 1
    FROM project_phases 
    WHERE id = phase_id_param
    AND (assigned_to = user_profile_id OR supervised_by = user_profile_id)
  ) OR is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;