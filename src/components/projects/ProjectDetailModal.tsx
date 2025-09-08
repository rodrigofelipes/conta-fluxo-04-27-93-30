import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, User, Clock, Calendar, FileText, Timer, Play, Square, TrendingUp, Target, Zap } from "lucide-react";

interface Project {
  id: string;
  title: string;
  description: string;
  address: string;
  status: "orçamento" | "aguardando_retorno" | "em_andamento" | "em_obra" | "concluído";
  contracted_hours: number;
  executed_hours: number;
  client: { name: string; email: string };
  created_at?: string;
}

interface ProjectDetailModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  isTimerActive?: boolean;
  onStartTimer?: () => void;
  onStopTimer?: () => void;
  timerDisplay?: string;
}

const statusLabel: Record<Project["status"], string> = {
  "orçamento": "Orçamento",
  aguardando_retorno: "Aguardando Retorno",
  em_andamento: "Em Andamento",
  em_obra: "Em Obra",
  concluído: "Concluído",
};

const statusColors: Record<Project["status"], string> = {
  "orçamento": "bg-yellow-100 text-yellow-800 border-yellow-200",
  aguardando_retorno: "bg-orange-100 text-orange-800 border-orange-200",
  em_andamento: "bg-blue-100 text-blue-800 border-blue-200",
  em_obra: "bg-purple-100 text-purple-800 border-purple-200",
  concluído: "bg-green-100 text-green-800 border-green-200",
};

export function ProjectDetailModal({ 
  project, 
  isOpen, 
  onClose, 
  isTimerActive, 
  onStartTimer, 
  onStopTimer, 
  timerDisplay 
}: ProjectDetailModalProps) {
  if (!project) return null;

  const progressPercentage = project.contracted_hours > 0 
    ? Math.min((project.executed_hours / project.contracted_hours) * 100, 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-card via-card to-card/95 shadow-2xl p-0 scrollbar-hide [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:hidden [&::-webkit-scrollbar-thumb]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="p-6 shadow-lg btn-hero animate-gradient-pan w-full">
          <div className="flex items-start justify-between gap-4 text-white">
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-white">
                {project.title}
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Target className="w-4 h-4" />
                <span>Projeto Arquitetônico</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge 
                variant="outline" 
                className="bg-white/20 text-white border-white/30 border-2 font-medium px-3 py-1 shadow-sm"
              >
                {statusLabel[project.status]}
              </Badge>
              <div className="text-xs text-white/60 font-medium">
                ID: {project.id.slice(0, 8)}...
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8 p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 rounded-xl border border-primary/20 card-elevated">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Contratado</span>
              </div>
              <p className="text-xl font-bold text-primary">{project.contracted_hours}h</p>
            </div>
            
            <div className="bg-gradient-to-br from-status-in-progress/10 via-status-in-progress/5 to-transparent p-4 rounded-xl border border-status-in-progress/20 card-elevated">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-status-in-progress/20 rounded-lg">
                  <Timer className="w-4 h-4 text-status-in-progress" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Executado</span>
              </div>
              <p className="text-xl font-bold text-status-in-progress">{project.executed_hours.toFixed(1)}h</p>
            </div>
            
            <div className="bg-gradient-to-br from-status-completed/10 via-status-completed/5 to-transparent p-4 rounded-xl border border-status-completed/20 card-elevated">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-status-completed/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-status-completed" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Progresso</span>
              </div>
              <p className="text-xl font-bold text-status-completed">{progressPercentage.toFixed(0)}%</p>
            </div>
            
            <div className="bg-gradient-to-br from-priority-medium/10 via-priority-medium/5 to-transparent p-4 rounded-xl border border-priority-medium/20 card-elevated">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-priority-medium/20 rounded-lg">
                  <Zap className="w-4 h-4 text-priority-medium" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Restante</span>
              </div>
              <p className="text-xl font-bold text-priority-medium">{Math.max(0, project.contracted_hours - project.executed_hours).toFixed(1)}h</p>
            </div>
          </div>

          {/* Informações Básicas */}
          <Card className="border-2 border-border/30 shadow-xl bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <span>Informações do Projeto</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 bg-primary/20 rounded">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Cliente</span>
                    </div>
                    <p className="font-semibold text-foreground">{project.client.name}</p>
                    <p className="text-sm text-muted-foreground">{project.client.email}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 bg-primary/20 rounded">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Localização</span>
                    </div>
                    <p className="font-semibold text-foreground">{project.address || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {project.description && (
                <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/50 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Descrição do Projeto</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{project.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Bar */}
          <Card className="border-2 border-border/30 shadow-xl bg-gradient-to-br from-card to-card/80 overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <span>Progresso do Projeto</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-2xl font-bold bg-gradient-to-r from-primary to-status-in-progress bg-clip-text text-transparent">
                    {progressPercentage.toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Concluído</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-lg font-semibold text-foreground">
                    {project.executed_hours.toFixed(2)}h / {project.contracted_hours}h
                  </p>
                  <p className="text-sm text-muted-foreground">Horas trabalhadas</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="w-full bg-muted rounded-full h-4 shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-primary via-status-in-progress to-status-completed h-4 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
                    style={{ width: `${progressPercentage}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="text-center">
                    <div className="w-3 h-3 bg-primary rounded-full mx-auto mb-1"></div>
                    <span className="text-muted-foreground">Início</span>
                  </div>
                  <div className="text-center">
                    <div className="w-3 h-3 bg-status-in-progress rounded-full mx-auto mb-1"></div>
                    <span className="text-muted-foreground">Atual</span>
                  </div>
                  <div className="text-center">
                    <div className="w-3 h-3 bg-status-completed rounded-full mx-auto mb-1"></div>
                    <span className="text-muted-foreground">Meta</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timer Controls */}
          <Card className="border-2 border-border/30 shadow-xl bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Timer className="w-5 h-5 text-primary" />
                </div>
                <span>Controle de Tempo</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isTimerActive && timerDisplay ? (
                <div className="space-y-6">
                  <div className="relative p-8 bg-gradient-to-br from-status-completed/10 via-status-completed/5 to-transparent border-2 border-status-completed/30 rounded-2xl card-elevated">
                    <div className="absolute top-4 left-4">
                      <div className="w-3 h-3 bg-status-completed rounded-full pulse-dot"></div>
                    </div>
                    <div className="text-center space-y-3">
                      <div className="p-3 bg-status-completed/20 rounded-full w-fit mx-auto">
                        <Timer className="w-6 h-6 text-status-completed" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Tempo em execução</p>
                        <span className="font-mono text-3xl font-bold bg-gradient-to-r from-status-completed to-status-in-progress bg-clip-text text-transparent">
                          {timerDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="destructive"
                    onClick={onStopTimer}
                    className="w-full gap-3 h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Square className="w-5 h-5" />
                    Parar Timer
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center p-6 bg-muted/30 rounded-xl border border-border/50">
                    <div className="p-3 bg-primary/20 rounded-full w-fit mx-auto mb-3">
                      <Timer className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">Cronômetro parado</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique para iniciar o registro de horas</p>
                  </div>
                  <Button 
                    onClick={onStartTimer}
                    className="w-full gap-3 h-12 text-base font-medium btn-hero-static shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Play className="w-5 h-5" />
                    Iniciar Timer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}