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
  efficiency_score: number | null;
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
  averageEfficiency: number | null;
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
    averageEfficiency: null,
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
@@ -197,59 +197,59 @@ export function useTeamReports() {
            
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
        efficiency: number | null;
      }>();

      // Inicializar estatísticas para todos os profiles
      profiles.forEach(profile => {
        const userEfficiency = efficiencyByUser.get(profile.user_id);
        const avgEfficiency = userEfficiency
          ? userEfficiency.total / userEfficiency.count
          : null;

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
@@ -266,66 +266,70 @@ export function useTeamReports() {
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
        efficiency_score: stats.efficiency !== null ? parseFloat(stats.efficiency.toFixed(1)) : null,
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
      const efficiencyValues = teamMembersArray
        .map(member => member.efficiency_score)
        .filter((score): score is number => score !== null);

      const averageEfficiency = efficiencyValues.length > 0
        ? efficiencyValues.reduce((sum, score) => sum + score, 0) / efficiencyValues.length
        : null;

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
@@ -344,51 +348,51 @@ export function useTeamReports() {
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
        averageEfficiency: averageEfficiency !== null ? parseFloat(averageEfficiency.toFixed(1)) : null,
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