import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Square, 
  Timer,
  Clock,
  AlertTriangle,
  User,
  CheckCircle,
  DollarSign,
  TrendingDown,
  Eye
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/state/auth";
import { supabase } from "@/integrations/supabase/client";
import { ProjectObservationDialog } from "./ProjectObservationDialog";

interface Phase {
  id: string;
  phase_name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  allocated_hours: number;
  executed_hours: number;
  assigned_to?: string;
  supervised_by?: string;
  assigned_profile?: {
    name: string;
  };
  project: {
    id?: string;
    title: string;
    client_id?: string;
    client?: {
      id: string;
      name: string;
    };
  };
}

interface PhaseTimerCardProps {
  phase: Phase;
  onHoursUpdate: () => void;
  showProjectTitle?: boolean;
}

export function PhaseTimerCard({ phase, onHoursUpdate, showProjectTitle = false }: PhaseTimerCardProps) {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [phaseLoss, setPhaseLoss] = useState<{
    excess_hours: number;
    hourly_value: number;
    total_loss: number;
    loss_percentage: number;
  } | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  
  const progressPercentage = phase.allocated_hours > 0 
    ? Math.min((phase.executed_hours / phase.allocated_hours) * 100, 100)
    : 0;
  
  const isOverAllocated = phase.executed_hours > phase.allocated_hours;
  const isNearLimit = progressPercentage >= 80;

  useEffect(() => {
    checkActiveTimer();
    calculateLoss();
    checkManagePermissions();
  }, [phase.id, user, phase.executed_hours, phase.allocated_hours]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, startTime]);

  const checkActiveTimer = async () => {
    if (!user || !phase.id) return;

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('phase_id', phase.id)
        .eq('user_id', user.id)
        .is('end_time', null)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const activeEntry = data[0];
        const start = new Date(activeEntry.start_time);
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
        
        setStartTime(start);
        setElapsedTime(elapsed);
        setIsRunning(true);
      } else {
        setIsRunning(false);
        setElapsedTime(0);
        setStartTime(null);
      }
    } catch (error) {
      console.error('Erro ao verificar timer ativo:', error);
    }
  };

  const calculateLoss = async () => {
    if (!phase.id || !isOverAllocated) {
      setPhaseLoss(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('calculate_phase_loss', { phase_id_param: phase.id });

      if (error) throw error;

      if (data && data.length > 0) {
        setPhaseLoss(data[0]);
      }
    } catch (error) {
      console.error('Erro ao calcular prejuízo:', error);
    }
  };

  const checkManagePermissions = async () => {
    if (!user || !phase.id) {
      setCanManage(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('can_manage_phase', { 
          phase_id_param: phase.id, 
          user_id_param: user.id 
        });

      if (error) throw error;
      setCanManage(data || false);
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      setCanManage(false);
    }
  };

  const completePhase = async () => {
    if (!user || !phase.id || isCompleting) return;

    setIsCompleting(true);
    try {
      const { data, error } = await supabase
        .rpc('complete_phase', { 
          phase_id_param: phase.id, 
          user_id_param: user.id 
        });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };

      if (result?.success) {
        toast({
          title: "Fase concluída",
          description: result.message || "Fase marcada como concluída"
        });
        setShowCompleteDialog(false); // Fecha o modal
        onHoursUpdate(); // Refresh the phase data
      } else {
        toast({
          title: "Erro",
          description: result?.error || "Erro ao concluir fase",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao concluir fase:', error);
      toast({
        title: "Erro",
        description: "Não foi possível concluir a fase.",
        variant: "destructive"
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const startTimer = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const { error } = await supabase
        .from('time_entries')
        .insert({
          phase_id: phase.id,
          project_id: phase.project?.id || null, // For backward compatibility
          user_id: user.id,
          start_time: now.toISOString()
        });

      if (error) throw error;

      setStartTime(now);
      setElapsedTime(0);
      setIsRunning(true);
      
      toast({
        title: "Timer iniciado",
        description: `Timer para "${phase.phase_name}" começou a contar.`
      });
    } catch (error) {
      console.error('Erro ao iniciar timer:', error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o timer.",
        variant: "destructive"
      });
    }
  };

  const stopTimer = async () => {
    if (!user || !startTime) return;

    try {
      const endTime = new Date();
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      const durationMinutes = Math.floor(durationSeconds / 60);

      const { error } = await supabase
        .from('time_entries')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('phase_id', phase.id)
        .eq('user_id', user.id)
        .is('end_time', null);

      if (error) throw error;

      setIsRunning(false);
      const hours = (durationMinutes / 60).toFixed(2);
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      setElapsedTime(0);
      setStartTime(null);
      onHoursUpdate();

      toast({
        title: "Timer parado",
        description: `Sessão de ${hours}h (${minutes}m ${seconds}s) registrada para "${phase.phase_name}".`
      });
    } catch (error) {
      console.error('Erro ao parar timer:', error);
      toast({
        title: "Erro",
        description: "Não foi possível parar o timer.",
        variant: "destructive"
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (phase.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Timer className="h-4 w-4 text-blue-600" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusLabel = () => {
    switch (phase.status) {
      case 'completed':
        return 'Concluída';
      case 'in_progress':
        return 'Em Andamento';
      case 'cancelled':
        return 'Cancelada';
      default:
        return 'Pendente';
    }
  };

  const getStatusColor = () => {
    switch (phase.status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <Card className={`transition-all duration-200 ${
      isRunning ? 'ring-2 ring-primary/20 shadow-md' : 'hover:shadow-sm'
    }`}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {showProjectTitle && (
              <p className="text-xs text-muted-foreground mb-1">
                {phase.project?.title}
              </p>
            )}
            <h3 className="font-semibold line-clamp-1">{phase.phase_name}</h3>
            {phase.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {phase.description}
              </p>
            )}
          </div>
          
          <Badge variant="outline" className={getStatusColor()}>
            {getStatusIcon()}
            <span className="ml-1">{getStatusLabel()}</span>
          </Badge>
        </div>

        {/* Assigned user */}
        {phase.assigned_profile && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Responsável: {phase.assigned_profile.name}</span>
          </div>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Progresso</span>
            <span className="text-sm text-muted-foreground">
              {phase.executed_hours.toFixed(1)}h / {phase.allocated_hours}h
            </span>
          </div>
          
          <Progress 
            value={progressPercentage} 
            className={`h-2 ${isOverAllocated ? 'bg-red-100' : ''}`}
          />
          
          {isOverAllocated && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="h-3 w-3" />
              <span>Horas excedidas em {(phase.executed_hours - phase.allocated_hours).toFixed(1)}h</span>
            </div>
          )}
          
          {isNearLimit && !isOverAllocated && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              <span>Próximo do limite ({progressPercentage.toFixed(1)}%)</span>
            </div>
          )}
        </div>

        {/* Loss Calculation - New Feature */}
        {phaseLoss && phaseLoss.total_loss > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md space-y-2">
            <div className="flex items-center gap-2 text-red-800">
              <TrendingDown className="h-4 w-4" />
              <span className="font-medium text-sm">Prejuízo Calculado</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Horas Excedidas:</span>
                <div className="font-medium">{phaseLoss.excess_hours.toFixed(1)}h</div>
              </div>
              <div>
                <span className="text-muted-foreground">Valor/Hora:</span>
                <div className="font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {phaseLoss.hourly_value.toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Prejuízo Total:</span>
                <div className="font-medium text-red-600 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {phaseLoss.total_loss.toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">% Excesso:</span>
                <div className="font-medium text-red-600">
                  {phaseLoss.loss_percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Observation Button */}
        {phase.project?.id && (
          <div className="space-y-2">
            <ProjectObservationDialog projectId={phase.project.id}>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2"
              >
                <Eye className="h-4 w-4" />
                Ver Detalhes do Projeto
              </Button>
            </ProjectObservationDialog>
          </div>
        )}

        {/* Timer Controls */}
        <div className="space-y-2">
          {isRunning && (
            <div className="flex items-center justify-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
              <Timer className="h-4 w-4 text-green-600 animate-pulse" />
              <span className="font-mono text-sm font-semibold text-green-700">
                {formatTime(elapsedTime)}
              </span>
            </div>
          )}
          
          <div className="flex gap-2">
            {isRunning ? (
              <Button 
                size="sm" 
                variant="destructive"
                onClick={stopTimer}
                className="flex-1 gap-2"
              >
                <Square className="h-4 w-4" />
                Parar
              </Button>
            ) : (
              <Button 
                size="sm" 
                onClick={startTimer}
                disabled={phase.status === 'completed' || phase.status === 'cancelled'}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4" />
                Iniciar
              </Button>
            )}
            
            {/* Complete Phase Button with Confirmation Dialog */}
            {phase.status === 'in_progress' && canManage && !isRunning && (
              <div className="relative">
                <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="sm" 
                      disabled={isCompleting || phase.executed_hours < phase.allocated_hours}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      title={phase.executed_hours < phase.allocated_hours ? 
                        `Necessário completar ${phase.allocated_hours}h para concluir (atual: ${phase.executed_hours.toFixed(1)}h)` : 
                        'Concluir etapa'
                      }
                    >
                      <CheckCircle className="h-4 w-4" />
                      {isCompleting ? 'Concluindo...' : 'Concluir'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar conclusão da etapa</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja marcar a etapa "{phase.phase_name}" como concluída? 
                        Esta ação não pode ser desfeita.
                        <br /><br />
                        <strong>Horas executadas:</strong> {phase.executed_hours.toFixed(1)}h / {phase.allocated_hours}h
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={completePhase}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Sim, concluir etapa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                {/* Message when hours not completed */}
                {phase.executed_hours < phase.allocated_hours && (
                  <div className="absolute -bottom-8 left-0 text-xs text-muted-foreground whitespace-nowrap">
                    Faltam {(phase.allocated_hours - phase.executed_hours).toFixed(1)}h para concluir
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}