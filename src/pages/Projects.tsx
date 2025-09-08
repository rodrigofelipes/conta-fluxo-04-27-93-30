import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { 
  FolderOpen, 
  Plus, 
  Timer as TimerIcon, 
  Users,
  Clock,
  Search,
  Filter,
  TrendingUp,
  Play,
  Building2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { useAuth } from "@/state/auth";

interface Project {
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
  description?: string;
  address?: string;
  client_id?: string;
}

const statusOptions = [
  { value: 'all', label: 'Todos os Status' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'em_obra', label: 'Em Obra' },
  { value: 'concluído', label: 'Concluído' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'em_andamento': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'em_obra': return 'bg-green-100 text-green-800 border-green-200';
    case 'orçamento': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'concluído': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'cancelado': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'em_andamento': return 'Em Andamento';
    case 'em_obra': return 'Em Obra';
    case 'orçamento': return 'Orçamento';
    case 'concluído': return 'Concluído';
    case 'cancelado': return 'Cancelado';
    default: return status;
  }
};

const getProgressColor = (progress: number) => {
  if (progress >= 90) return 'bg-green-500';
  if (progress >= 75) return 'bg-blue-500';
  if (progress >= 50) return 'bg-yellow-500';
  return 'bg-orange-500';
};

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Redirect users to their phases page
  useEffect(() => {
    if (user?.role === 'user') {
      navigate('/user-projects', { replace: true });
      return;
    }
  }, [user?.role, navigate]);

  const loadProjects = async () => {
    try {
      setLoading(true);

      // Buscar apenas projetos em andamento ou em obra
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          status,
          executed_hours,
          contracted_hours,
          created_at,
          description,
          address,
          client_id,
          clients(name)
        `)
        .in('status', ['em_andamento', 'em_obra'])
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Buscar timers ativos
      const { data: activeTimers, error: timersError } = await supabase
        .from('time_entries')
        .select(`
          project_id,
          user_id,
          profiles!inner(name)
        `)
        .is('end_time', null);

      if (timersError) throw timersError;

      // Agrupar timers por projeto
      const projectTimers = new Map<string, string[]>();
      (activeTimers || []).forEach(timer => {
        const users = projectTimers.get(timer.project_id) || [];
        const userName = (timer.profiles as any)?.name || 'Colaborador';
        users.push(userName);
        projectTimers.set(timer.project_id, users);
      });

      // Processar projetos
      const processedProjects: Project[] = (projectsData || []).map(project => {
        const executedHours = project.executed_hours || 0;
        const contractedHours = project.contracted_hours || 0;
        const progress = contractedHours > 0 ? (executedHours / contractedHours) * 100 : 0;
        const activeUsers = projectTimers.get(project.id) || [];

        return {
          id: project.id,
          title: project.title || 'Projeto sem título',
          status: project.status,
          client_name: (project.clients as any)?.name,
          executed_hours: executedHours,
          contracted_hours: contractedHours,
          progress: Math.min(progress, 100),
          has_active_timer: activeUsers.length > 0,
          active_users: activeUsers,
          created_at: project.created_at,
          description: project.description,
          address: project.address,
          client_id: project.client_id
        };
      });

      setProjects(processedProjects);
      setFilteredProjects(processedProjects);

    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar projetos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'user') {
      loadProjects();
      
      // Atualizar a cada 30 segundos
      const interval = setInterval(loadProjects, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user?.role]);

  // Filtrar projetos baseado na busca e status
  useEffect(() => {
    let filtered = projects;

    // Filtro de texto
    if (searchTerm.trim()) {
      filtered = filtered.filter(project =>
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    setFilteredProjects(filtered);
  }, [projects, searchTerm, statusFilter]);

  // If user role, don't render anything (will be redirected)
  if (user?.role === 'user') {
    return null;
  }

  const activeProjects = projects.filter(p => 
    p.status === 'em_andamento' || p.status === 'em_obra'
  );
  
  const projectsWithTimers = projects.filter(p => p.has_active_timer);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Projetos" 
          subtitle="Carregando..." 
        />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-2 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Gestão de Projetos" 
        subtitle="Controle e acompanhamento de todos os projetos"
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">{projects.length}</p>
              </div>
              <FolderOpen className="size-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold text-primary">{activeProjects.length}</p>
              </div>
              <Building2 className="size-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com Timers</p>
                <p className="text-2xl font-bold text-primary">{projectsWithTimers.length}</p>
              </div>
              <TimerIcon className="size-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equipe Ativa</p>
                <p className="text-2xl font-bold text-primary">
                  {new Set(projectsWithTimers.flatMap(p => p.active_users)).size}
                </p>
              </div>
              <Users className="size-8 text-orange-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              placeholder="Buscar por nome, cliente ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="size-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="size-4" />
          Novo Projeto
        </Button>
      </div>

      {/* Lista de Projetos */}
      <div className="grid gap-4">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <Card 
              key={project.id} 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                project.has_active_timer 
                  ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg truncate">{project.title}</h3>
                      {project.has_active_timer && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                          <Play className="size-3 mr-1" />
                          Em Execução
                        </Badge>
                      )}
                    </div>
                    
                    {project.client_name && (
                      <p className="text-muted-foreground mb-1">
                        Cliente: {project.client_name}
                      </p>
                    )}
                    
                    {project.address && (
                      <p className="text-sm text-muted-foreground mb-2">
                        📍 {project.address}
                      </p>
                    )}
                    
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    
                    {project.has_active_timer && project.active_users.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="size-4 text-green-600" />
                        <span className="text-sm text-green-700">
                          {project.active_users.slice(0, 3).join(', ')}
                          {project.active_users.length > 3 && ` +${project.active_users.length - 3}`}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge 
                      variant="outline" 
                      className={`${getStatusColor(project.status)}`}
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

                {project.contracted_hours > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        Progresso do Projeto
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
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderOpen className="size-16 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">
                {searchTerm || statusFilter !== 'all' ? 'Nenhum projeto encontrado' : 'Nenhum projeto cadastrado'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Tente ajustar os filtros de busca' 
                  : 'Comece criando seu primeiro projeto'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="size-4" />
                  Criar Primeiro Projeto
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <CreateProjectDialog 
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={loadProjects}
      />
    </div>
  );
}