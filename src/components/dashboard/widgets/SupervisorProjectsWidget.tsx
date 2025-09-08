import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FolderOpen, 
  Timer as TimerIcon, 
  ExternalLink, 
  Users,
  Clock,
  TrendingUp,
  Play
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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

interface SupervisorProjectsWidgetProps {
  projects: SupervisorProject[];
  loading?: boolean;
}

export function SupervisorProjectsWidget({ 
  projects, 
  loading
}: SupervisorProjectsWidgetProps) {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'em_obra': return 'bg-green-100 text-green-800 border-green-200';
      case 'orçamento': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'concluído': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'Em Andamento';
      case 'em_obra': return 'Em Obra';
      case 'orçamento': return 'Orçamento';
      case 'concluído': return 'Concluído';
      default: return status;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const activeProjects = projects.filter(p => 
    p.status === 'em_andamento' || p.status === 'em_obra'
  );
  
  const projectsWithTimers = projects.filter(p => p.has_active_timer);
  
  const allProjects = projects;

  const ProjectList = ({ projectList, showProgress = true }: { 
    projectList: SupervisorProject[];
    showProgress?: boolean;
  }) => (
    <div className="space-y-3">
      {projectList.length > 0 ? (
        projectList.map((project) => (
          <div 
            key={project.id} 
            className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md ${
              project.has_active_timer 
                ? 'bg-gradient-to-br from-primary/10 to-brand-2/20 border-primary/20 hover:from-primary/15 hover:to-brand-2/25 shadow-sm' 
                : 'hover:bg-accent/50'
            }`}
            onClick={() => navigate(`/project/${project.id}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{project.title}</h3>
                  {project.has_active_timer && (
                    <Badge variant="secondary" className="bg-gradient-to-r from-primary/20 to-brand-2/30 text-primary border-primary/30 shadow-sm">
                      <Play className="size-3 mr-1 text-primary" />
                      Timer Ativo
                    </Badge>
                  )}
                </div>
                {project.client_name && (
                  <p className="text-sm text-muted-foreground">
                    Cliente: {project.client_name}
                  </p>
                )}
                {project.has_active_timer && project.active_users.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 p-2 bg-gradient-to-r from-primary/10 to-brand-2/20 rounded-md border border-primary/20 shadow-sm">
                    <Play className="size-3 text-primary" />
                    <span className="text-xs font-medium text-primary">
                      Trabalhando: {project.active_users.slice(0, 3).join(', ')}
                      {project.active_users.length > 3 && ` +${project.active_users.length - 3} outros`}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getStatusColor(project.status)}`}
                >
                  {getStatusLabel(project.status)}
                </Badge>
                {project.contracted_hours > 0 && (
                  <div className="text-xs text-muted-foreground text-right">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {project.executed_hours.toFixed(1)}h / {project.contracted_hours.toFixed(1)}h
                    </div>
                  </div>
                )}
              </div>
            </div>

            {showProgress && project.contracted_hours > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="size-3" />
                    Progresso
                  </span>
                  <span className="font-medium">
                    {project.progress.toFixed(1)}%
                  </span>
                </div>
                <div className="relative">
                  <Progress 
                    value={project.progress} 
                    className="h-3"
                  />
                  <div 
                    className={`absolute top-0 left-0 h-3 rounded-full transition-all ${getProgressColor(project.progress)}`}
                    style={{ width: `${Math.min(project.progress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FolderOpen className="size-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Nenhum projeto encontrado</p>
          <p className="text-sm">Os projetos aparecerão aqui conforme forem criados</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="size-5" />
            Controle de Projetos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-2 bg-muted rounded w-full mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-5" />
            Controle de Projetos
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/projects')}
            className="gap-2"
          >
            <ExternalLink className="size-4" />
            Gerenciar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="active" className="text-xs">
              Em Andamento ({activeProjects.length})
            </TabsTrigger>
            <TabsTrigger value="timers" className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/20 data-[state=active]:to-brand-2/30 data-[state=active]:text-primary data-[state=active]:border-primary/30">
              <TimerIcon className="size-3 mr-1" />
              Com Timers ({projectsWithTimers.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              Todos ({allProjects.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="mt-0">
            <ProjectList projectList={activeProjects} />
          </TabsContent>
          
          <TabsContent value="timers" className="mt-0">
            <ProjectList projectList={projectsWithTimers} />
          </TabsContent>
          
          <TabsContent value="all" className="mt-0">
            <ProjectList projectList={allProjects.slice(0, 10)} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}