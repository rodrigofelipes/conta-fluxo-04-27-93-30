import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/state/auth';

// Helper para determinar quem deve aparecer baseado na hierarquia
const getAttendeesDisplay = (collaboratorsIds: string[], profiles: { id: string; name: string }[]): string => {
  if (!collaboratorsIds || collaboratorsIds.length === 0) return 'Colaborador';
  
  const profilesMap = new Map(profiles.map(p => [p.id, p.name]));
  const attendeeNames = collaboratorsIds.map(id => profilesMap.get(id)).filter(Boolean);
  
  // Prioridade 1: Débora e/ou Olevate
  const priority1 = attendeeNames.filter(name => name === 'Débora' || name === 'Olevate');
  if (priority1.length > 0) {
    return priority1.join(' e ');
  }
  
  // Prioridade 2: Mara e/ou Thuany
  const priority2 = attendeeNames.filter(name => name === 'Mara' || name === 'Thuany');
  if (priority2.length > 0) {
    return priority2.join(' e ');
  }
  
  // Fallback: "Colaborador"
  return 'Colaborador';
};

interface DashboardStats {
  totalClients: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  totalProjects: number;
  activeProjects: number;
  totalRevenue: number;
  pendingRevenue: number;
  totalUsers: number;
}

interface RecentActivity {
  id: string;
  type: 'task' | 'project' | 'client' | 'meeting';
  title: string;
  description?: string;
  time: string;
  status?: string;
  priority?: string;
}

interface AgendaItem {
  id: string;
  titulo: string;
  descricao?: string;
  data: string;
  horario: string;
  horario_fim?: string;
  tipo: string;
  cliente: string;
  created_by_name?: string;
  attendees_display?: string;
  collaborators_ids?: string[];
}

export function useDashboardData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalProjects: 0,
    activeProjects: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    totalUsers: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<AgendaItem[]>([]);
  const [importantFinancials, setImportantFinancials] = useState<any[]>([]);

  const loadDashboardData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);

      // Obter a data atual no fuso horário local
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerar horas para garantir comparação apenas da data
      const todayString = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];
      
      // Calcular hora atual para filtrar compromissos passados
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM

      // Carregar dados básicos
      const [clientsRes, projectsRes, usersRes] = await Promise.all([
        supabase.from('clients').select('id, created_at, name'),
        supabase.from('projects').select('id, status, created_at, title, contracted_value'),
        supabase.from('profiles').select('id, name, created_at')
      ]);

      // Dados específicos para admin
      let agendaRes = null;
      let financialsRes = null;
      
      if (user.role === 'admin') {
        [agendaRes, financialsRes] = await Promise.all([
          supabase.from('agenda')
            .select(`
              id, titulo, descricao, data, horario, horario_fim, tipo, cliente, collaborators_ids
            `)
            .gte('data', todayString)
            .lte('data', tomorrowString)
            .or(`created_by.eq.${user.id},collaborators_ids.cs.{${user.id}}`)
            .order('data, horario', { ascending: true })
            .limit(10),
          supabase.from('client_financials')
            .select('id, description, amount, status, transaction_date, transaction_type')
            .or('amount.gte.5000,status.eq.urgent')
            .order('transaction_date', { ascending: false })
            .limit(10)
        ]);
      } else {
        // Para usuários não-admin, buscar apenas os compromissos onde é colaborador
        agendaRes = await supabase.from('agenda')
          .select(`
            id, titulo, descricao, data, horario, horario_fim, tipo, cliente, collaborators_ids
          `)
          .gte('data', todayString)
          .lte('data', tomorrowString)
          .or(`created_by.eq.${user.id},collaborators_ids.cs.{${user.id}}`)
          .order('data, horario', { ascending: true })
          .limit(10);
      }

      // Estatísticas básicas
      const totalClients = clientsRes.data?.length || 0;
      const totalProjects = projectsRes.data?.length || 0;
      const activeProjects = (projectsRes.data || []).filter(project => 
        project.status === 'em_andamento' || project.status === 'em_obra'
      ).length;
      const totalUsers = usersRes.data?.length || 0;
      
      // Calcular receita total dos projetos
      const totalRevenue = (projectsRes.data || []).reduce((acc, project) => {
        return acc + (project.contracted_value || 0);
      }, 0);

      setStats({
        totalClients,
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        totalProjects,
        activeProjects,
        totalRevenue,
        pendingRevenue: 0,
        totalUsers
      });

      // Atividade recente
      const activity: RecentActivity[] = [
        ...(projectsRes.data || []).slice(0, 5).map(project => ({
          id: project.id,
          type: 'project' as const,
          title: project.title || 'Projeto sem título',
          time: new Date(project.created_at).toLocaleDateString(),
          status: project.status
        }))
      ];

      setRecentActivity(activity);

      // Compromissos para todos os usuários
      if (agendaRes?.data) {
        // Buscar profiles dos colaboradores para mapear attendees
        const allCollaboratorIds = new Set();
        agendaRes.data.forEach(meeting => {
          if (meeting.collaborators_ids) {
            meeting.collaborators_ids.forEach(id => allCollaboratorIds.add(id));
          }
        });

        let collaboratorsProfiles = [];
        if (allCollaboratorIds.size > 0) {
         const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', Array.from(allCollaboratorIds) as string[]);
          collaboratorsProfiles = profilesData || [];
        }

        // Filtrar compromissos para mostrar apenas futuros
        const filteredMeetings = agendaRes.data.filter(meeting => {
          if (meeting.data === todayString) {
            // Para hoje, só mostrar compromissos futuros
            return meeting.horario >= currentTime;
          }
          // Para amanhã, mostrar todos
          return meeting.data === tomorrowString;
        });

        const meetingsWithAttendees = filteredMeetings.map(meeting => ({
          ...meeting,
          created_by_name: 'Colaborador',
          attendees_display: getAttendeesDisplay(meeting.collaborators_ids || [], collaboratorsProfiles)
        }));
        setUpcomingMeetings(meetingsWithAttendees);
      }

      // Dados financeiros apenas para admin
      if (user.role === 'admin' && financialsRes?.data) {
        setImportantFinancials(financialsRes.data);
      }

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.id, user?.role]);

  return {
    stats,
    recentActivity,
    upcomingMeetings,
    importantFinancials,
    loading,
    refetch: loadDashboardData
  };
}