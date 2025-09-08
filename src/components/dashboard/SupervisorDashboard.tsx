import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { 
  Timer, 
  FolderOpen, 
  Users,
  Plus,
  Activity,
  BarChart3,
  Clock,
  ChevronDown
} from "lucide-react";
import { useSupervisorData } from "@/hooks/useSupervisorData";
import { TimerControlWidget } from "./widgets/TimerControlWidget";
import { SupervisorProjectsWidget } from "./widgets/SupervisorProjectsWidget";
import { CreatePhaseDialog } from "@/components/projects/CreatePhaseDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SupervisorDashboardProps {
  userName?: string;
}

export function SupervisorDashboard({ userName }: SupervisorDashboardProps) {
  const navigate = useNavigate();
  const { projects, stats, loading, isRealtimeConnected } = useSupervisorData();
  const { toast } = useToast();
  const [createPhaseDialogOpen, setCreatePhaseDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");


  const quickActions = [
    {
      title: "Novo Projeto",
      description: "Criar projeto para cliente",
      icon: Plus,
      action: () => navigate('/projects'),
      variant: "default" as const
    },
    {
      title: "Relatórios",
      description: "Ver relatórios de produtividade",
      icon: BarChart3,
      action: () => navigate('/reports'),
      variant: "outline" as const
    }
  ];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Dashboard de Supervisão" 
          subtitle={`Bem-vindo, ${userName}! Controle de projetos e equipe.`}
        />
        <RealtimeIndicator isConnected={isRealtimeConnected} />
      </div>

      {/* Estatísticas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projetos Ativos</p>
                <p className="text-2xl font-bold text-primary">{stats.activeProjects}</p>
                <p className="text-xs text-muted-foreground">de {stats.totalProjects} total</p>
              </div>
              <FolderOpen className="size-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projetos c/ Timers</p>
                <p className="text-2xl font-bold text-primary">{stats.projectsWithTimers}</p>
                <p className="text-xs text-muted-foreground">Em execução agora</p>
              </div>
              <Timer className="size-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equipe Ativa</p>
                <p className="text-2xl font-bold text-primary">{stats.totalActiveUsers}</p>
                <p className="text-xs text-muted-foreground">Com timers rodando</p>
              </div>
              <Users className="size-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Hoje</p>
                <p className="text-2xl font-bold text-primary">{stats.totalHoursToday.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Total da equipe</p>
              </div>
              <Clock className="size-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controle de Timers */}
      <TimerControlWidget />

      {/* Seção inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projetos */}
        <div className="lg:col-span-2">
          <SupervisorProjectsWidget 
            projects={projects} 
            loading={loading}
          />
        </div>

        {/* Ações rápidas */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Timer className="size-5" />
              Ações de Supervisão
            </h3>
            <div className="space-y-3">
              {/* Nova Fase com dropdown de projetos */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-4 border border-border/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                  >
                    <Plus className="mr-3 size-5" />
                    <div className="text-left flex-1">
                      <p className="font-medium">Nova Fase</p>
                      <p className="text-xs opacity-70">Criar nova fase do projeto</p>
                    </div>
                    <ChevronDown className="ml-2 size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-background border shadow-lg z-50">
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setCreatePhaseDialogOpen(true);
                      }}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{project.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {project.client_name || 'Cliente'}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {projects.length === 0 && (
                    <DropdownMenuItem disabled>
                      Nenhum projeto disponível
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Outras ações rápidas */}
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

      {/* Dialog para criar fase */}
      <CreatePhaseDialog
        open={createPhaseDialogOpen}
        onOpenChange={setCreatePhaseDialogOpen}
        projectId={selectedProjectId}
        onPhaseCreated={() => {
          // Recarregar dados dos projetos após criar fase
          window.location.reload();
        }}
      />
    </main>
  );
}