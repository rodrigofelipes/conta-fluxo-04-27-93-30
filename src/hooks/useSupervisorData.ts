import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SupervisorProject {
  id: string;
  title: string;
  status: string;
  client_name?: string;
  executed_hours: number;
  contracted_hours: number;
  progress: number;
  has_active_timer: boolean;
  active_users: string[];
  created_at: string;
}

interface SupervisorStats {
  totalProjects: number;
  activeProjects: number;
  projectsWithTimers: number;
  totalActiveUsers: number;
  totalHoursToday: number;
}

export function useSupervisorData() {
  const [projects, setProjects] = useState<SupervisorProject[]>([]);
  const [stats, setStats] = useState<SupervisorStats>({
    totalProjects: 0,
    activeProjects: 0,
    projectsWithTimers: 0,
    totalActiveUsers: 0,
    totalHoursToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const loadSupervisorData = async () => {
    try {
      setLoading(true);

      // Buscar todos os projetos
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          status,
          executed_hours,
          contracted_hours,
          created_at,
          clients(name)
        `)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Buscar timers ativos para todos os projetos
      const { data: activeTimers, error: timersError } = await supabase
        .from('time_entries')
        .select(`
          project_id,
          user_id,
          profiles!inner(name)
        `)
        .is('end_time', null);

      if (timersError) throw timersError;

      // Agrupar timers por projeto
      const projectTimers = new Map<string, string[]>();
      (activeTimers || []).forEach(timer => {
        const users = projectTimers.get(timer.project_id) || [];
        const userName = (timer.profiles as any)?.name || 'Colaborador';
        users.push(userName);
        projectTimers.set(timer.project_id, users);
      });

      // Processar projetos
      const processedProjects: SupervisorProject[] = (projectsData || []).map(project => {
        const executedHours = project.executed_hours || 0;
        const contractedHours = project.contracted_hours || 0;
        const progress = contractedHours > 0 ? (executedHours / contractedHours) * 100 : 0;
        const activeUsers = projectTimers.get(project.id) || [];

        return {
          id: project.id,
          title: project.title || 'Projeto sem título',
          status: project.status,
          client_name: (project.clients as any)?.name,
          executed_hours: executedHours,
          contracted_hours: contractedHours,
          progress: Math.min(progress, 100),
          has_active_timer: activeUsers.length > 0,
          active_users: activeUsers,
          created_at: project.created_at
        };
      });

      setProjects(processedProjects);

      // Calcular estatísticas
      const activeProjects = processedProjects.filter(p => 
        p.status === 'em_andamento' || p.status === 'em_obra'
      );
      
      const projectsWithTimers = processedProjects.filter(p => p.has_active_timer);
      
      const uniqueActiveUsers = new Set(
        projectsWithTimers.flatMap(p => p.active_users)
      );

      // Buscar horas trabalhadas hoje
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      
      const { data: todayHours, error: hoursError } = await supabase
        .from('time_entries')
        .select('duration_minutes')
        .gte('start_time', startOfDay.toISOString())
        .not('end_time', 'is', null);

      if (hoursError) throw hoursError;

      const totalMinutesToday = (todayHours || []).reduce(
        (sum, entry) => sum + (entry.duration_minutes || 0), 
        0
      );

      setStats({
        totalProjects: processedProjects.length,
        activeProjects: activeProjects.length,
        projectsWithTimers: projectsWithTimers.length,
        totalActiveUsers: uniqueActiveUsers.size,
        totalHoursToday: totalMinutesToday / 60
      });

    } catch (error) {
      console.error('Erro ao carregar dados do supervisor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupervisorData();
    
    // Configurar realtime para time_entries (timers)
    const timeEntriesChannel = supabase
      .channel('time_entries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries'
        },
        (payload) => {
          console.log('Time entry change detected:', payload);
          loadSupervisorData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        }
      });

    // Configurar realtime para projects
    const projectsChannel = supabase
      .channel('projects_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        (payload) => {
          console.log('Project change detected:', payload);
          loadSupervisorData();
        }
      )
      .subscribe();

    // Configurar realtime para project_phases
    const phasesChannel = supabase
      .channel('phases_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_phases'
        },
        (payload) => {
          console.log('Phase change detected:', payload);
          loadSupervisorData();
        }
      )
      .subscribe();
    
    // Backup: atualizar a cada 60 segundos (menos frequente já que temos realtime)
    const interval = setInterval(loadSupervisorData, 60000);
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(timeEntriesChannel);
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(phasesChannel);
    };
  }, []);

  return {
    projects,
    stats,
    loading,
    isRealtimeConnected,
    refetch: loadSupervisorData
  };
}