import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FolderOpen, Timer as TimerIcon, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  title: string;
  status: string;
  client_name?: string;
  executed_hours: number;
  contracted_hours: number;
  progress: number;
  has_active_timer?: boolean;
}

interface ProjectsWidgetProps {
  projects: Project[];
  loading?: boolean;
  showTimer?: boolean;
  title?: string;
}

export function ProjectsWidget({ 
  projects, 
  loading, 
  showTimer = false,
  title = "Projetos" 
}: ProjectsWidgetProps) {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'bg-blue-100 text-blue-800';
      case 'em_obra': return 'bg-green-100 text-green-800';
      case 'orçamento': return 'bg-yellow-100 text-yellow-800';
      case 'concluído': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="size-5" />
            {title}
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
            {title} ({projects.length})
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/projects')}
            className="gap-2"
          >
            <ExternalLink className="size-4" />
            Ver Todos
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length > 0 ? (
          <div className="space-y-4">
            {projects.map((project) => (
              <div 
                key={project.id} 
                className="p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{project.title}</h3>
                    {project.client_name && (
                      <p className="text-sm text-muted-foreground">
                        {project.client_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {showTimer && project.has_active_timer && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <TimerIcon className="size-3 mr-1" />
                        Ativo
                      </Badge>
                    )}
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getStatusColor(project.status)}`}
                    >
                      {getStatusLabel(project.status)}
                    </Badge>
                  </div>
                </div>

                {project.contracted_hours > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span>
                        {project.executed_hours.toFixed(1)}h / {project.contracted_hours.toFixed(1)}h
                      </span>
                    </div>
                    <Progress 
                      value={project.progress} 
                      className="h-2"
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {project.progress.toFixed(1)}% concluído
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum projeto encontrado
          </p>
        )}
      </CardContent>
    </Card>
  );
}