import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { useNavigate } from "react-router-dom";
import { 
  Clock, 
  CheckCircle2, 
  Calendar,
  Target,
  Activity,
  Settings,
  Play,
  FolderOpen
} from "lucide-react";
import { useUserProjects } from "@/hooks/useUserProjects";
import { UserPhasesView } from "@/components/projects/UserPhasesView";

interface UserDashboardProps {
  userName?: string;
}

export function UserDashboard({ userName }: UserDashboardProps) {
  const navigate = useNavigate();
  const { phases, dailyHours, loading } = useUserProjects();

  const activePhasesCount = phases.filter(phase => 
    phase.status === 'in_progress' || phase.status === 'pending'
  ).length;

  const quickActions = [
    {
      title: "Ver Minhas Etapas", 
      description: "Acompanhar etapas de projetos",
      icon: FolderOpen,
      action: () => navigate('/user-projects'),
      variant: "outline" as const
    },
    {
      title: "Meu Perfil",
      description: "Editar informações pessoais",
      icon: Settings,
      action: () => navigate('/settings'),
      variant: "outline" as const
    }
  ];

  const getPhaseStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const progressPercentage = dailyHours.target_daily > 0 
    ? (dailyHours.today / dailyHours.target_daily) * 100 
    : 0;

  return (
    <main className="space-y-6">
      <PageHeader 
        title="Meu Dashboard" 
        subtitle={`Bem-vindo, ${userName}! Seu painel pessoal de trabalho.`}
      />

      {/* Estatísticas pessoais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Hoje</p>
                <p className="text-2xl font-bold text-primary">{dailyHours.today.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Meta: {dailyHours.target_daily}h</p>
              </div>
              <Clock className="size-8 text-primary opacity-80" />
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso</span>
                <span>{progressPercentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas na Semana</p>
                <p className="text-2xl font-bold text-primary">{dailyHours.week.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
              </div>
              <Calendar className="size-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas no Mês</p>
                <p className="text-2xl font-bold text-primary">{(dailyHours.week * 4.3).toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Estimativa mensal</p>
              </div>
              <Target className="size-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Etapas Ativas</p>
                <p className="text-2xl font-bold text-primary">{activePhasesCount}</p>
                <p className="text-xs text-muted-foreground">Atribuídas a mim</p>
              </div>
              <Activity className="size-8 text-yellow-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção principal - Minhas Etapas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Minhas Etapas de Projeto */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FolderOpen className="size-5" />
                  Minhas Etapas de Projeto
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/user-projects')}
                >
                  Ver Todas
                </Button>
              </div>
              <UserPhasesView />
            </CardContent>
          </Card>

          {/* Ações rápidas */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Play className="size-5" />
                Ações Rápidas
              </h3>
              <div className="space-y-3">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    onClick={action.action}
                    className="w-full justify-start h-auto p-4 border border-border/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                  >
                    <action.icon className="mr-3 size-5" />
                    <div className="text-left">
                      <p className="font-medium">{action.title}</p>
                      <p className="text-xs opacity-70">{action.description}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}