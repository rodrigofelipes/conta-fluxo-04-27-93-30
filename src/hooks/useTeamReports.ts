import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  total_hours: number;
  projects_count: number;
  active_timers: number;
  completed_tasks: number;
  efficiency_score: number;
  last_activity: string;
  documents_count: number;
  meetings_count: number;
}

export interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  totalHoursToday: number;
  totalHoursWeek: number;
  totalHoursMonth: number;
  averageEfficiency: number;
  topPerformers: TeamMember[];
  roleDistribution: Array<{ role: string; count: number }>;
  hoursByDay: Array<{ day: string; hours: number }>;
  hoursByMember: Array<{ name: string; hours: number }>;
  totalDocuments: number;
  totalMeetings: number;
}

export function useTeamReports() {
  const [teamStats, setTeamStats] = useState<TeamStats>({
    totalMembers: 0,
    activeMembers: 0,
    totalHoursToday: 0,
    totalHoursWeek: 0,
    totalHoursMonth: 0,
    averageEfficiency: 0,
    topPerformers: [],
    roleDistribution: [],
    hoursByDay: [],
    hoursByMember: [],
    totalDocuments: 0,
    totalMeetings: 0
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTeamData = async () => {
    try {
      console.log('Starting loadTeamData...');
      setLoading(true);

      // Definir períodos de tempo
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      // Executar queries em paralelo para melhor performance
      console.log('About to execute queries...');
      const [
        profilesResult,
        timeEntriesResult,
        activeTimersResult,
        completedPhasesResult,
        allPhasesResult,
        documentsResult,
        meetingsResult,
        clientDocumentsResult
      ] = await Promise.all([
        // Buscar apenas profiles de colaboradores (não admins)
        supabase
          .from('profiles')
          .select('id, user_id, name, email, role, created_at')
          .neq('role', 'admin'),

        // Buscar time entries das últimas 4 semanas
        supabase
          .from('time_entries')
          .select('user_id, start_time, end_time, duration_minutes, project_id, phase_id')
          .gte('start_time', fourWeeksAgo.toISOString())
          .not('end_time', 'is', null),

        // Buscar timers ativos
        supabase
          .from('time_entries')
          .select('user_id')
          .is('end_time', null),

        // Buscar fases completadas
        supabase
          .from('project_phases')
          .select('assigned_to, supervised_by, allocated_hours, executed_hours')
          .eq('status', 'completed'),

        // Buscar todas as fases para cálculo de eficiência
        supabase
          .from('project_phases')
          .select('assigned_to, supervised_by, allocated_hours, executed_hours, status'),

        // Buscar documentos de projetos
        supabase
          .from('project_documents')
          .select('uploaded_by'),

        // Buscar reuniões
        supabase
          .from('meetings')
          .select('created_by'),

        // Buscar documentos de clientes
        supabase
          .from('client_documents')
          .select('uploaded_by')
      ]);

      console.log('Queries completed, checking for errors...');

      // Verificar erros
      if (profilesResult.error) throw profilesResult.error;
      if (timeEntriesResult.error) throw timeEntriesResult.error;
      if (activeTimersResult.error) throw activeTimersResult.error;
      if (completedPhasesResult.error) throw completedPhasesResult.error;
      if (allPhasesResult.error) throw allPhasesResult.error;
      if (documentsResult.error) throw documentsResult.error;
      if (meetingsResult.error) throw meetingsResult.error;
      if (clientDocumentsResult.error) throw clientDocumentsResult.error;

      const profiles = profilesResult.data || [];
      const timeEntries = timeEntriesResult.data || [];
      const activeTimers = activeTimersResult.data || [];
      const completedPhases = completedPhasesResult.data || [];
      const allPhases = allPhasesResult.data || [];
      const projectDocuments = documentsResult.data || [];
      const meetings = meetingsResult.data || [];
      const clientDocuments = clientDocumentsResult.data || [];

      // Criar mapa de usuários ativos
      const activeUserIds = new Set(activeTimers.map(timer => timer.user_id));

      // Contar documentos por usuário
      const documentsByUser = new Map<string, number>();
      [...projectDocuments, ...clientDocuments].forEach(doc => {
        if (doc.uploaded_by) {
          documentsByUser.set(doc.uploaded_by, (documentsByUser.get(doc.uploaded_by) || 0) + 1);
        }
      });

      // Contar reuniões por usuário
      const meetingsByUser = new Map<string, number>();
      meetings.forEach(meeting => {
        if (meeting.created_by) {
          meetingsByUser.set(meeting.created_by, (meetingsByUser.get(meeting.created_by) || 0) + 1);
        }
      });

      // Calcular tarefas completadas por usuário (baseado em fases)
      const completedTasksByUser = new Map<string, number>();
      completedPhases.forEach(phase => {
        if (phase.assigned_to) {
          const profile = profiles.find(p => p.id === phase.assigned_to);
          if (profile) {
            completedTasksByUser.set(profile.user_id, (completedTasksByUser.get(profile.user_id) || 0) + 1);
          }
        }
        if (phase.supervised_by) {
          const profile = profiles.find(p => p.id === phase.supervised_by);
          if (profile) {
            completedTasksByUser.set(profile.user_id, (completedTasksByUser.get(profile.user_id) || 0) + 1);
          }
        }
      });

      // Calcular eficiência por usuário (baseado em horas planejadas vs executadas)
      const efficiencyByUser = new Map<string, { total: number; count: number }>();
      allPhases.forEach(phase => {
        if (phase.assigned_to && phase.allocated_hours > 0) {
          const profile = profiles.find(p => p.id === phase.assigned_to);
          if (profile) {
            const executedHours = phase.executed_hours || 0;
            const allocatedHours = phase.allocated_hours;
            const phaseEfficiency = Math.min(100, (allocatedHours / Math.max(executedHours, allocatedHours)) * 100);
            
            const currentEfficiency = efficiencyByUser.get(profile.user_id) || { total: 0, count: 0 };
            efficiencyByUser.set(profile.user_id, {
              total: currentEfficiency.total + phaseEfficiency,
              count: currentEfficiency.count + 1
            });
          }
        }
      });

      // Processar estatísticas por usuário
      const userStats = new Map<string, {
        name: string;
        email: string;
        role: string;
        totalHours: number;
        todayHours: number;
        weekHours: number;
        monthHours: number;
        projectsCount: Set<string>;
        hasActiveTimer: boolean;
        lastActivity: Date | null;
        completedTasks: number;
        documentsCount: number;
        meetingsCount: number;
        efficiency: number;
      }>();

      // Inicializar estatísticas para todos os profiles
      profiles.forEach(profile => {
        const userEfficiency = efficiencyByUser.get(profile.user_id);
        const avgEfficiency = userEfficiency 
          ? userEfficiency.total / userEfficiency.count 
          : 75; // Valor padrão

        userStats.set(profile.user_id, {
          name: profile.name || 'Sem nome',
          email: profile.email || '',
          role: profile.role || 'user',
          totalHours: 0,
          todayHours: 0,
          weekHours: 0,
          monthHours: 0,
          projectsCount: new Set(),
          hasActiveTimer: activeUserIds.has(profile.user_id),
          lastActivity: null,
          completedTasks: completedTasksByUser.get(profile.user_id) || 0,
          documentsCount: documentsByUser.get(profile.id) || 0,
          meetingsCount: meetingsByUser.get(profile.id) || 0,
          efficiency: avgEfficiency
        });
      });

      // Processar time entries
      timeEntries.forEach(entry => {
        const stats = userStats.get(entry.user_id);
        if (!stats) return;

        const minutes = entry.duration_minutes || 0;
        const hours = minutes / 60;
        const startTime = new Date(entry.start_time);

        stats.totalHours += hours;
        if (entry.project_id) {
          stats.projectsCount.add(entry.project_id);
        }

        // Atualizar última atividade
        if (!stats.lastActivity || startTime > stats.lastActivity) {
          stats.lastActivity = startTime;
        }

        // Verificar período usando comparação correta de datas
        if (startTime >= startOfToday) {
          stats.todayHours += hours;
        }
        if (startTime >= startOfWeek) {
          stats.weekHours += hours;
        }
        if (startTime >= startOfMonth) {
          stats.monthHours += hours;
        }
      });

      // Converter para array de team members
      const teamMembersArray: TeamMember[] = Array.from(userStats.entries()).map(([user_id, stats]) => ({
        id: user_id,
        name: stats.name,
        email: stats.email,
        role: stats.role,
        total_hours: parseFloat(stats.totalHours.toFixed(1)),
        projects_count: stats.projectsCount.size,
        active_timers: stats.hasActiveTimer ? 1 : 0,
        completed_tasks: stats.completedTasks,
        efficiency_score: parseFloat(stats.efficiency.toFixed(1)),
        last_activity: stats.lastActivity ? stats.lastActivity.toISOString() : '',
        documents_count: stats.documentsCount,
        meetings_count: stats.meetingsCount
      }));

      setTeamMembers(teamMembersArray);

      // Calcular estatísticas gerais
      const totalHoursToday = Array.from(userStats.values()).reduce((sum, stats) => sum + stats.todayHours, 0);
      const totalHoursWeek = Array.from(userStats.values()).reduce((sum, stats) => sum + stats.weekHours, 0);
      const totalHoursMonth = Array.from(userStats.values()).reduce((sum, stats) => sum + stats.monthHours, 0);
      const activeMembers = teamMembersArray.filter(member => member.active_timers > 0).length;
      const averageEfficiency = teamMembersArray.length > 0 
        ? teamMembersArray.reduce((sum, member) => sum + member.efficiency_score, 0) / teamMembersArray.length 
        : 0;

      // Top performers (top 3 por horas trabalhadas neste mês)
      const topPerformers = [...teamMembersArray]
        .sort((a, b) => {
          const aMonthHours = userStats.get(a.id)?.monthHours || 0;
          const bMonthHours = userStats.get(b.id)?.monthHours || 0;
          return bMonthHours - aMonthHours;
        })
        .slice(0, 3);

      // Distribuição por role
      const roleDistribution = teamMembersArray.reduce((acc, member) => {
        const existing = acc.find(r => r.role === member.role);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ role: member.role, count: 1 });
        }
        return acc;
      }, [] as Array<{ role: string; count: number }>);

      // Horas por dia (últimos 7 dias)
      const hoursByDay = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });
        
        // Calcular horas reais do dia
        const dayHours = timeEntries.reduce((sum, entry) => {
          const entryDate = new Date(entry.start_time);
          if (entryDate >= date && entryDate < nextDate) {
            return sum + ((entry.duration_minutes || 0) / 60);
          }
          return sum;
        }, 0);
        
        hoursByDay.push({ day: dayName, hours: parseFloat(dayHours.toFixed(1)) });
      }

      // Horas por membro (top 8 do mês)
      const hoursByMember = teamMembersArray
        .map(member => ({ 
          name: member.name, 
          hours: parseFloat((userStats.get(member.id)?.monthHours || 0).toFixed(1))
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);

      const totalDocuments = projectDocuments.length + clientDocuments.length;
      const totalMeetings = meetings.length;

      setTeamStats({
        totalMembers: teamMembersArray.length,
        activeMembers,
        totalHoursToday: parseFloat(totalHoursToday.toFixed(1)),
        totalHoursWeek: parseFloat(totalHoursWeek.toFixed(1)),
        totalHoursMonth: parseFloat(totalHoursMonth.toFixed(1)),
        averageEfficiency: parseFloat(averageEfficiency.toFixed(1)),
        topPerformers,
        roleDistribution,
        hoursByDay,
        hoursByMember,
        totalDocuments,
        totalMeetings
      });

    } catch (error) {
      console.error('Erro ao carregar dados da equipe:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  return {
    teamStats,
    teamMembers,
    loading,
    refetch: loadTeamData
  };
}