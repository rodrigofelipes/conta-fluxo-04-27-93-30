import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building, 
  Plus, 
  Clock, 
  Users, 
  Settings,
  Eye,
  Calendar,
  MapPin,
  CheckCircle2,
  Timer,
  AlertTriangle,
  TrendingUp,
  PlayCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIntelligentPhases } from "@/hooks/useIntelligentPhases";

interface Project {
  id: string;
  title: string;
  description: string;
  address: string;
  status: string;
  contracted_hours: number;
  contracted_value: number;
  executed_hours: number;
  visits_count: number;
  meetings_count: number;
  created_at: string;
  updated_at: string;
}

interface ProjectWithPhases extends Project {
  phases: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    with_loss: number;
  };
  team: {
    assigned_users: number;
    supervisors: number;
  };
  has_active_timer: boolean;
}

interface ClientProjectsTabProps {
  projects: Project[];
  onUpdate: () => void;
}

// Componente para cada projeto individual
function EnhancedProjectCard({ project, onUpdate }: { project: ProjectWithPhases; onUpdate: () => void }) {
  const progress = project.contracted_hours > 0 ? Math.min(project.executed_hours / project.contracted_hours * 100, 100) : 0;
  
  const statusConfig = {
    'orçamento': { label: 'Orçamento', color: 'bg-gradient-to-r from-brand/80 to-brand-2/80', variant: 'secondary' as const },
    'aguardando_retorno': { label: 'Aguardando Retorno', color: 'bg-gradient-to-r from-brand-2/70 to-brand/70', variant: 'secondary' as const },
    'em_andamento': { label: 'Em Andamento', color: 'bg-gradient-to-r from-primary to-brand', variant: 'default' as const },
    'em_obra': { label: 'Em Obra', color: 'bg-gradient-to-r from-brand to-brand-2', variant: 'default' as const },
    'concluído': { label: 'Concluído', color: 'bg-gradient-to-r from-brand-3/80 to-primary/80', variant: 'secondary' as const }
  };

  const currentStatus = statusConfig[project.status as keyof typeof statusConfig] || statusConfig['orçamento'];

  return (
    <Card className="group border-2 border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 bg-gradient-to-br from-card to-muted/20 relative overflow-hidden">
      {/* Status indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${currentStatus.color}`} />
      
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {project.title}
                </h3>
                {project.has_active_timer && (
                  <div className="flex items-center gap-1 mt-1">
                    <Timer className="h-3 w-3 text-green-500 animate-pulse" />
                    <span className="text-xs text-green-600 font-medium">Timer ativo</span>
                  </div>
                )}
              </div>
            </div>
            {project.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="line-clamp-1">{project.address}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={currentStatus.variant}>
              {currentStatus.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(project.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Progress e Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Progress */}
          <div className="lg:col-span-2 p-4 bg-muted/30 rounded-xl border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Progresso
                </span>
              </div>
              <span className="text-sm font-bold text-primary">
                {progress.toFixed(0)}%
              </span>
            </div>
            <Progress value={progress} className="h-2.5 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{project.executed_hours || 0}h executadas</span>
              <span>{project.contracted_hours || 0}h contratadas</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
              <span className="text-xs text-muted-foreground">Etapas</span>
              <span className="text-sm font-medium">{project.phases.completed}/{project.phases.total}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
              <span className="text-xs text-muted-foreground">Equipe</span>
              <span className="text-sm font-medium">{project.team.assigned_users}</span>
            </div>
          </div>
        </div>

        {/* Etapas Status */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="text-center p-3 bg-brand/10 rounded-lg border border-brand/30 hover:bg-brand/15 transition-colors">
            <div className="text-lg font-bold text-brand">
              {project.phases.pending}
            </div>
            <div className="text-xs text-brand/80">Pendentes</div>
          </div>
          <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/30 hover:bg-primary/15 transition-colors">
            <div className="text-lg font-bold text-primary">
              {project.phases.in_progress}
            </div>
            <div className="text-xs text-primary/80">Em Progresso</div>
          </div>
          <div className="text-center p-3 bg-brand-2/10 rounded-lg border border-brand-2/30 hover:bg-brand-2/15 transition-colors">
            <div className="text-lg font-bold text-brand-2">
              {project.phases.completed}
            </div>
            <div className="text-xs text-brand-2/80">Concluídas</div>
          </div>
          <div className="text-center p-3 bg-brand-3/10 rounded-lg border border-brand-3/30 hover:bg-brand-3/15 transition-colors">
            <div className="text-lg font-bold text-brand-3">
              {project.phases.with_loss}
            </div>
            <div className="text-xs text-brand-3/80">C/ Prejuízo</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border/30">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Atualizado em {new Date(project.updated_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/projects/${project.id}`}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientProjectsTab({ projects, onUpdate }: ClientProjectsTabProps) {
  const [projectsWithPhases, setProjectsWithPhases] = useState<ProjectWithPhases[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const loadProjectsData = async () => {
    if (!projects.length) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const projectIds = projects.map(p => p.id);

      // Buscar etapas de todos os projetos
      const { data: phases } = await supabase
        .from('project_phases')
        .select('project_id, status, executed_hours, allocated_hours, assigned_to, supervised_by')
        .in('project_id', projectIds);

      // Buscar timers ativos
      const { data: activeTimers } = await supabase
        .from('time_entries')
        .select('project_id')
        .in('project_id', projectIds)
        .is('end_time', null);

      const activeProjectIds = new Set((activeTimers || []).map(t => t.project_id));

      const enhancedProjects: ProjectWithPhases[] = projects.map(project => {
        const projectPhases = (phases || []).filter(p => p.project_id === project.id);
        
        const assignedUsers = new Set();
        const supervisors = new Set();
        
        projectPhases.forEach(phase => {
          if (phase.assigned_to) assignedUsers.add(phase.assigned_to);
          if (phase.supervised_by) supervisors.add(phase.supervised_by);
        });

        return {
          ...project,
          phases: {
            total: projectPhases.length,
            pending: projectPhases.filter(p => p.status === 'pending').length,
            in_progress: projectPhases.filter(p => p.status === 'in_progress').length,
            completed: projectPhases.filter(p => p.status === 'completed').length,
            with_loss: projectPhases.filter(p => p.executed_hours > p.allocated_hours).length,
          },
          team: {
            assigned_users: assignedUsers.size,
            supervisors: supervisors.size,
          },
          has_active_timer: activeProjectIds.has(project.id)
        };
      });

      setProjectsWithPhases(enhancedProjects);
    } catch (error) {
      console.error('Erro ao carregar dados dos projetos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectsData();
  }, [projects]);

  const filteredProjects = projectsWithPhases.filter(project => {
    switch (activeTab) {
      case 'active':
        return ['em_andamento', 'em_obra'].includes(project.status);
      case 'with_timers':
        return project.has_active_timer;
      case 'with_issues':
        return project.phases.with_loss > 0;
      default:
        return true;
    }
  });

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'active':
        return projectsWithPhases.filter(p => ['em_andamento', 'em_obra'].includes(p.status)).length;
      case 'with_timers':
        return projectsWithPhases.filter(p => p.has_active_timer).length;
      case 'with_issues':
        return projectsWithPhases.filter(p => p.phases.with_loss > 0).length;
      default:
        return projectsWithPhases.length;
    }
  };

  return (
    <Card className="border-2 border-border/50 bg-gradient-to-br from-background to-background/80">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-brand-2/10 border-b border-border/50">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-brand/30 rounded-lg shadow-sm">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Projetos</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {projects.length} projeto{projects.length !== 1 ? 's' : ''} vinculado{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-gradient-to-r from-primary to-brand hover:from-primary/90 hover:to-brand/90 shadow-md hover:shadow-lg hover:shadow-primary/20 transition-all duration-200">
            <Plus className="mr-2 h-4 w-4" />
            Novo Projeto
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {projects.length > 0 ? (
          <div className="space-y-6">
            {/* Tabs para filtrar projetos */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Todos ({getTabCount('all')})
                </TabsTrigger>
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Ativos ({getTabCount('active')})
                </TabsTrigger>
                <TabsTrigger value="with_timers" className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  C/ Timer ({getTabCount('with_timers')})
                </TabsTrigger>
                <TabsTrigger value="with_issues" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  C/ Problemas ({getTabCount('with_issues')})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {loading ? (
                  <div className="space-y-6">
                    {[1, 2, 3].map(i => (
                      <Card key={i} className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-lg" />
                            <div className="space-y-2">
                              <Skeleton className="h-5 w-48" />
                              <Skeleton className="h-4 w-32" />
                            </div>
                          </div>
                          <Skeleton className="h-20 w-full" />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : filteredProjects.length > 0 ? (
                  <div className="space-y-6">
                    {filteredProjects.map(project => (
                      <EnhancedProjectCard 
                        key={project.id} 
                        project={project} 
                        onUpdate={() => {
                          onUpdate();
                          loadProjectsData();
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">
                      {activeTab === 'all' ? 'Nenhum projeto encontrado' : 
                       activeTab === 'active' ? 'Nenhum projeto ativo' :
                       activeTab === 'with_timers' ? 'Nenhum projeto com timer ativo' :
                       'Nenhum projeto com problemas'}
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {activeTab === 'all' ? 'Comece criando o primeiro projeto para este cliente.' :
                       'Tente selecionar uma categoria diferente ou ajustar os filtros.'}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-brand-2/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
              <Building className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Nenhum projeto vinculado</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Comece criando o primeiro projeto para este cliente e acompanhe todo o progresso em detalhes.
            </p>
            <Button className="bg-gradient-to-r from-primary to-brand hover:from-primary/90 hover:to-brand/90 shadow-md hover:shadow-lg hover:shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Projeto
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}