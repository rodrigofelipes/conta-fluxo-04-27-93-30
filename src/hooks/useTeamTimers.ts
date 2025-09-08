import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveTimer {
  id: string;
  user_id: string;
  user_name: string;
  project_id: string;
  project_title: string;
  start_time: string;
  elapsed_seconds: number;
}

interface TeamActivity {
  user_id: string;
  user_name: string;
  total_hours_today: number;
  total_hours_week: number;
  active_project?: string;
  last_activity: string;
}

export function useTeamTimers() {
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [teamActivity, setTeamActivity] = useState<TeamActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTeamTimers = async () => {
    try {
      setLoading(true);

      // Buscar timers ativos
      const { data: timersData, error: timersError } = await supabase
        .from('time_entries')
        .select(`
          id,
          user_id,
          project_id,
          start_time,
          projects!inner(title),
          profiles!inner(name)
        `)
        .is('end_time', null);

      if (timersError) throw timersError;

      // Processar timers ativos
      const now = new Date();
      const processedTimers: ActiveTimer[] = (timersData || []).map(timer => {
        const startTime = new Date(timer.start_time);
        const elapsedMs = now.getTime() - startTime.getTime();
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        return {
          id: timer.id,
          user_id: timer.user_id,
          user_name: (timer.profiles as any)?.name || 'Colaborador',
          project_id: timer.project_id,
          project_title: (timer.projects as any)?.title || 'Projeto',
          start_time: timer.start_time,
          elapsed_seconds: elapsedSeconds
        };
      });

      setActiveTimers(processedTimers);

      // Buscar atividade da equipe (últimos 7 dias)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: activityData, error: activityError } = await supabase
        .from('time_entries')
        .select(`
          user_id,
          duration_minutes,
          start_time,
          end_time,
          profiles!inner(name),
          projects(title)
        `)
        .gte('start_time', weekAgo.toISOString())
        .not('end_time', 'is', null);

      if (activityError) throw activityError;

      // Processar atividade da equipe
      const userActivityMap = new Map<string, TeamActivity>();
      const today = new Date().toDateString();

      (activityData || []).forEach(entry => {
        const userId = entry.user_id;
        const userName = (entry.profiles as any)?.name || 'Colaborador';
        const startDate = new Date(entry.start_time).toDateString();
        const isToday = startDate === today;
        const hours = (entry.duration_minutes || 0) / 60;

        if (!userActivityMap.has(userId)) {
          userActivityMap.set(userId, {
            user_id: userId,
            user_name: userName,
            total_hours_today: 0,
            total_hours_week: 0,
            last_activity: entry.start_time
          });
        }

        const activity = userActivityMap.get(userId)!;
        activity.total_hours_week += hours;
        if (isToday) {
          activity.total_hours_today += hours;
        }

        // Atualizar última atividade se mais recente
        if (new Date(entry.start_time) > new Date(activity.last_activity)) {
          activity.last_activity = entry.start_time;
          if (entry.projects) {
            activity.active_project = (entry.projects as any).title;
          }
        }
      });

      setTeamActivity(Array.from(userActivityMap.values()));

    } catch (error) {
      console.error('Erro ao carregar timers da equipe:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamTimers();
    
    // Configurar realtime para time_entries
    const timeEntriesChannel = supabase
      .channel('team_timers_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries'
        },
        (payload) => {
          console.log('Timer change detected:', payload);
          loadTeamTimers();
        }
      )
      .subscribe();
    
    // Atualizar a cada 10 segundos para os timers ativos (tempo decorrido)
    const interval = setInterval(() => {
      setActiveTimers(current => {
        if (current.length === 0) return current;
        
        const now = new Date();
        return current.map(timer => {
          const startTime = new Date(timer.start_time);
          const elapsedMs = now.getTime() - startTime.getTime();
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          
          return {
            ...timer,
            elapsed_seconds: elapsedSeconds
          };
        });
      });
    }, 1000);
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(timeEntriesChannel);
    };
  }, []);

  return {
    activeTimers,
    teamActivity,
    loading,
    refetch: loadTeamTimers
  };
}