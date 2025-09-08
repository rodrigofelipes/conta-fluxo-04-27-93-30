import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/state/auth';
import { toast } from '@/hooks/use-toast';

interface Phase {
  id: string;
  phase_name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  allocated_hours: number;
  executed_hours: number;
  assigned_to?: string;
  supervised_by?: string;
  project_id: string;
  value_percentage: number;
}

interface PhaseLoss {
  excess_hours: number;
  hourly_value: number;
  total_loss: number;
  loss_percentage: number;
}

export function useIntelligentPhases(projectId?: string) {
  const { user } = useAuth();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhases = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('project_phases')
        .select(`
          *,
          assigned_profile:profiles!assigned_to (
            id,
            name
          ),
          supervisor_profile:profiles!supervised_by (
            id,
            name
          )
        `)
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      setPhases((data || []) as Phase[]);
    } catch (err: any) {
      console.error('Erro ao carregar fases:', err);
      setError(err.message);
      toast({
        title: 'Erro ao carregar fases',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePhaseLoss = async (phaseId: string): Promise<PhaseLoss | null> => {
    try {
      const { data, error } = await supabase
        .rpc('calculate_phase_loss', { phase_id_param: phaseId });

      if (error) throw error;

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Erro ao calcular prejuízo:', error);
      return null;
    }
  };

  const canManagePhase = async (phaseId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .rpc('can_manage_phase', { 
          phase_id_param: phaseId, 
          user_id_param: user.id 
        });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      return false;
    }
  };

  const completePhase = async (phaseId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .rpc('complete_phase', { 
          phase_id_param: phaseId, 
          user_id_param: user.id 
        });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };

      if (result?.success) {
        toast({
          title: "Fase concluída",
          description: result.message || "Fase marcada como concluída"
        });
        await fetchPhases(); // Refresh phases
        return true;
      } else {
        toast({
          title: "Erro",
          description: result?.error || "Erro ao concluir fase",
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      console.error('Erro ao concluir fase:', error);
      toast({
        title: "Erro",
        description: "Não foi possível concluir a fase.",
        variant: "destructive"
      });
      return false;
    }
  };

  const getPhasesByStatus = (status: Phase['status']) => {
    return phases.filter(phase => phase.status === status);
  };

  const getPhasesWithLoss = () => {
    return phases.filter(phase => phase.executed_hours > phase.allocated_hours);
  };

  const getTotalProjectLoss = async (): Promise<number> => {
    let totalLoss = 0;
    
    for (const phase of getPhasesWithLoss()) {
      const loss = await calculatePhaseLoss(phase.id);
      if (loss) {
        totalLoss += loss.total_loss;
      }
    }
    
    return totalLoss;
  };

  const getProjectProgress = () => {
    if (phases.length === 0) return 0;
    
    const completedPhases = getPhasesByStatus('completed').length;
    const inProgressPhases = getPhasesByStatus('in_progress').length;
    
    // Considerar fases em progresso como 50% concluídas
    const progress = (completedPhases + (inProgressPhases * 0.5)) / phases.length;
    return Math.round(progress * 100);
  };

  useEffect(() => {
    fetchPhases();
  }, [projectId]);

  // Realtime subscription for phases updates
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-phases-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_phases',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          console.log('Fase atualizada, recarregando...');
          fetchPhases();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    phases,
    loading,
    error,
    fetchPhases,
    calculatePhaseLoss,
    canManagePhase,
    completePhase,
    getPhasesByStatus,
    getPhasesWithLoss,
    getTotalProjectLoss,
    getProjectProgress,
    // Computed values
    pendingPhases: getPhasesByStatus('pending'),
    inProgressPhases: getPhasesByStatus('in_progress'),
    completedPhases: getPhasesByStatus('completed'),
    cancelledPhases: getPhasesByStatus('cancelled'),
    phasesWithLoss: getPhasesWithLoss(),
    projectProgress: getProjectProgress()
  };
}