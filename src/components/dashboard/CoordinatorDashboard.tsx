import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, AlertCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";

interface Stats {
  totalPhases: number;
  inProgressPhases: number;
  completedPhases: number;
  pendingPhases: number;
}

export function CoordinatorDashboard({ userName }: { userName?: string }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalPhases: 0,
    inProgressPhases: 0,
    completedPhases: 0,
    pendingPhases: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      const { data: phases, error } = await supabase
        .from('project_phases')
        .select('status');

      if (error) throw error;

      setStats({
        totalPhases: phases?.length || 0,
        inProgressPhases: phases?.filter(p => p.status === 'in_progress').length || 0,
        completedPhases: phases?.filter(p => p.status === 'completed').length || 0,
        pendingPhases: phases?.filter(p => p.status === 'pending').length || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={userName ? `Olá, ${userName}!` : "Dashboard"}
        subtitle="Acompanhe as etapas dos projetos"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Etapas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPhases}</div>
            <p className="text-xs text-muted-foreground">
              Todas as etapas do sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgressPhases}</div>
            <p className="text-xs text-muted-foreground">
              Etapas sendo executadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedPhases}</div>
            <p className="text-xs text-muted-foreground">
              Etapas finalizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPhases}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando início
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acesso Rápido</CardTitle>
          <CardDescription>
            Navegue para as áreas principais do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Coordenadores podem visualizar todas as etapas na aba "Etapas" e acompanhar suas próprias tarefas em "Minhas Etapas".
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
