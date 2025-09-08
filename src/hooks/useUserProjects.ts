import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/state/auth';

interface UserProject {
  id: string;
  title: string;
  status: string;
  client_name?: string;
  executed_hours: number;
  contracted_hours: number;
  progress: number;
  has_active_timer: boolean;
}

interface UserPhase {
  id: string;
  phase_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  allocated_hours: number;
  executed_hours: number;
  project: {
    id: string;
    title: string;
  };
}

interface DailyHours {
  today: number;
  week: number;
  target_daily: number;
}

export function useUserProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [phases, setPhases] = useState<UserPhase[]>([]);
  const [dailyHours, setDailyHours] = useState<DailyHours>({
    today: 0,
    week: 0,
    target_daily: 8
  });
  const [loading, setLoading] = useState(true);

  const loadUserData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);

      // Primeiro, buscar o profile_id do usuário
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      let profileId = profileData?.id;
      if (!profileId) {
        console.warn('Profile não encontrado para o usuário, criando um novo...');
        // Tentar criar o profile
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            name: (user as any)?.user_metadata?.username || (user as any)?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário',
            email: user?.email || '',
            role: 'user'
          })
          .select('id')
          .single();
        
        if (createError) {
          console.error('Erro ao criar profile:', createError);
          return;
        }
        
        if (!newProfile?.id) {
          console.error('Não foi possível criar o profile do usuário');
          return;
        }
        
        profileId = newProfile.id;
      }

      // Only fetch projects for non-user roles
      if (user?.role !== 'user') {
        // Buscar projetos do usuário (onde ele tem tasks ou time entries)
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select(`
            id,
            title,
            status,
            executed_hours,
            contracted_hours,
            clients(name)
          `)
          .in('status', ['em_andamento', 'em_obra', 'orçamento']);

        if (projectsError) throw projectsError;

        // Verificar timers ativos para cada projeto
        const { data: activeTimers, error: timersError } = await supabase
          .from('time_entries')
          .select('project_id')
          .eq('user_id', user.id)
          .is('end_time', null);

        if (timersError) throw timersError;

        const activeProjectIds = new Set((activeTimers || []).map(t => t.project_id));

        const processedProjects: UserProject[] = (projectsData || []).map(project => {
          const executedHours = project.executed_hours || 0;
          const contractedHours = project.contracted_hours || 0;
          const progress = contractedHours > 0 ? (executedHours / contractedHours) * 100 : 0;

          return {
            id: project.id,
            title: project.title || 'Projeto sem título',
            status: project.status,
            client_name: (project.clients as any)?.name,
            executed_hours: executedHours,
            contracted_hours: contractedHours,
            progress: Math.min(progress, 100),
            has_active_timer: activeProjectIds.has(project.id)
          };
        });

        setProjects(processedProjects);
      } else {
        // For user role, don't fetch projects
        setProjects([]);
      }

      // Buscar todas as etapas atribuídas ao usuário
      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select(`
          id,
          phase_name,
          status,
          allocated_hours,
          executed_hours,
          project:projects(id, title)
        `)
        .eq('assigned_to', profileId)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (phasesError) throw phasesError;

      const processedPhases: UserPhase[] = (phasesData || []).map(phase => ({
        id: phase.id,
        phase_name: phase.phase_name,
        status: phase.status as UserPhase['status'],
        allocated_hours: phase.allocated_hours,
        executed_hours: phase.executed_hours,
        project: Array.isArray(phase.project) ? phase.project[0] : phase.project
      }));

      setPhases(processedPhases);

      // Calcular horas trabalhadas
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      
      const { data: hoursData, error: hoursError } = await supabase
        .from('time_entries')
        .select('duration_minutes, start_time')
        .eq('user_id', user.id)
        .gte('start_time', startOfWeek.toISOString())
        .not('end_time', 'is', null);

      if (hoursError) throw hoursError;

      const todayStr = today.toDateString();
      let todayMinutes = 0;
      let weekMinutes = 0;

      (hoursData || []).forEach(entry => {
        const entryDate = new Date(entry.start_time).toDateString();
        const minutes = entry.duration_minutes || 0;
        
        weekMinutes += minutes;
        if (entryDate === todayStr) {
          todayMinutes += minutes;
        }
      });

      setDailyHours({
        today: todayMinutes / 60,
        week: weekMinutes / 60,
        target_daily: 8 // Configurável futuramente
      });

    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [user?.id]);

  return {
    projects,
    phases,
    dailyHours,
    loading,
    refetch: loadUserData
  };
}