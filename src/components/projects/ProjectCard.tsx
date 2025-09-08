import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Building, MapPin, Clock, Calendar, Eye, FileText, Play, Pause, Users, Route, Settings, Timer, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { ProjectDocuments } from "./ProjectDocuments";
import { ProjectPhases } from "./ProjectPhases";
import { ProjectTimer } from "./ProjectTimer";
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
interface ProjectCardProps {
  project: Project;
  onUpdate: () => void;
}
export function ProjectCard({
  project,
  onUpdate
}: ProjectCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const progress = project.contracted_hours > 0 ? Math.min(project.executed_hours / project.contracted_hours * 100, 100) : 0;
  const statusConfig = {
    'orçamento': {
      label: 'Orçamento',
      color: 'bg-yellow-500',
      bgClass: 'bg-yellow-50 dark:bg-yellow-950/30',
      borderClass: 'border-yellow-200 dark:border-yellow-800',
      textClass: 'text-yellow-700 dark:text-yellow-300'
    },
    'aguardando_retorno': {
      label: 'Aguardando Retorno',
      color: 'bg-orange-500',
      bgClass: 'bg-orange-50 dark:bg-orange-950/30',
      borderClass: 'border-orange-200 dark:border-orange-800',
      textClass: 'text-orange-700 dark:text-orange-300'
    },
    'em_andamento': {
      label: 'Em Andamento',
      color: 'bg-blue-500',
      bgClass: 'bg-blue-50 dark:bg-blue-950/30',
      borderClass: 'border-blue-200 dark:border-blue-800',
      textClass: 'text-blue-700 dark:text-blue-300'
    },
    'em_obra': {
      label: 'Em Obra',
      color: 'bg-green-500',
      bgClass: 'bg-green-50 dark:bg-green-950/30',
      borderClass: 'border-green-200 dark:border-green-800',
      textClass: 'text-green-700 dark:text-green-300'
    },
    'concluído': {
      label: 'Concluído',
      color: 'bg-purple-500',
      bgClass: 'bg-purple-50 dark:bg-purple-950/30',
      borderClass: 'border-purple-200 dark:border-purple-800',
      textClass: 'text-purple-700 dark:text-purple-300'
    }
  };
  const currentStatus = statusConfig[project.status as keyof typeof statusConfig] || statusConfig['orçamento'];
  return <>
      <div className={`group border-2 border-border/50 rounded-2xl p-6 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 bg-gradient-to-br from-card to-muted/20 relative overflow-hidden`}>
        {/* Status indicator bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${currentStatus.color}`} />
        
        {/* Header do projeto */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 ${currentStatus.bgClass} ${currentStatus.borderClass} border rounded-lg`}>
                <Building className={`h-5 w-5 ${currentStatus.textClass}`} />
              </div>
              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {project.title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {project.description}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="secondary" className={`${currentStatus.bgClass} ${currentStatus.textClass} ${currentStatus.borderClass} border font-medium shadow-sm`}>
              {currentStatus.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(project.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Informações principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Endereço */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border/50 my-0 py-[27px]">
              <div className="p-2 bg-primary/10 rounded-full mt-1">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Local da Obra
                </p>
                <p className="text-sm font-medium leading-relaxed">
                  {project.address}
                </p>
              </div>
            </div>
          </div>

          {/* Progresso */}
          <div className="space-y-3">
            <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
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
              <div className="space-y-2">
                <Progress value={progress} className="h-2.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{project.executed_hours || 0}h executadas</span>
                  <span>{project.contracted_hours || 0}h contratadas</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border/30">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Reuniões</p>
              <p className="text-lg font-bold text-foreground">{project.meetings_count || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border/30">
            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-full">
              <Route className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Visitas</p>
              <p className="text-lg font-bold text-foreground">{project.visits_count || 0}</p>
            </div>
          </div>
        </div>

        {/* Timer de horas */}
        <div className="mb-6">
          <ProjectTimer projectId={project.id} onHoursUpdate={onUpdate} />
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between pt-4 border-t border-border/30">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Atualizado em {new Date(project.updated_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200" asChild>
              <Link to={`/projects/${project.id}`}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200" onClick={() => setDetailsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Detalhes
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog de detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Building className="h-6 w-6 text-primary" />
              {project.title}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="phases">Etapas</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4 overflow-y-auto max-h-[60vh]">
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2">Informações Gerais</h4>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="font-medium text-muted-foreground">Endereço:</span>
                          <p>{project.address}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Status:</span>
                          <Badge className={`ml-2 ${currentStatus.bgClass} ${currentStatus.textClass}`}>
                            {currentStatus.label}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Descrição:</span>
                          <p>{project.description}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Métricas</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-medium text-muted-foreground">Horas Contratadas</p>
                          <p className="text-2xl font-bold text-primary">{project.contracted_hours}h</p>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-medium text-muted-foreground">Horas Executadas</p>
                          <p className="text-2xl font-bold text-green-600">{project.executed_hours}h</p>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-medium text-muted-foreground">Reuniões</p>
                          <p className="text-2xl font-bold text-blue-600">{project.meetings_count || 0}</p>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-medium text-muted-foreground">Visitas</p>
                          <p className="text-2xl font-bold text-orange-600">{project.visits_count || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="phases" className="overflow-y-auto max-h-[60vh]">
              <ProjectPhases 
                projectId={project.id} 
                contractedValue={project.contracted_value || (project.contracted_hours || 0) * 150}
                contractedHours={project.contracted_hours || 0}
                onPhasesChange={onUpdate}
              />
            </TabsContent>
            
            <TabsContent value="documents" className="overflow-y-auto max-h-[60vh]">
              <ProjectDocuments projectId={project.id} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>;
}